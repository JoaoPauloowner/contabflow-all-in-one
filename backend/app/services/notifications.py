"""
Serviço de Notificações Automáticas do ContabFlow All-in-One.

Implementa a régua de cobrança inteligente com 3 fases:
- D-5: Aviso preventivo de vencimento próximo (5 dias)
- D-0: Alerta urgente no dia do vencimento
- D+1: Notificação de atraso para guias vencidas sem baixa

Suporta modo mock (desenvolvimento) e envio real via WhatsApp Bridge (produção).
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.cliente import Cliente
from app.models.escritorio import Escritorio
from app.models.imposto import Imposto
from app.models.notificacao import Notificacao

logger = logging.getLogger("contabflow.notifications")


class NotificationService:
    @staticmethod
    def _dispatch_channel(
        canal: str,
        destinatario: str,
        assunto: str,
        mensagem: str,
    ) -> bool:
        """
        Despacha a notificação pelo canal apropriado.
        - Em dev (MOCK): apenas loga a mensagem formatada.
        - Em prod: chama o provedor real (WhatsApp via bridge / E-mail).
        """
        # Modo desenvolvimento: apenas loga
        mock_mode = getattr(settings, "MOCK_NOTIFICATIONS", True)
        if mock_mode:
            logger.info(
                f"🚀 [MOCK NOTIFICATION] Canal: {canal} | Para: {destinatario} | Assunto: {assunto}\n"
                f"Corpo: {mensagem}"
            )
            return True

        # Modo produção: despacha para provedor real
        if canal == "WHATSAPP":
            logger.info(
                f"📤 [REAL WHATSAPP] Enviando via Bridge para: {destinatario} | Assunto: {assunto}"
            )
            try:
                import httpx
                url = f"{settings.WHATSAPP_BRIDGE_URL}/message/sendText/contabflow"
                headers = {
                    "Content-Type": "application/json",
                    "apikey": settings.WHATSAPP_WEBHOOK_SECRET,
                }
                payload = {
                    "number": destinatario,
                    "text": f"*{assunto}*\n\n{mensagem}",
                }
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    logger.info(f"✅ [REAL WHATSAPP] Entregue com sucesso para {destinatario}")
                    return True
                else:
                    logger.error(f"❌ [REAL WHATSAPP] Falha: HTTP {resp.status_code} - {resp.text}")
                    return False
            except Exception as e:
                logger.error(f"❌ [REAL WHATSAPP] Erro de conexão: {e}")
                return False
        else:
            logger.info(
                f"📧 [REAL EMAIL] Envio programado para: {destinatario} | Assunto: {assunto}"
            )
            return True

    @staticmethod
    def _ja_notificado_hoje(db: Session, imposto_id: str, marcador: str) -> bool:
        """
        Verifica se já foi disparada uma notificação para este imposto com o mesmo
        marcador recentemente (últimas 20 horas). Garante idempotência da régua.
        """
        limite_recente = datetime.now(timezone.utc) - timedelta(hours=20)
        notificacoes = db.query(Notificacao).filter(
            Notificacao.imposto_id == imposto_id,
        ).all()

        for notif in notificacoes:
            if notif.sent_at:
                sent_at = notif.sent_at
                if isinstance(sent_at, datetime):
                    if sent_at.tzinfo is None:
                        sent_at = sent_at.replace(tzinfo=timezone.utc)
                    if sent_at >= limite_recente and marcador in (notif.assunto or ""):
                        return True
        return False

    @staticmethod
    def _formatar_valor(valor) -> str:
        """Formata valor monetário no padrão brasileiro R$ X.XXX,XX."""
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    @staticmethod
    def alertar_imposto_a_vencer(
        db: Session,
        imposto: Imposto,
        cliente: Cliente,
        dias_para_vencer: int,
    ) -> Notificacao:
        """[D-5] Dispara lembrete preventivo de guia que vencerá em breve."""
        valor_formatado = NotificationService._formatar_valor(imposto.valor)
        data_formatada = imposto.data_vencimento.strftime("%d/%m/%Y")

        assunto = f"[D-5] Aviso de Vencimento: {imposto.titulo} ({imposto.competencia})"
        mensagem = (
            f"Olá, {cliente.razao_social}!\n"
            f"Lembramos que a sua guia de {imposto.titulo} (Competência {imposto.competencia}) "
            f"no valor de {valor_formatado} vence em {dias_para_vencer} dias ({data_formatada}).\n"
        )
        if imposto.linha_digitavel:
            mensagem += f"Linha Digitável: {imposto.linha_digitavel}\n"
        if imposto.codigo_pix:
            mensagem += f"Chave/PIX: {imposto.codigo_pix}\n"
        mensagem += "Acesse o Portal ContabFlow para baixar a guia completa em PDF."

        NotificationService._dispatch_channel(
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
        )

        notificacao = Notificacao(
            tenant_id=imposto.tenant_id,
            cliente_id=cliente.id,
            imposto_id=imposto.id,
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
            status_envio="ENVIADO",
        )
        db.add(notificacao)
        db.commit()
        db.refresh(notificacao)
        return notificacao

    @staticmethod
    def alertar_imposto_vence_hoje(
        db: Session,
        imposto: Imposto,
        cliente: Cliente,
    ) -> Notificacao:
        """[D-0] Dispara alerta urgente no dia do vencimento com PIX em destaque."""
        valor_formatado = NotificationService._formatar_valor(imposto.valor)

        assunto = f"[D-0] URGENTE: {imposto.titulo} vence HOJE ({imposto.competencia})"
        mensagem = (
            f"⚠️ ATENÇÃO: {cliente.razao_social}!\n"
            f"Hoje é o dia do vencimento da sua guia de {imposto.titulo} ({imposto.competencia}) "
            f"no valor de {valor_formatado}.\n"
            f"Pague até as 23:59 para evitar juros e multas tributárias.\n\n"
        )
        if imposto.codigo_pix:
            mensagem += f"📲 PIX COPIA E COLA:\n{imposto.codigo_pix}\n\n"
        if imposto.linha_digitavel:
            mensagem += f"📄 Código de Barras:\n{imposto.linha_digitavel}\n\n"
        mensagem += "Após o pagamento, anexe o comprovante pelo Portal do Cliente ContabFlow."

        NotificationService._dispatch_channel(
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
        )

        notificacao = Notificacao(
            tenant_id=imposto.tenant_id,
            cliente_id=cliente.id,
            imposto_id=imposto.id,
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
            status_envio="ENVIADO",
        )
        db.add(notificacao)
        db.commit()
        db.refresh(notificacao)
        return notificacao

    @staticmethod
    def alertar_imposto_vencido(
        db: Session,
        imposto: Imposto,
        cliente: Cliente,
        dias_atraso: int,
    ) -> Notificacao:
        """[D+X] Dispara notificação escalonada de atraso para guia vencida sem baixa."""
        valor_formatado = NotificationService._formatar_valor(imposto.valor)
        data_formatada = imposto.data_vencimento.strftime("%d/%m/%Y")

        marcador = f"[D+{dias_atraso}]"
        titulo_aviso = "1º AVISO DE VENCIMENTO" if dias_atraso == 1 else ("2º AVISO DE VENCIMENTO" if dias_atraso == 3 else "ÚLTIMO AVISO DE REGULARIZAÇÃO")
        assunto = f"{marcador} {titulo_aviso}: {imposto.titulo} ({imposto.competencia})"
        mensagem = (
            f"🚨 {titulo_aviso}: {cliente.razao_social}\n"
            f"Identificamos que a guia de {imposto.titulo} ({imposto.competencia}) de {valor_formatado} "
            f"venceu em {data_formatada} (há {dias_atraso} dia(s)) e consta pendente no sistema.\n"
            f"Por favor, acesse seu portal ContabFlow ou solicite a 2ª via atualizada com encargos para evitar bloqueio de CND."
        )

        NotificationService._dispatch_channel(
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
        )

        notificacao = Notificacao(
            tenant_id=imposto.tenant_id,
            cliente_id=cliente.id,
            imposto_id=imposto.id,
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
            status_envio="ENVIADO",
        )
        db.add(notificacao)
        db.commit()
        db.refresh(notificacao)
        return notificacao

    @staticmethod
    def cobrar_documentos_pendentes(
        db: Session,
        cliente: Cliente,
        competencia: str,
    ) -> Notificacao:
        """Dispara cobrança automática de documentos fiscais pendentes."""
        assunto = f"Fechamento Contábil - Documentos Pendentes ({competencia})"
        mensagem = (
            f"Olá, equipe da {cliente.razao_social}!\n"
            f"Estamos iniciando o fechamento contábil da competência {competencia}. "
            f"Por favor, envie suas notas fiscais de entrada/saída, extratos bancários e comprovantes "
            f"pelo seu portal ContabFlow até o dia 10 para evitarmos penalidades."
        )

        NotificationService._dispatch_channel(
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
        )

        notificacao = Notificacao(
            tenant_id=cliente.tenant_id,
            cliente_id=cliente.id,
            canal="WHATSAPP",
            destinatario=cliente.telefone_whatsapp,
            assunto=assunto,
            mensagem=mensagem,
            status_envio="ENVIADO",
        )
        db.add(notificacao)
        db.commit()
        db.refresh(notificacao)
        return notificacao

    @staticmethod
    def executar_regua_automatica(db: Session, tenant_id: str) -> Dict[str, Any]:
        """
        Varre o banco do escritório executando a régua de cobrança:
        - D-5: Guias que vencem entre 1 e 5 dias (lembrete preventivo)
        - D-0: Guias que vencem hoje (alerta urgente de pagamento)
        - D+1: Guias vencidas não pagas (atualiza status e notifica atraso)
        """
        hoje = date.today()

        impostos_abertos = db.query(Imposto).filter(
            Imposto.tenant_id == tenant_id,
            Imposto.status.in_(["A_VENCER", "VENCIDO"]),
        ).all()

        alertas_enviados = 0
        guias_vencidas_atualizadas = 0

        for imp in impostos_abertos:
            cliente = db.query(Cliente).filter(
                Cliente.id == imp.cliente_id,
                Cliente.tenant_id == tenant_id,
            ).first()

            if not cliente or not cliente.ativo:
                continue

            dias_diferenca = (imp.data_vencimento - hoje).days

            # Caso D-0: Vence exatamente hoje
            if dias_diferenca == 0 and imp.status == "A_VENCER":
                if not NotificationService._ja_notificado_hoje(db, imp.id, "[D-0]"):
                    NotificationService.alertar_imposto_vence_hoje(db, imp, cliente)
                    alertas_enviados += 1

            # Caso D-5: Vence em breve (entre 1 e 5 dias)
            elif 1 <= dias_diferenca <= 5 and imp.status == "A_VENCER":
                if not NotificationService._ja_notificado_hoje(db, imp.id, "[D-5]"):
                    NotificationService.alertar_imposto_a_vencer(db, imp, cliente, dias_diferenca)
                    alertas_enviados += 1

            # Caso D+X: Venceu (data < hoje) - Disparos escalonados e seguros em D+1, D+3 e D+7
            elif dias_diferenca < 0:
                dias_atraso = abs(dias_diferenca)
                if imp.status == "A_VENCER":
                    imp.status = "VENCIDO"
                    db.commit()
                    guias_vencidas_atualizadas += 1

                # Dispara somente nos marcos estratégicos para prevenir denúncia de spam no WhatsApp
                if dias_atraso in (1, 3, 7):
                    marcador = f"[D+{dias_atraso}]"
                    if not NotificationService._ja_notificado_hoje(db, imp.id, marcador):
                        NotificationService.alertar_imposto_vencido(db, imp, cliente, dias_atraso)
                        alertas_enviados += 1

        return {
            "impostos_analisados": len(impostos_abertos),
            "alertas_enviados": alertas_enviados,
            "guias_vencidas_atualizadas": guias_vencidas_atualizadas,
        }

    @staticmethod
    def executar_regua_todos_escritorios(db: Session) -> Dict[str, Any]:
        """
        Executa a régua diária para todos os Escritórios (Tenants) ativos.
        Utilizado pelo CronSchedulerService às 08:00 diariamente.
        """
        escritorios = db.query(Escritorio).filter(Escritorio.ativo == True).all()  # noqa: E712

        total_escritorios = len(escritorios)
        total_analisados = 0
        total_alertas = 0
        total_vencidas = 0

        for esc in escritorios:
            try:
                res = NotificationService.executar_regua_automatica(db, esc.id)
                total_analisados += res.get("impostos_analisados", 0)
                total_alertas += res.get("alertas_enviados", 0)
                total_vencidas += res.get("guias_vencidas_atualizadas", 0)
            except Exception as err:
                logger.error(f"Erro ao executar régua para escritório {esc.nome} ({esc.id}): {err}")

        return {
            "escritorios_processados": total_escritorios,
            "impostos_analisados": total_analisados,
            "alertas_enviados": total_alertas,
            "guias_vencidas_atualizadas": total_vencidas,
        }
