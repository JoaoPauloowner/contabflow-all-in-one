"""
Serviço de Agendamento em Segundo Plano (Cron Scheduler).

Executa rotinas periódicas diárias sem dependências externas pesadas:
- Disparo da Régua de Cobrança Diária às 08:00 AM (D-5, D-0 e D+1) para todos os escritórios ativos.
- Prevenção de concorrência e idempotência com controle de execução.
- Suporte a monitoramento de status e execução imediata sob demanda para testes.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.database.session import SessionLocal
from app.services.notifications import NotificationService

logger = logging.getLogger("contabflow.scheduler")


class CronSchedulerService:
    def __init__(self, target_hour: int = 8, target_minute: int = 0):
        self.target_hour = target_hour
        self.target_minute = target_minute
        self.is_running: bool = False
        self._is_executing: bool = False
        self._task: Optional[asyncio.Task] = None
        self.last_run_at: Optional[datetime] = None
        self.next_run_at: Optional[datetime] = None
        self.last_run_stats: Optional[Dict[str, Any]] = None

    def calcular_proxima_execucao(self, agora: Optional[datetime] = None) -> datetime:
        agora = agora or datetime.now()
        alvo_hoje = agora.replace(hour=self.target_hour, minute=self.target_minute, second=0, microsecond=0)
        if agora >= alvo_hoje:
            return alvo_hoje + timedelta(days=1)
        return alvo_hoje

    async def _loop(self):
        logger.info(f"⏰ [CronScheduler] Iniciado. Alvo diário: {self.target_hour:02d}:{self.target_minute:02d}")
        while self.is_running:
            self.next_run_at = self.calcular_proxima_execucao()
            segundos_espera = max(1.0, (self.next_run_at - datetime.now()).total_seconds())
            logger.info(f"⏰ [CronScheduler] Próxima execução em {segundos_espera:.1f}s ({self.next_run_at.isoformat()})")

            try:
                await asyncio.sleep(segundos_espera)
                if not self.is_running:
                    break
                await self.executar_ciclo()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ [CronScheduler] Erro no loop: {e}", exc_info=True)
                await asyncio.sleep(60)

    async def executar_ciclo(self) -> Dict[str, Any]:
        """Executa a régua de cobrança automática com lock de proteção contra concorrência."""
        if self._is_executing:
            logger.warning("⚠️ [CronScheduler] Ciclo ignorado: execução já em andamento.")
            return {"status": "ignorado", "motivo": "execucao_em_andamento"}

        self._is_executing = True
        logger.info("🔔 [CronScheduler] Disparando régua automática diária...")
        self.last_run_at = datetime.now()
        db = SessionLocal()
        try:
            stats = NotificationService.executar_regua_todos_escritorios(db)
            self.last_run_stats = stats
            logger.info(f"✅ [CronScheduler] Ciclo concluído: {stats}")
            return stats
        except Exception as e:
            logger.error(f"❌ [CronScheduler] Falha no ciclo: {e}", exc_info=True)
            falha = {"status": "erro", "detalhe": str(e)}
            self.last_run_stats = falha
            return falha
        finally:
            self._is_executing = False
            db.close()

    async def start(self):
        """Inicia a tarefa assíncrona em segundo plano."""
        if self.is_running:
            return
        self.is_running = True
        self.next_run_at = self.calcular_proxima_execucao()
        self._task = asyncio.create_task(self._loop())
        logger.info("⏰ [CronScheduler] Background task ativada com sucesso.")

    async def stop(self):
        """Finaliza a tarefa assíncrona com cancelamento gracioso."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("⏰ [CronScheduler] Background task finalizada.")

    def get_status(self) -> Dict[str, Any]:
        """Retorna o status atual do serviço de agendamento."""
        return {
            "is_running": self.is_running,
            "target_time": f"{self.target_hour:02d}:{self.target_minute:02d}",
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            "last_run_stats": self.last_run_stats,
        }


# Instância Singleton global do agendador
cron_scheduler = CronSchedulerService(target_hour=8, target_minute=0)
