# AURA CRM — Regras de Negócio

> Documento de referência de negócio. Consultar SEMPRE que for implementar nova funcionalidade ou alterar comportamento existente.
> Atualizar este documento ao introduzir ou modificar qualquer regra.
> Última atualização: 2026-06-23

---

## 1. GESTÃO DE CONTATOS

### RN-001 — Tipos de Contato
- Todo contato deve ter um tipo associado (ex: "Cliente", "Fornecedor")
- Os tipos são configuráveis pelo administrador via `system_config.customLists.contactTypes`
- O sistema inicia com os tipos padrão: `["Cliente", "Fornecedor"]`

### RN-002 — Dados Obrigatórios de Contato
- **Nome** é obrigatório
- Email, telefone, CPF/CNPJ, endereço e descrição são opcionais
- O campo `commercialContact` é um objeto opcional com `{name, phone, email}` para contato comercial secundário

### RN-003 — Contato via Integração Pagar.me
- Quando um webhook do Pagar.me é recebido, o sistema verifica se já existe um contato com o email ou CPF/CNPJ do pagante
- Se não existe, um novo contato do tipo "Cliente" é criado automaticamente com os dados do pagamento
- A transação de receita é sempre criada, independente de o contato já existir

---

## 2. PIPELINE DE VENDAS (DEALS)

### RN-004 — Estágios do Pipeline
- O pipeline segue uma progressão linear de estágios: `Lead → Proposta Enviada → Negociação → Ganha → Perdida`
- Os estágios são configuráveis pelo administrador via `system_config.customLists.salesStages`
- Um deal pode ser movido livremente entre estágios, exceto as automações abaixo

### RN-005 — Automação ao Ganhar um Deal (CRÍTICA)
Quando um deal é movido para o estágio **"Ganha"**, o sistema executa automaticamente, na ordem:

1. **Cria uma Transação de Receita:**
   - `type = 'Receita'`
   - `amount = deal.value`
   - `description = "Receita de: [deal.title]"`
   - `dealId = deal.id`
   - `contactId = deal.contactId`
   - `date = data atual`

2. **Cria um Projeto** (se ainda não existe um projeto vinculado a este deal):
   - `name = deal.title`
   - `dealId = deal.id`
   - `clientId = deal.contactId`
   - `status = 'Não Iniciado'`
   - Cria 3 stages padrão: `["Iniciação", "Execução", "Fechamento"]` com `order = 1, 2, 3`

3. **Cria uma Tarefa Inicial** no stage "Execução":
   - `name = "Início do projeto"`
   - `stageId = id do stage "Execução"`
   - `isCompleted = false`

> **Atenção:** Se o deal já possuir um projeto vinculado (dealId existe em projects), a criação de projeto e tarefa é ignorada, mas a transação de receita é sempre criada.

### RN-006 — Deal com Produto
- Um deal pode ter um `productId` associado (opcional)
- O produto não afeta o valor do deal — o valor (`deal.value`) é inserido manualmente
- O produto serve apenas para referência/contexto da venda

### RN-007 — Data de Faturamento Prevista
- O campo `predictedBillingDate` é opcional
- É usado no Dashboard para calcular "Receita Futura" (deals ganhos com data futura)

---

## 3. PROPOSTAS COMERCIAIS

### RN-008 — Estrutura de uma Proposta
- Uma proposta é vinculada a um contato do tipo Cliente (`clientId`)
- Contém uma lista de itens (`ProposalItem[]`), cada um com:
  - Produto base (referência, mas nome/descrição são copiados e editáveis)
  - Quantidade
  - Preço unitário (editável, pode diferir do produto original)
  - Preço total (calculado: quantidade × preço unitário)
- O `total` da proposta é a soma de todos os itens

### RN-009 — Status de Proposta
- Status possíveis: `Rascunho → Enviada → Aceita | Rejeitada`
- Os status são configuráveis via `system_config.customLists.proposalStatuses`
- Uma proposta aceita não gera automaticamente um deal (ação manual necessária)

### RN-010 — Geração de Proposta com IA
- O texto da proposta pode ser gerado pelo Google Gemini 2.5-Flash
- O prompt inclui: nome da empresa, dados do cliente, itens e valores da proposta
- O texto gerado (`generatedText`) é editável antes de exportar
- Requer `geminiApiKey` configurada em system_config

### RN-011 — Export de Proposta
- Proposta pode ser exportada como **PDF** (jsPDF) ou **DOCX** (docx library)
- O export inclui: cabeçalho com logo/nome da empresa, dados do cliente, tabela de itens, total, e texto gerado pela IA
- A exportação usa os dados de `system_config` para o cabeçalho

---

## 4. CONTROLE FINANCEIRO

### RN-012 — Tipos de Transação
- **Receita:** Entrada de dinheiro (vendas, serviços)
- **Despesa:** Saída de dinheiro (custos, fornecedores)
- **Investimento:** Saída para ativos/crescimento
- **Transferência entre Sócios:** Movimentação interna entre parceiros (requer `partnerId`)

### RN-013 — Vínculos de Transação
- Uma transação pode ser vinculada opcionalmente a:
  - Um contato (`contactId`) — cliente ou fornecedor
  - Um deal (`dealId`) — venda específica
  - Um sócio (`partnerId`) — obrigatório para Transferência entre Sócios

### RN-014 — Alerta de Vencimento de Despesas
- Ao entrar no Dashboard, o sistema verifica automaticamente se existem despesas com vencimento dentro de `expenseAlertThreshold` dias
- `expenseAlertThreshold` é configurado em system_config (padrão: 7 dias)
- Se existirem, um modal de alerta é exibido automaticamente com a lista de despesas

### RN-015 — Receita Futura vs Receita Realizada
- **Receita Realizada:** Transactions com `type = 'Receita'` e data no passado/hoje
- **Receita Futura:** Deals com status 'Ganha' e `predictedBillingDate` no futuro (sem transação ainda)
- **Despesa Futura:** Transactions com `type = 'Despesa'` e data no futuro

### RN-016 — Resultado Líquido
- `Resultado Líquido = Σ Receitas - Σ Despesas` no período selecionado
- Investimentos e Transferências não entram no cálculo do resultado líquido
- Calculado apenas sobre transações realizadas (não futuras)

### RN-017 — Integração Pagar.me
- Webhook recebido em `POST /api/pagarme/webhook`
- Cria transação do tipo 'Receita' automaticamente com dados do pagamento
- Evento registrado em system_logs com nível 'info' e tipo 'WEBHOOK'

---

## 5. PROJETOS

### RN-018 — Criação de Projeto
- Projetos podem ser criados manualmente ou automaticamente via deal ganho (RN-005)
- Um projeto pode ser vinculado a um deal (`dealId`) e/ou contato (`clientId`)
- Projeto sem deal é um projeto autônomo

### RN-019 — Estrutura Hierárquica de Projeto
```
Projeto
  └── Stages (Fases) — ordenadas por `order`
          └── Tasks (Tarefas) — associadas a um stage
```
- Um stage pertence a exatamente um projeto
- Uma task pertence a um projeto E a um stage

### RN-020 — Dependência entre Fases (Stages)
- Uma fase pode ter um `predecessorStageId` indicando que ela só pode iniciar após a fase predecessora
- A dependência é informativa (não bloqueia automaticamente no atual sistema)

### RN-021 — Dependência entre Tarefas (CRÍTICA)
- Uma task pode ter um `predecessorTaskId` (dependência de outra task)
- **Ao definir/alterar o predecessorTaskId de uma task:**
  - A `startDate` da task é calculada como `endDate do predecessor + 1 dia`
  - O `endDate` é recalculado com base em `durationDays`
  - **Todas as tasks sucessoras** (tasks que dependem desta) têm suas datas recalculadas recursivamente

### RN-022 — Cálculo de Datas de Tarefas
- Se `durationDays` é definido, `endDate = startDate + durationDays - 1`
- Se `startDate` e `endDate` são definidos diretamente, `durationDays` é opcional/calculado
- Tarefas com predecessor: `startDate` é determinada pelo predecessor (ver RN-021)

### RN-023 — Status de Tarefa
- Tasks têm `isCompleted: boolean` — simples toggle de conclusão
- Não há status intermediário (em andamento, bloqueada, etc.) — somente concluída/não concluída

### RN-024 — Status de Projeto
- Status: `Não Iniciado | Em Andamento | Concluído | Em Espera | Cancelado`
- O status é definido manualmente — não há cálculo automático baseado em tasks
- Projetos criados via deal ganho iniciam com status 'Não Iniciado'

### RN-025 — Produtos em Projetos
- Produtos/serviços podem ser vinculados a um projeto via `project_products`
- Cada vínculo tem quantidade e preço (que pode diferir do preço do catálogo)
- Usado para controle de recursos do projeto

### RN-026 — Gráfico Gantt
- Exibe todas as tasks do projeto em linha do tempo
- Usa `startDate` e `endDate` de cada task
- Tasks sem datas não aparecem no Gantt

---

## 6. USUÁRIOS E PERMISSÕES

### RN-027 — Modelo de Permissões
- Permissões são definidas por **grupo** (não por usuário individual)
- Cada grupo tem permissões independentes para cada página
- Granularidade: `can_view`, `can_read`, `can_edit`, `can_delete` por página

### RN-028 — Significado das Permissões por Nível
| Permissão | Significado |
|-----------|------------|
| `can_view` | Página aparece no menu/sidebar |
| `can_read` | Pode visualizar dados da página |
| `can_edit` | Pode criar e editar registros |
| `can_delete` | Pode deletar registros |

### RN-029 — Grupo Admin (Override Total)
- Usuários com `groupId = 'admin'` têm acesso total a TODAS as páginas e operações
- O override é aplicado em App.tsx antes de verificar group_permissions
- O email `flavio.nunes@defensoria.rj.def.br` sempre recebe tratamento de admin, independente do grupo

### RN-030 — Fallback de Permissões
- Se um usuário não possui registros em `group_permissions`, o sistema permite acesso a tudo EXCETO a página admin
- Este comportamento é intencional para garantir que novos usuários não fiquem totalmente bloqueados

### RN-031 — Grupos Padrão do Sistema
O sistema é inicializado (seed) com 3 grupos:

| Grupo | Acesso |
|-------|--------|
| `admin` | Completo (todas as páginas, todas as operações) |
| `vendedor` | dashboard(RW), contacts(RWD), sales(RWD), proposals(RWD), products(R) |
| `financeiro` | dashboard(RW), contacts(R), finance(RWD) |

---

## 7. CONFIGURAÇÃO DO SISTEMA

### RN-032 — Config Global (system_config)
- Existe um único registro de configuração (upsert por ID fixo)
- Campos: nome da empresa, logo (base64), CNPJ, endereço, email, telefone, geminiApiKey, expenseAlertThreshold
- `customLists` armazena as listas configuráveis em JSON: salesStages, contactTypes, proposalStatuses

### RN-033 — Listas Customizáveis
- Administrador pode adicionar/remover estágios de vendas, tipos de contato e status de proposta
- As listas são carregadas dinamicamente de `system_config.customLists`
- Alterar uma lista não afeta registros existentes (histórico preservado)

### RN-034 — Logo da Empresa
- A logo é armazenada como string base64 em `system_config.logo`
- É usada no header do sistema e nos exports de PDF/DOCX de propostas

---

## 8. AUDITORIA E LOGS

### RN-035 — Registro Obrigatório de Eventos
Os seguintes eventos DEVEM ser registrados em `system_logs`:
- Criação, atualização e exclusão de qualquer entidade (CRUD)
- Login e logout de usuários
- Recebimento e processamento de webhooks externos
- Erros de sistema

### RN-036 — Estrutura do Log
```typescript
{
  level: 'info' | 'warn' | 'error',
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'AUTH' | 'WEBHOOK' | 'SYSTEM',
  message: string,           // Descrição legível
  user_email: string,        // Quem executou a ação
  details: object            // Contexto adicional (IDs, valores, etc.)
}
```

### RN-037 — Retenção de Logs
- O endpoint retorna os últimos 250 logs
- Não há política de purge automático implementada atualmente
- Logs são ordenados por timestamp decrescente (mais recentes primeiro)

---

## 9. INTEGRAÇÕES EXTERNAS

### RN-038 — Google Gemini (IA)
- Usado exclusivamente para geração de texto de propostas comerciais
- O texto gerado é sempre editável antes do uso
- Se a API key não estiver configurada, o botão "Gerar com IA" não deve aparecer
- Modelo: `gemini-2.5-flash` (custo-benefício para geração de texto)

### RN-039 — Pagar.me (Pagamentos)
- O webhook é recebido sem validação de assinatura (risco: qualquer requisição pode criar transações)
- Dados extraídos: valor, data, descrição, email/CPF do pagante
- Transação criada com `type = 'Receita'`
- Recomendação futura: implementar validação de assinatura HMAC do Pagar.me

### RN-040 — MCP (Model Context Protocol)
- Interface para agentes de IA externos consultarem dados do CRM
- Ferramenta `execute_sql_query` permite SQL direto no D1 — **alto risco de segurança**
- Recomendação: restringir por autenticação e limitar operações (somente SELECT)

---

## 10. REGRAS DE INTERFACE E UX

### RN-041 — Sidebar Filtrada por Permissões
- A sidebar exibe apenas as páginas que o usuário tem `can_view = true`
- A página "profile" é sempre visível (não entra no sistema de permissões)

### RN-042 — Relatório Financeiro em PDF
- Gerado a partir do Dashboard
- Inclui: período selecionado, KPIs, tabela de transações detalhada
- Usa dados reais do período selecionado (não do período atual)

### RN-043 — Gráfico de Receitas vs Despesas
- Agrega transações por mês (dentro do período filtrado)
- Exibe barras lado a lado (Receita = azul, Despesa = vermelho)
- Investimentos e Transferências não aparecem no gráfico

---

## 11. REGRAS DE DADOS E CONSISTÊNCIA

### RN-044 — Serialização de Campos JSON
- Campos JSON (`commercialContact`, `items`, `customLists`, `details`) são serializados como string no D1
- O servidor (server.ts) é responsável por serializar no INSERT/UPDATE e deserializar no SELECT
- **Nunca armazenar objetos JavaScript diretamente** — sempre `JSON.stringify()` antes de salvar

### RN-045 — IDs dos Registros
- IDs são gerados no backend (server.ts) como string aleatória ou timestamp
- Frontend não deve gerar IDs — sempre deixar o backend retornar o ID criado

### RN-046 — Exclusão de Registros
- Não existe soft-delete — registros são permanentemente removidos do D1
- Não há verificação de integridade referencial automática (SQLite sem FK enforcement)
- **Atenção:** Deletar um Contact não remove automaticamente seus Deals, Transactions ou Proposals associados

### RN-047 — Schema Versioning
- A versão do schema é armazenada em `system_config.schemaVersion`
- Deve ser incrementada a cada migração de banco de dados
- Visível em Admin → Monitor DB

---

## 12. FLUXOS COMPLETOS DE NEGÓCIO

### Fluxo 1 — Prospecção até Projeto
```
1. Criar Contato (Contacts)
2. Criar Deal no estágio 'Lead' (SalesCRM)
3. Criar Proposta comercial vinculada ao contato (Proposals)
4. Atualizar Deal para 'Proposta Enviada'
5. Negociar → atualizar Deal para 'Negociação'
6. Deal ganho → atualizar para 'Ganha'
   ↓ Automaticamente:
   - Cria Transação de Receita
   - Cria Projeto com 3 fases padrão
   - Cria Tarefa inicial de Execução
7. Gerenciar Projeto com tasks e dependências (Projects)
```

### Fluxo 2 — Controle Financeiro Mensal
```
1. Registrar Despesas mensais (Finance)
2. Receber receitas via Pagar.me (automático) ou manual
3. Acessar Dashboard → visualizar resultado líquido do mês
4. Gerar PDF do relatório financeiro para arquivo
5. Verificar alertas de despesas vencendo (modal automático)
```

### Fluxo 3 — Onboarding de Novo Usuário
```
1. Admin cria User em Admin → Usuários com grupo associado
2. Usuário faz login (Google ou email/senha)
3. Sistema consulta groupId → carrega group_permissions
4. Sidebar e páginas são filtradas pelas permissões do grupo
5. Usuário edita perfil em UserProfile (nome, avatar)
```
