# 🔒 INTEGRATED_SECURITY.md
## Políticas de Segurança Integrada & Governança Multi-Tenant
### ContabFlow All-in-One — Camada Fiscal, Mensageria WhatsApp e Helpdesk com IA

---

### 1. Escopo de Aplicação da Governança

Com a unificação dos sistemas, o modelo de isolamento estrito **Multi-Tenant baseado em `tenant_id`** torna-se o pilar inviolável de segurança de **todos** os domínios da plataforma:

1. **Camada Fiscal & Tributária:**
   * Guias de impostos (DAS, DARF, FGTS, ICMS).
   * Linhas digitáveis e chaves PIX.
   * Arquivos XML de notas fiscais (NF-e/NFC-e), extratos bancários (OFX/PDF) e comprovantes de pagamento.
2. **Camada de Atendimento & Helpdesk:**
   * Solicitações e tickets de atendimento de clientes.
   * Histórico de mensagens, áudios com transcrição e anexos.
   * Tarefas internas da equipe e atribuição de responsabilidades.
3. **Camada de Inteligência Artificial & Conhecimento:**
   * Artigos da Base de Conhecimento e procedimentos internos do escritório.
   * Rascunhos gerados por IA e histórico de revisões.
   * Vetores de embeddings na base de conhecimento.
4. **Camada de Mensageria (WhatsApp):**
   * Sessões do WhatsApp vinculadas ao escritório.
   * Histórico de mensagens trafegadas via webhook do Baileys.

---

### 2. O Padrão `Tenant Guard` (Injeção de Dependência FastAPI)

Nenhum dado é persistido ou consultado sem a validação do contexto do escritório atual.

#### 2.1. Extração e Validação do Token JWT
O token JWT assinado com algoritmo HMAC-SHA256 contém as seguintes claims estruturadas:
* `sub`: ID único do usuário autenticado.
* `tenant_id`: ID do escritório ao qual o usuário pertence.
* `role`: Papel de permissão (`ADMIN_ESCRITORIO`, `OPERADOR_ESCRITORIO`, `CLIENTE`).
* `cliente_id`: Preenchido exclusivamente quando `role == "CLIENTE"`, limitando o usuário à sua respectiva empresa.

#### 2.2. Regra de Ouro nas Consultas SQLAlchemy
Toda consulta ao banco de dados no backend deve aplicar o discriminador `tenant_id`:

```python
# Exemplo 1: Consulta no Helpdesk
solicitacao = db.query(Solicitacao).filter(
    Solicitacao.tenant_id == current_user.tenant_id,
    Solicitacao.id == solicitacao_id
).first()

if not solicitacao:
    raise HTTPException(status_code=404, detail="Solicitação não encontrada")
```

Se um usuário autenticado tentar acessar uma solicitação, guia de imposto ou rascunho de IA pertencente a outro escritório, a consulta retornará **404 Not Found**, impedindo até mesmo a inferência sobre a existência do recurso.

#### 2.3. Isolamento Específico para Clientes Externos (`role == "CLIENTE"`)
Usuários clientes possuem filtro duplo obrigatório:
```python
query = db.query(Solicitacao).filter(
    Solicitacao.tenant_id == current_user.tenant_id,
    Solicitacao.cliente_id == current_user.cliente_id
)
```

---

### 3. Princípio Human-in-the-Loop (Segurança de IA Contábil)

A emissão de pareceres técnicos, interpretações tributárias ou instruções fiscais envolve responsabilidade civil e contábil. Por esse motivo:
1. **Bloqueio de Despacho Autônomo:** O motor de IA é estritamente um **Copiloto**. Ele nunca publica respostas técnicas diretamente para o WhatsApp ou portal do cliente sem aprovação humana.
2. **Ciclo de Aprovação:**
   * O rascunho é criado com status `PENDENTE_APROVACAO`.
   * Um operador ou contador revisa, realiza as edições necessárias e clica em **Aprovar**.
   * Somente após a aprovação com registro do ID e nome do responsável, a mensagem é despachada.
3. **Anonimização e Sanitização de Prompts:** Dados altamente sensíveis (números de cartão, senhas de prefeitura e certificados digitais) são sanitizados antes do envio às APIs de LLM.

---

### 4. Segurança no Webhook do WhatsApp

O endpoint `POST /api/v1/webhooks/whatsapp` é público para recepção de eventos do Baileys, mas protegido por:
* **Chave de Segredo (`apikey`):** Validação obrigatória do header `apikey` contra `WHATSAPP_WEBHOOK_SECRET`.
* **Resolução Multi-Tenant por Telefone:** O sistema normaliza o número do remetente (E.164) e localiza a empresa cliente em seu respectivo `tenant_id`. Mensagens de números não cadastrados são registradas em quarentena para associação manual pelo contador.

---

### 5. Auditoria Imutável

Todas as operações críticas geram registros permanentes contendo:
* `timestamp` em UTC.
* `tenant_id` e `user_id` do autor da ação.
* `acao`: ex: `imposto.emitido`, `documento.aprovado`, `rascunho_ia.aprovado`, `solicitacao.resolvida`.
* Metadados em formato JSON para rastreabilidade fiscal e conformidade com a LGPD.
