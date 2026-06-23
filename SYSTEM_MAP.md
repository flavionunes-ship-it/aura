# AURA CRM — Mapeamento do Sistema

> Documento de referência técnica. Consultar SEMPRE antes de implementar ou modificar qualquer funcionalidade.
> Atualizar este documento após cada mudança estrutural.
> Última atualização: 2026-06-23 (revisão pós-melhorias)

---

## 1. VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                   │
│  Vite 6 + TypeScript 5.8 + Tailwind CSS 3               │
│  Porta 3000                                             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (supabase proxy)
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (Express 5)                    │
│  server.ts — Node.js                                    │
│  Rotas: /api/*                                          │
└────────────────────────┬────────────────────────────────┘
                         │ D1 API
┌────────────────────────▼────────────────────────────────┐
│              DATABASE (Cloudflare D1 / SQLite)           │
│  14 tabelas — schema versionado via system_config       │
└─────────────────────────────────────────────────────────┘
```

**Stack:**
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 19.1.1 |
| Build | Vite | 6.2 |
| Linguagem | TypeScript | 5.8 |
| Estilos | Tailwind CSS | 3 |
| Backend | Express | 5.2.1 |
| Banco | Cloudflare D1 (SQLite) | — |
| Auth | Supabase (proxy local) | 2.45.4 |
| IA | Google Gemini 2.5-Flash | @google/genai 1.19.0 |
| Gráficos | Recharts | 3.2.1 |
| Ícones | Lucide-React | 1.21.0 |
| PDF Export | jsPDF + jsPDF-AutoTable | 2.5.1 / 3.8.2 |
| DOCX Export | docx + file-saver | 8.5.0 / 2.0.5 |

---

## 2. ESTRUTURA DE DIRETÓRIOS

```
/aura
├── index.html                  # Template HTML raiz
├── index.tsx                   # Entry point React (ReactDOM.render)
├── App.tsx                     # Router principal + Layout (Sidebar, Header, Footer)
├── types.ts                    # Todas as interfaces TypeScript
├── constants.tsx               # Ícones, cores, navegação
├── server.ts                   # Backend Express completo
├── vite.config.ts              # Config build/dev
├── tsconfig.json               # Config TypeScript
├── package.json                # Dependências
│
├── context/
│   ├── AppContext.tsx           # Estado global: dados + CRUD de todas as entidades
│   └── AuthContext.tsx          # Estado de autenticação (user, session)
│
├── services/
│   └── supabase.ts             # Proxy Supabase→REST: converte chamadas supabase em /api/*
│
├── pages/
│   ├── Dashboard.tsx           # KPIs, gráficos, relatório PDF
│   ├── Contacts.tsx            # CRUD de clientes/fornecedores
│   ├── SalesCRM.tsx            # Kanban de oportunidades de venda
│   ├── Finance.tsx             # Controle financeiro (receitas/despesas/investimentos)
│   ├── Proposals.tsx           # Propostas comerciais com geração IA
│   ├── Projects.tsx            # Gerenciamento de projetos + Gantt
│   ├── Products.tsx            # Catálogo de produtos/serviços
│   ├── Admin.tsx               # Administração: config, usuários, permissões, logs
│   ├── Login.tsx               # Autenticação Google + email/senha
│   └── UserProfile.tsx         # Perfil do usuário
│
├── components/
│   ├── Card.tsx                # Card de estatística (título, valor, icon, footer)
│   ├── Modal.tsx               # Dialog genérico com overlay
│   └── Spinner.tsx             # Loading (sm, md, lg)
│
└── hooks/
    └── useLocalStorage.ts      # Hook para persistência local
```

---

## 3. BANCO DE DADOS — SCHEMA COMPLETO

### 3.1 Tabelas e Responsabilidades

| Tabela | Responsabilidade | Campos Principais |
|--------|-----------------|-------------------|
| `system_config` | Configuração global do sistema | id, name, logo, cnpj, address, email, phone, expenseAlertThreshold, customLists (JSON), schemaVersion |
| `contacts` | Clientes e fornecedores | id, name, email, phone, type, address, cpfCnpj, description, commercialContact (JSON) |
| `products` | Catálogo de produtos/serviços | id, name, description, price |
| `deals` | Oportunidades de vendas (pipeline) | id, title, contactId, productId, value, status, predictedBillingDate |
| `transactions` | Movimentações financeiras | id, date, description, amount, type, dealId, contactId, partnerId |
| `partners` | Sócios da empresa | id, name |
| `proposals` | Propostas comerciais | id, clientId, items (JSON), total, generatedText, status, date |
| `projects` | Projetos | id, dealId, clientId, name, status, businessCase, projectManager, startDate, endDate |
| `project_stages` | Fases de projeto (Kanban de tarefas) | id, projectId, name, order, predecessorStageId |
| `project_tasks` | Tarefas dentro de fases | id, projectId, stageId, name, startDate, endDate, durationDays, isCompleted, predecessorTaskId |
| `project_products` | Produtos vinculados ao projeto | id, projectId, productId, quantity, price |
| `users` | Usuários do sistema | id, name, email, groupId |
| `user_groups` | Grupos de acesso | id, name |
| `group_permissions` | Permissões por página por grupo | id, groupId, page, can_view, can_read, can_edit, can_delete |
| `system_logs` | Auditoria centralizada | id, timestamp, level, type, message, user_email, details (JSON) |

### 3.2 Diagrama de Relacionamentos

```
contacts ──────────────────────────────────────────────────┐
    │                                                       │
    │ (contactId)                                           │
    ▼                                                       │
  deals ──────────── products (productId)                   │
    │                                                       │
    │ (dealId)                                              │
    ▼                                                       │
 projects ──── contacts (clientId)                          │
    │                                                       │
    ├── project_stages (projectId)                          │
    │       │                                               │
    │       └── project_tasks (stageId)                     │
    │               │ predecessorTaskId (self-ref)          │
    │                                                       │
    ├── project_products (projectId)                        │
    │       └── products (productId)                        │
    │                                                       │
transactions ── deals (dealId)                              │
             ── contacts (contactId) ◄──────────────────────┘
             ── partners (partnerId)

proposals ── contacts (clientId)

users ── user_groups (groupId)
user_groups ── group_permissions (groupId)
```

### 3.3 Campos JSON (armazenados como texto serializado)

| Tabela | Campo | Estrutura |
|--------|-------|-----------|
| `contacts` | `commercialContact` | `{name, phone, email}` |
| `proposals` | `items` | `Array<{productId, name, description, quantity, unitPrice, totalPrice}>` |
| `system_config` | `customLists` | `{salesStages[], contactTypes[], proposalStatuses[]}` |
| `system_logs` | `details` | Objeto livre com contexto do evento |

---

## 4. ENDPOINTS DA API (server.ts)

### 4.1 CRUD Dinâmico

Todos os recursos seguem o mesmo padrão:

```
GET    /api/{resource}              Lista (suporta query params para filtros)
POST   /api/{resource}              Cria novo registro
PUT    /api/{resource}/:id          Atualiza registro
DELETE /api/{resource}/:id          Deleta registro
```

**Query params suportados:**
- `?field=value` — filtra por campo
- `?_limit=N` — limita resultados
- `?_single=true` — retorna objeto único (não array)

**Recursos disponíveis:**

| Rota | Tabela D1 |
|------|-----------|
| `/api/system-config` | `system_config` |
| `/api/contacts` | `contacts` |
| `/api/products` | `products` |
| `/api/deals` | `deals` |
| `/api/transactions` | `transactions` |
| `/api/partners` | `partners` |
| `/api/proposals` | `proposals` |
| `/api/projects` | `projects` |
| `/api/project-stages` | `project_stages` |
| `/api/project-tasks` | `project_tasks` |
| `/api/project-products` | `project_products` |
| `/api/users` | `users` |
| `/api/user-groups` | `user_groups` |
| `/api/group-permissions` | `group_permissions` |

> **Convenção:** Rotas usam hífen (`project-stages`), tabelas usam underscore (`project_stages`).

### 4.2 Autenticação

```
POST   /api/auth/login              Login (Google OAuth ou email+senha)
POST   /api/auth/logout             Logout (limpa sessão)
GET    /api/auth/session            Sessão atual + permissions do usuário
POST   /api/auth/profile            Atualiza nome/avatar do usuário
```

### 4.3 Monitoramento e Logs

```
GET    /api/db-monitor              Status D1: tabelas, linhas, tamanho, schema version, latência
GET    /api/system-logs             Últimos 250 logs de auditoria
POST   /api/system-logs             Registra novo evento de auditoria
```

### 4.4 Integrações Externas

```
POST   /api/pagarme/webhook         Webhook Pagar.me: cria transação + contato automaticamente
POST   /api/mcp                     Interface JSON-RPC para ferramentas de IA (MCP)
```

### 4.5 Ferramentas MCP Disponíveis

| Ferramenta | Descrição |
|-----------|-----------|
| `get_contacts` | Lista contatos |
| `get_deals` | Lista oportunidades |
| `get_transactions` | Lista transações financeiras |
| `execute_sql_query` | Executa query SQL direta no D1 |

---

## 5. ESTADO GLOBAL (AppContext)

O `AppContext` centraliza todos os dados e operações CRUD. **Nunca acesse a API diretamente nas páginas** — use sempre o contexto.

### 5.1 Dados Disponíveis

```typescript
// Configuração
systemConfig: SystemConfig

// Entidades principais
contacts: Contact[]
products: Product[]
deals: Deal[]
transactions: Transaction[]
partners: Partner[]
proposals: Proposal[]
projects: Project[]
projectStages: ProjectStage[]
projectTasks: ProjectTask[]
projectProducts: ProjectProduct[]

// Listas dinâmicas (configuráveis via Admin)
salesStages: string[]
contactTypes: string[]
proposalStatuses: string[]
```

### 5.2 Operações CRUD por Entidade

Todas as entidades expõem: `add*()`, `update*()`, `delete*()`

Exceções/especiais:
- `updateSystemConfig()` — upsert (cria se não existe)
- `addPartner()` / `deletePartner()` — sem update (imutável após criação)

### 5.3 Automações no AppContext

**Ao marcar Deal como "Ganha" (`updateDeal` com status WON):**
1. Cria `Transaction` com `type = 'Receita'` e valor do deal
2. Se projeto não existe para o deal: cria `Project` com 3 stages padrão (Iniciação, Execução, Fechamento)
3. Cria `ProjectTask` inicial na fase "Execução"

**Ao atualizar `predecessorTaskId` de uma task:**
- Recalcula recursivamente `startDate`/`endDate` de todas as tasks sucessoras

**Ao atualizar `durationDays` de uma task:**
- Calcula e preenche `endDate` automaticamente

---

## 6. SERVIÇO SUPABASE (services/supabase.ts)

Este arquivo é um **proxy** — traduz a API Supabase para chamadas REST ao backend local.

### 6.1 Fluxo de Chamada

```
Página/Contexto
    └─ supabase.from('tabela').select().eq('campo', valor)
           └─ ApiQueryBuilder (supabase.ts)
                  └─ GET /api/tabela?campo=valor
                         └─ server.ts (Express)
                                └─ Cloudflare D1 SQL
```

### 6.2 Mapeamento de Nomes

O proxy converte automaticamente `_` para `-`:
```
contacts        → /api/contacts
project_stages  → /api/project-stages
project_tasks   → /api/project-tasks
group_permissions → /api/group-permissions
```

### 6.3 Métodos Suportados

```typescript
supabase.from(table)
  .select(columns?)           // GET /api/{table}
  .eq(field, value)           // → ?field=value (querystring)
  .limit(n)                   // → ?_limit=n
  .single()                   // → ?_single=true
  .insert(data)               // POST /api/{table}
  .update(data)               // PUT /api/{table}/:id
  .delete()                   // DELETE /api/{table}/:id
  .upsert(data)               // POST ou PUT dependendo de id presente
```

---

## 7. SISTEMA DE AUTENTICAÇÃO E PERMISSÕES

### 7.1 Fluxo de Login

```
1. Login (Google ou email/senha) via Login.tsx
2. POST /api/auth/login → server.ts valida credenciais
3. Usuário localizado/criado em tabela 'users'
4. groupId do usuário → consulta 'group_permissions'
5. GET /api/auth/session retorna user + permissions[]
6. AuthContext armazena user/session
7. App.tsx usa checkPermission() para filtrar sidebar e conteúdo
```

### 7.2 Estrutura de Permissões

```typescript
// Cada permissão é por página
{
  page: 'dashboard' | 'contacts' | 'sales' | 'products' 
       | 'finance' | 'proposals' | 'projects' | 'admin',
  can_view: boolean,
  can_read: boolean,
  can_edit: boolean,
  can_delete: boolean
}
```

### 7.3 Grupos Padrão (Seed)

| Grupo | Pages com acesso total |
|-------|----------------------|
| `admin` | Todas (dashboard, contacts, sales, proposals, projects, products, finance, admin) |
| `vendedor` | dashboard(RW), contacts(RWD), sales(RWD), proposals(RWD), products(R) |
| `financeiro` | dashboard(RW), contacts(R), finance(RWD) |

### 7.4 Override de Admin

O email `flavio.nunes@defensoria.rj.def.br` sempre recebe acesso total (hardcoded em App.tsx).
Se `user.groupId === 'admin'`, acesso total independente de permissões.

---

## 8. TIPOS TYPESCRIPT (types.ts)

### 8.1 Enums Principais

```typescript
type Page = 'dashboard' | 'contacts' | 'sales' | 'products' 
          | 'finance' | 'proposals' | 'projects' | 'profile' | 'admin'

// Status de Deal (pipeline de vendas)
'Lead' | 'Proposta Enviada' | 'Negociação' | 'Ganha' | 'Perdida'

// Tipo de Contato
'Cliente' | 'Fornecedor'  // + customizáveis via Admin

// Tipo de Transação
'Receita' | 'Despesa' | 'Investimento' | 'Transferência entre Sócios'

// Status de Proposta
'Rascunho' | 'Enviada' | 'Aceita' | 'Rejeitada'  // + customizáveis via Admin

// Status de Projeto
'Não Iniciado' | 'Em Andamento' | 'Concluído' | 'Em Espera' | 'Cancelado'
```

### 8.2 Interfaces Principais

```typescript
interface SystemConfig {
  name, logo, cnpj, address, email, phone,
  geminiApiKey, expenseAlertThreshold, customLists
}

interface Contact {
  id, name, email, phone, type, address, cpfCnpj, description, commercialContact
}

interface Product { id, name, description, price }

interface Deal {
  id, title, contactId, productId, value, status, predictedBillingDate
}

interface Transaction {
  id, date, description, amount, type, dealId, contactId, partnerId
}

interface Partner { id, name }

interface Proposal {
  id, clientId, items[], total, generatedText, status, date
}

interface ProposalItem {
  productId, name, description, quantity, unitPrice, totalPrice
}

interface Project {
  id, dealId, clientId, name, status, businessCase, projectManager, startDate, endDate
}

interface ProjectStage {
  id, projectId, name, order, predecessorStageId
}

interface ProjectTask {
  id, projectId, stageId, name, startDate, endDate, durationDays, isCompleted, predecessorTaskId
}

interface ProjectProduct {
  id, projectId, productId, quantity, price
}

interface User { id, name, email, groupId }

interface UserGroup { id, name }

interface GroupPermission {
  id, groupId, page, can_view, can_read, can_edit, can_delete
}

interface SystemLog {
  id, timestamp, level, type, message, user_email, details
}
```

---

## 9. PÁGINAS — RESPONSABILIDADES DETALHADAS

### Dashboard (Dashboard.tsx)
- **Dados:** Agrega transactions por tipo e período
- **KPIs:** Deals abertos, receita, despesas, resultado líquido, propostas ativas, receita futura, despesas futuras
- **Filtros:** Por mês atual / ano atual / período customizado
- **Gráfico:** Recharts — BarChart com receitas vs despesas por mês
- **Export:** PDF com jsPDF (relatório financeiro completo)
- **Alerta:** Modal automático ao entrar na página se há despesas vencendo em X dias (configurado em system_config.expenseAlertThreshold)

### Contacts (Contacts.tsx)
- **CRUD:** Modal com form para criar/editar
- **Campos:** nome, email, telefone, tipo, CPF/CNPJ, endereço, descrição, contato comercial (objeto)
- **Abas:** Por tipo de contato (dinâmico via customLists)
- **Validação:** CPF/CNPJ opcional

### SalesCRM (SalesCRM.tsx)
- **Layout:** Kanban com drag-and-drop entre colunas
- **Colunas:** Dinâmicas via `salesStages` (customLists)
- **Cards:** Título, cliente, valor, data prevista
- **Criação:** Modal com seleção de contato, produto, valor e data
- **Automação:** Deal → WON dispara criação de Transação + Projeto (ver AppContext)

### Finance (Finance.tsx)
- **CRUD:** Criar/editar/deletar transações
- **Tipos:** Receita, Despesa, Investimento, Transferência entre Sócios
- **Vínculos:** Opcional — contactId, dealId, partnerId
- **Listagem:** Com filtros e totalizações por tipo
- **Integração:** Pagar.me webhook cria transações automaticamente

### Proposals (Proposals.tsx)
- **Criação:** Seleção de cliente + itens (produto, quantidade, preço editável)
- **IA:** Botão "Gerar com IA" → chama Google Gemini 2.5-Flash com contexto da proposta
- **Export:** PDF (jsPDF) ou DOCX (docx library)
- **Status:** Rascunho → Enviada → Aceita/Rejeitada
- **Preview:** Visualização formatada antes de exportar

### Projects (Projects.tsx)
- **Criação:** Manual ou automática via deal ganho
- **Estrutura:** Projeto → Stages → Tasks
- **Kanban de Tasks:** Arrastar tasks entre stages
- **Gantt:** Gráfico de barras temporais com Recharts
- **Dependências:** Tasks com predecessorTaskId (recálculo automático de datas)
- **Produtos:** Vincular produtos/serviços ao projeto
- **Qualidade:** Critérios por task

### Products (Products.tsx)
- **CRUD simples:** Nome, descrição, preço
- **Uso:** Referenciado em Deals, Proposals e Projects

### Admin (Admin.tsx)
- **Config Sistema:** Nome empresa, logo, CNPJ, endereço, contatos, alert threshold
- **Sócios:** CRUD de partners (usados em transações de transferência)
- **Usuários:** CRUD com associação a grupo
- **Grupos/Permissões:** Matrix visual: grupo × página × (view/read/edit/delete)
- **Monitor DB:** Tabelas, linhas, tamanho, latência, schema version
- **Logs:** Busca e filtro em system_logs
- **Pagar.me Simulator:** Testa webhook com payload customizável

### Login (Login.tsx)
- Google OAuth (via Supabase)
- Email + senha (fallback local)
- Redireciona automaticamente se já logado

### UserProfile (UserProfile.tsx)
- Editar nome, avatar
- Deletar conta (com modal de confirmação)

---

## 10. COMPONENTES COMPARTILHADOS

### Card.tsx
```typescript
<Card title="Receita" value="R$ 10.000" icon={<Icon/>} footer="vs mês anterior" />
```

### Modal.tsx
```typescript
<Modal isOpen={bool} onClose={fn} title="Título">
  {/* conteúdo */}
</Modal>
```

### Spinner.tsx
```typescript
<Spinner size="sm" | "md" | "lg" />
```

---

## 11. INTEGRAÇÃO PAGAR.ME

**Webhook:** `POST /api/pagarme/webhook`

**Fluxo:**
1. Pagar.me envia evento de pagamento
2. server.ts extrai dados do payload
3. Verifica se contato existe (por email ou CPF/CNPJ)
4. Se não existe, cria novo contato automaticamente
5. Cria transação do tipo 'Receita' com dados do pagamento
6. Registra evento em system_logs

---

## 12. INTEGRAÇÕES DE IA

### Google Gemini (Propostas)
- **Model:** gemini-2.5-flash
- **Trigger:** Botão "Gerar com IA" em Proposals.tsx
- **Input:** Dados do cliente + itens da proposta + config da empresa
- **Output:** Texto profissional em português da proposta comercial
- **Config:** `geminiApiKey` armazenada em system_config

### MCP (Model Context Protocol)
- **Endpoint:** `POST /api/mcp` (JSON-RPC)
- **Uso:** Ferramentas para agentes de IA consultarem dados do CRM
- **Ferramentas:** get_contacts, get_deals, get_transactions, execute_sql_query

---

## 13. SISTEMA DE LOGS (Auditoria)

Todos os eventos CRUD e erros são registrados em `system_logs`.

```typescript
{
  level: 'info' | 'warn' | 'error',
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'AUTH' | 'WEBHOOK' | ...,
  message: string,
  user_email: string,
  details: object  // Contexto específico do evento
}
```

Logs são visíveis em Admin → Logs (últimos 250).

---

## 14. PALETA DE CORES (Tailwind)

| Uso | Classe Tailwind | Hex |
|-----|----------------|-----|
| Principal (botões, links) | `blue-500` customizado | `#1a4870` |
| Hover | `blue-600` customizado | `#113350` |
| Active | `blue-700` customizado | `#0d253a` |
| Background claro | `blue-50`, `blue-100` | variações pastel |

---

## 15. ARQUIVOS ADICIONADOS / ALTERADOS (pós-melhorias 2026-06-23)

| Arquivo | Mudança |
|---------|---------|
| `.env` | Credenciais Cloudflare D1 (não commitar) |
| `.env.example` | Template de variáveis de ambiente |
| `server.ts` | Env vars, sessões múltiplas (Map), auth middleware, schema completo, ALTER TABLE migrations, geração de ID no POST, log de DELETE |
| `services/supabase.ts` | Token em localStorage, header `X-Auth-Token` em todas as requests, `replaceAll`, polling 5min |
| `components/Toast.tsx` | **NOVO** — sistema de toast notifications (ToastProvider + useToast) |
| `context/AppContext.tsx` | useToast em todas as operações, `createProjectWithStages` (lógica unificada), `computeTaskChain` (sem chamadas API recursivas), nome inicial corrigido |
| `App.tsx` | ToastProvider no root |
| `pages/Contacts.tsx` | Campo de busca por nome/email/telefone/CPF |
| `pages/Products.tsx` | Campo de busca por nome/descrição |
| `pages/Finance.tsx` | Campo de busca em lançamentos |
| `pages/SalesCRM.tsx` | alert() → showToast |
| `pages/Projects.tsx` | alert() → showToast |
| `pages/Proposals.tsx` | alert() → showToast |
| `pages/UserProfile.tsx` | alert() → showToast |

## 16. CHECKLIST — AO IMPLEMENTAR NOVA FUNCIONALIDADE

- [ ] Definir interface TypeScript em `types.ts`
- [ ] Adicionar tabela no schema D1 (se nova entidade)
- [ ] Adicionar rota no `server.ts` (se necessário — CRUD dinâmico já cobre maioria)
- [ ] Adicionar estado e operações CRUD no `AppContext.tsx`
- [ ] Criar/atualizar página em `pages/`
- [ ] Adicionar entrada de navegação em `constants.tsx` (se nova página)
- [ ] Configurar permissão da nova página em `group_permissions`
- [ ] Adicionar `can_view/read/edit/delete` no seed de permissões
- [ ] Registrar eventos relevantes em `system_logs`
- [ ] Atualizar este documento (`SYSTEM_MAP.md`)
- [ ] Atualizar `BUSINESS_RULES.md` se houver nova regra de negócio

---

## 16. CHECKLIST — AO MODIFICAR FUNCIONALIDADE EXISTENTE

- [ ] Verificar impacto no AppContext (estado compartilhado)
- [ ] Verificar se a tabela D1 precisa de migração (adicionar campo, etc.)
- [ ] Verificar se a interface TypeScript em `types.ts` precisa atualização
- [ ] Verificar rotas afetadas em `server.ts`
- [ ] Checar impacto em outras páginas que usam a mesma entidade
- [ ] Verificar se automações no AppContext são afetadas (ex: deal WON)
- [ ] Testar fluxo de permissões se mudou acesso a dados
- [ ] Atualizar este documento se a mudança for estrutural
