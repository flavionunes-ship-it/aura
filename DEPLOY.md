# Deploy do Aura CRM no Coolify

## Visão geral

O Aura CRM é servido por um único processo Node.js que:

- Em **produção**: serve o build estático do React (`dist/`) e as rotas `/api/*` via Express
- Usa `NODE_ENV=production` para desligar o servidor Vite de desenvolvimento
- Escuta na porta `3000` (configurável pela variável `PORT`)

---

## 1. Pré-requisito: criar o repositório Git

O projeto ainda não tem git. Antes de qualquer coisa, inicialize e envie para o GitHub/GitLab/Gitea.

```bash
# Na pasta raiz do projeto
git init
git add .
git commit -m "feat: Aura CRM initial commit"

# Crie um repositório vazio no GitHub (sem README, sem .gitignore)
git remote add origin https://github.com/SEU-USUARIO/aura-crm.git
git branch -M main
git push -u origin main
```

> **Não commite o arquivo `.env`!** Ele já está no `.gitignore`.  
> As credenciais serão configuradas como variáveis de ambiente no Coolify.

---

## 2. Arquivos adicionados ao projeto

Os arquivos abaixo foram criados e já fazem parte do repositório:

| Arquivo | Finalidade |
|---------|-----------|
| `Dockerfile` | Build multi-stage: compila o frontend + backend e gera uma imagem enxuta para produção |
| `.dockerignore` | Exclui `node_modules`, `.env` e arquivos de documentação da imagem |

---

## 3. Configurar o Coolify

### 3.1 Criar novo recurso

1. Abra o painel do Coolify → **Projects** → selecione ou crie um projeto
2. Clique em **+ New Resource** → **Application**
3. Escolha a origem: **GitHub / GitLab / Gitea** e autorize se necessário
4. Selecione o repositório `aura-crm` e a branch `main`

### 3.2 Configurar o build

Na tela de configuração da aplicação:

| Campo | Valor |
|-------|-------|
| **Build Pack** | `Dockerfile` |
| **Dockerfile Location** | `./Dockerfile` _(padrão, não precisa mudar)_ |
| **Port** | `3000` |

> Coolify detecta o `Dockerfile` automaticamente se você selecionar "Dockerfile" como Build Pack.

### 3.3 Variáveis de ambiente

Vá na aba **Environment Variables** e adicione todas as variáveis abaixo.

#### Variáveis de BUILD (marcadas como "Build Variable" no Coolify)

Essas são injetadas no `Dockerfile` como `--build-arg` e ficam embutidas no bundle do frontend.

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Chave da API do Google Gemini (usada na geração de propostas com IA) |

> No Coolify, marque essa variável como **"Is Build Variable?"** para que fique disponível em tempo de build como `ARG`.

#### Variáveis de RUNTIME (padrão — disponíveis apenas no container em execução)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `CF_ACCOUNT_ID` | ID da sua conta Cloudflare | `abc123...` |
| `CF_DATABASE_ID` | ID do banco D1 no Cloudflare | `def456...` |
| `CF_API_TOKEN` | Token da API Cloudflare com permissão ao D1 | `xyz789...` |
| `SESSION_SECRET` | String aleatória para assinar sessões (mínimo 32 chars) | `openssl rand -hex 32` |
| `NODE_ENV` | Modo de execução | `production` |
| `PORT` | Porta que o servidor escuta | `3000` |

Para gerar um `SESSION_SECRET` seguro:
```bash
openssl rand -hex 32
```

### 3.4 Domínio

1. Na aba **Domains**, adicione seu domínio (ex.: `crm.suaempresa.com.br`)
2. Ative **HTTPS** — Coolify provisiona o certificado Let's Encrypt automaticamente
3. Salve

---

## 4. Fazer o primeiro deploy

1. Clique em **Deploy** (ou **Save and Deploy**)
2. Acompanhe o log de build — ele executará:
   ```
   docker build --build-arg GEMINI_API_KEY=... -t aura-crm .
   ```
3. O processo de build tem dois estágios:
   - **Stage 1 (builder):** `npm ci` → `npm run build` (Vite + esbuild)
   - **Stage 2 (runner):** copia `dist/` + instala apenas dependências de produção
4. Quando aparecer **"Running"**, acesse o domínio configurado

---

## 5. Verificar se está funcionando

Acesse as seguintes URLs após o deploy:

| URL | Esperado |
|-----|---------|
| `https://seu-dominio.com` | Tela de login do Aura CRM |
| `https://seu-dominio.com/api/auth/login` | `{"error":"Method Not Allowed"}` ou 405 (rota protegida, mas ativa) |

Se a página carregar em branco, abra o DevTools → Console e verifique erros de CORS ou variável de ambiente faltando.

---

## 6. Atualizar após mudanças no código

```bash
git add .
git commit -m "feat: sua melhoria"
git push origin main
```

Com o **Auto Deploy** ativado no Coolify (padrão), o push em `main` dispara um novo build automaticamente. Caso esteja desativado, clique em **Redeploy** no painel.

---

## 7. Referência rápida de variáveis

```env
# === BUILD TIME (marcar como Build Variable no Coolify) ===
GEMINI_API_KEY=sua_chave_aqui

# === RUNTIME ===
CF_ACCOUNT_ID=seu_account_id
CF_DATABASE_ID=seu_database_id
CF_API_TOKEN=seu_api_token
SESSION_SECRET=string_aleatoria_32_chars_minimo
NODE_ENV=production
PORT=3000
```

---

## 8. Troubleshooting

### Build falha com "GEMINI_API_KEY is not defined"
→ A variável `GEMINI_API_KEY` não foi marcada como **Build Variable**. No Coolify, edite a variável e ative a opção "Is Build Variable?".

### API retorna 500 em todas as rotas
→ Verifique se `CF_ACCOUNT_ID`, `CF_DATABASE_ID` e `CF_API_TOKEN` estão corretos. O log do container mostrará:
```
ERRO: Variáveis de ambiente CF_ACCOUNT_ID, CF_DATABASE_ID e CF_API_TOKEN são obrigatórias.
```

### Login não funciona / sessão some ao reiniciar
→ `SESSION_SECRET` não foi configurada. O token de sessão depende dessa variável para ser válido.

### Container inicia mas a página dá 404
→ O build do Vite pode ter falhado silenciosamente. Verifique nos logs se a pasta `dist/` foi criada e contém `index.html`.
