import 'dotenv/config';
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// Cloudflare D1 REST API Credentials — carregadas do arquivo .env
const ACCOUNT_ID  = process.env.CF_ACCOUNT_ID  || "";
const DATABASE_ID = process.env.CF_DATABASE_ID  || "";
const API_TOKEN   = process.env.CF_API_TOKEN    || "";

if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
  console.error("ERRO: Variáveis de ambiente CF_ACCOUNT_ID, CF_DATABASE_ID e CF_API_TOKEN são obrigatórias.");
  console.error("Crie o arquivo .env baseado no .env.example e reinicie o servidor.");
}

// ─── Session Store ───────────────────────────────────────────────────────────
// Map<token, sessionData> — isolamento real entre usuários
const sessions = new Map<string, any>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getSessionFromRequest(req: express.Request): any | null {
  const token = req.headers["x-auth-token"] as string;
  if (!token) return null;
  return sessions.get(token) || null;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Não autenticado. Faça login novamente." });
    return;
  }
  next();
}

// ─── Logging ─────────────────────────────────────────────────────────────────
async function logEvent(
  level: "INFO" | "WARN" | "ERROR",
  type: "Sistema" | "IA" | "D1" | "API" | "MCP" | "Ação do Usuário",
  message: string,
  userEmail: string = "",
  details: string = ""
) {
  const id = `log_${crypto.randomBytes(5).toString("hex")}_${Date.now()}`;
  const timestamp = new Date().toISOString();
  console.log(`[${level}] [${type}] ${message}${userEmail ? ` (${userEmail})` : ""}`);
  try {
    await queryD1(
      `INSERT INTO system_logs (id, timestamp, level, type, message, user_email, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, timestamp, level, type, message, userEmail, details]
    );
  } catch {
    // Log failures são silenciosos para não travar o request principal
  }
}

// ─── D1 Query ─────────────────────────────────────────────────────────────────
async function queryD1(sql: string, params: any[] = []): Promise<any[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({ sql, params })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare D1 HTTP Error ${res.status}: ${errText}`);
    }

    const payload: any = await res.json();
    if (!payload.success) {
      throw new Error(`D1 API Error: ${JSON.stringify(payload.errors)}`);
    }

    const resultObj = Array.isArray(payload.result) ? payload.result[0] : payload.result;
    return resultObj?.results || [];
  } catch (err: any) {
    console.error(`D1 Error — SQL: "${sql}" | Params: ${JSON.stringify(params)} | ${err.message}`);
    throw err;
  }
}

// ─── Schema Setup ─────────────────────────────────────────────────────────────
async function initializeSchema() {
  console.log("Verificando schema do Cloudflare D1...");
  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY,
        name TEXT,
        logo TEXT,
        cnpj TEXT,
        address TEXT,
        email TEXT,
        phone TEXT,
        expenseAlertThreshold REAL,
        customLists TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        type TEXT,
        address TEXT,
        cpfCnpj TEXT,
        description TEXT,
        service TEXT,
        commercialContact TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL
      );`,
      `CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        contactId TEXT,
        productId TEXT,
        value REAL,
        status TEXT,
        predictedBillingDate TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT,
        description TEXT,
        amount REAL,
        type TEXT,
        dealId TEXT,
        contactId TEXT,
        partnerId TEXT,
        targetPartnerId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS partners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        clientId TEXT,
        items TEXT,
        total REAL,
        generatedText TEXT,
        status TEXT,
        date TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        proposalId TEXT,
        dealId TEXT,
        clientId TEXT,
        name TEXT NOT NULL,
        status TEXT,
        businessCase TEXT,
        projectManager TEXT,
        startDate TEXT,
        endDate TEXT,
        lessonsLearned TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS project_stages (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        name TEXT,
        "order" INTEGER,
        predecessorStageId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS project_tasks (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        stageId TEXT,
        name TEXT,
        startDate TEXT,
        endDate TEXT,
        durationDays INTEGER,
        isCompleted INTEGER DEFAULT 0,
        predecessorTaskId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS project_products (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        productId TEXT,
        name TEXT,
        description TEXT,
        quantity INTEGER,
        price REAL,
        qualityCriteria TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS user_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS group_permissions (
        id TEXT PRIMARY KEY,
        groupId TEXT,
        page TEXT,
        can_view INTEGER DEFAULT 0,
        can_read INTEGER DEFAULT 0,
        can_edit INTEGER DEFAULT 0,
        can_delete INTEGER DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        groupId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        level TEXT,
        type TEXT,
        message TEXT,
        user_email TEXT,
        details TEXT
      );`
    ];

    for (const q of tableQueries) {
      await queryD1(q);
    }

    // Migrações: adicionar colunas faltando em tabelas pré-existentes
    const migrations = [
      "ALTER TABLE system_config ADD COLUMN cnpj TEXT;",
      "ALTER TABLE system_config ADD COLUMN address TEXT;",
      "ALTER TABLE system_config ADD COLUMN email TEXT;",
      "ALTER TABLE system_config ADD COLUMN phone TEXT;",
      // transactions: colunas faltando na versão anterior
      "ALTER TABLE transactions ADD COLUMN contactId TEXT;",
      "ALTER TABLE transactions ADD COLUMN partnerId TEXT;",
      "ALTER TABLE transactions ADD COLUMN targetPartnerId TEXT;",
      // contacts: campo service
      "ALTER TABLE contacts ADD COLUMN service TEXT;",
      // projects: campos faltando na versão anterior
      "ALTER TABLE projects ADD COLUMN proposalId TEXT;",
      "ALTER TABLE projects ADD COLUMN businessCase TEXT;",
      "ALTER TABLE projects ADD COLUMN projectManager TEXT;",
      "ALTER TABLE projects ADD COLUMN endDate TEXT;",
      "ALTER TABLE projects ADD COLUMN lessonsLearned TEXT;",
      // project_products: campos faltando
      "ALTER TABLE project_products ADD COLUMN name TEXT;",
      "ALTER TABLE project_products ADD COLUMN description TEXT;",
      "ALTER TABLE project_products ADD COLUMN qualityCriteria TEXT;",
    ];

    for (const m of migrations) {
      try { await queryD1(m); } catch { /* coluna já existe — ignorar */ }
    }

    // Seed: system_config padrão
    const configs = await queryD1("SELECT id FROM system_config WHERE id = 1 LIMIT 1;");
    if (configs.length === 0) {
      await queryD1(
        `INSERT INTO system_config (id, name, logo, cnpj, address, email, phone, expenseAlertThreshold, customLists)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          "Aura CRM",
          null, "", "", "", "", 15,
          JSON.stringify({
            contactTypes: ["Cliente", "Fornecedor"],
            dealStatuses: ["Lead", "Proposta Enviada", "Negociação", "Ganha", "Perdida"],
            proposalStatuses: ["Rascunho", "Enviada", "Aceita", "Rejeitada"]
          })
        ]
      );
    }

    // Seed: grupos e permissões
    const groups = await queryD1("SELECT id FROM user_groups LIMIT 1;");
    if (groups.length === 0) {
      const defaultGroups = [
        { id: "admin",      name: "Administrador" },
        { id: "vendedor",   name: "Vendedor"       },
        { id: "financeiro", name: "Financeiro"     }
      ];
      for (const g of defaultGroups) {
        await queryD1("INSERT INTO user_groups (id, name) VALUES (?, ?)", [g.id, g.name]);
      }

      const pages = ["dashboard","contacts","sales","products","finance","proposals","projects","profile","admin"];
      for (const page of pages) {
        await queryD1(
          "INSERT INTO group_permissions (id,groupId,page,can_view,can_read,can_edit,can_delete) VALUES (?,?,?,?,?,?,?)",
          [`perm_admin_${page}`, "admin", page, 1, 1, 1, 1]
        );
        const vendFull  = ["sales","proposals","contacts"].includes(page);
        const vendRead  = ["dashboard","products","profile"].includes(page);
        await queryD1(
          "INSERT INTO group_permissions (id,groupId,page,can_view,can_read,can_edit,can_delete) VALUES (?,?,?,?,?,?,?)",
          [`perm_vend_${page}`, "vendedor", page,
            vendFull || vendRead ? 1 : 0,
            vendFull || vendRead ? 1 : 0,
            vendFull ? 1 : 0,
            vendFull ? 1 : 0]
        );
        const finFull  = ["finance","profile"].includes(page);
        const finRead  = ["dashboard","contacts"].includes(page);
        await queryD1(
          "INSERT INTO group_permissions (id,groupId,page,can_view,can_read,can_edit,can_delete) VALUES (?,?,?,?,?,?,?)",
          [`perm_fin_${page}`, "financeiro", page,
            finFull || finRead ? 1 : 0,
            finFull || finRead ? 1 : 0,
            finFull ? 1 : 0,
            finFull ? 1 : 0]
        );
      }
    }

    // Seed: usuário admin padrão
    const dbUsers = await queryD1("SELECT id FROM users LIMIT 1;");
    if (dbUsers.length === 0) {
      await queryD1("INSERT INTO users (id, name, email, groupId) VALUES (?, ?, ?, ?)", [
        "flavio-user-id",
        "Flávio Nunes",
        "flavio.nunes@defensoria.rj.def.br",
        "admin"
      ]);
    }

    await logEvent("INFO", "Sistema", "Aura CRM inicializado com sucesso");
    console.log("Schema verificado. Servidor pronto.");
  } catch (err) {
    console.error("Falha na inicialização do schema:", err);
  }
}

// ─── Value Helpers ────────────────────────────────────────────────────────────
function prepareValueForDb(_table: string, _key: string, val: any): any {
  if (val === undefined || val === null) return null;
  if (typeof val === "object") return JSON.stringify(val);
  return val;
}

function parseRecordFromDb(_table: string, record: any): any {
  if (!record) return record;
  const parsed = { ...record };

  for (const key of Object.keys(parsed)) {
    const val = parsed[key];
    if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
      try { parsed[key] = JSON.parse(val); } catch { /* manter como string */ }
    }
  }

  if ("isCompleted" in parsed) {
    parsed.isCompleted = parsed.isCompleted === 1 || parsed.isCompleted === true;
  }

  return parsed;
}

function generateId(prefix: string = ""): string {
  return `${prefix}${crypto.randomBytes(6).toString("hex")}_${Date.now()}`;
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, provider } = req.body;
  const userEmail = email || "flavio.nunes@defensoria.rj.def.br";
  const displayName = email ? email.split("@")[0] : "Flávio Nunes";

  // Google OAuth — simulado para MVP (integrar OAuth real em produção)
  const resolvedEmail = provider === "google"
    ? "flavio.nunes@defensoria.rj.def.br"
    : userEmail;

  try {
    const existing = await queryD1("SELECT id FROM users WHERE email = ? LIMIT 1;", [resolvedEmail]);
    if (existing.length === 0) {
      const newId = generateId("u_");
      const groupId = resolvedEmail === "flavio.nunes@defensoria.rj.def.br" ? "admin" : "vendedor";
      await queryD1("INSERT INTO users (id, name, email, groupId) VALUES (?, ?, ?, ?);", [
        newId, displayName, resolvedEmail, groupId
      ]);
    }
  } catch (err) {
    console.error("Erro ao sincronizar usuário no banco:", err);
  }

  const token = generateToken();
  const sessionData = {
    access_token: token,
    user: {
      id: generateId("uid_"),
      email: resolvedEmail,
      user_metadata: {
        full_name: provider === "google" ? "Flávio Nunes" : displayName
      }
    }
  };
  sessions.set(token, sessionData);

  await logEvent("INFO", "Ação do Usuário", `Login realizado: ${resolvedEmail}`, resolvedEmail);
  res.json({ session: sessionData });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = req.headers["x-auth-token"] as string;
  const session = token ? sessions.get(token) : null;
  const email = session?.user?.email || "desconhecido";
  if (token) sessions.delete(token);
  await logEvent("INFO", "Ação do Usuário", `Logout: ${email}`, email);
  res.json({ success: true });
});

app.get("/api/auth/session", async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session?.user) {
    return res.json({ session: null });
  }

  try {
    const email = session.user.email;
    const userRows = await queryD1("SELECT * FROM users WHERE email = ? LIMIT 1;", [email]);
    if (userRows.length > 0) {
      const u = userRows[0];
      const groupRows = await queryD1("SELECT name FROM user_groups WHERE id = ? LIMIT 1;", [u.groupId]);
      const permRows  = await queryD1("SELECT * FROM group_permissions WHERE groupId = ?;", [u.groupId]);
      return res.json({
        session: {
          ...session,
          user: {
            ...session.user,
            groupId: u.groupId,
            groupName: groupRows[0]?.name || "Nenhum",
            permissions: permRows
          }
        }
      });
    }
  } catch (e) {
    console.error("Erro ao carregar permissões do usuário:", e);
  }

  res.json({ session });
});

app.post("/api/auth/profile", requireAuth, async (req, res) => {
  const session = getSessionFromRequest(req)!;
  session.user.user_metadata = { ...session.user.user_metadata, ...req.body };
  const email = session.user.email;
  await logEvent("INFO", "Ação do Usuário", `Perfil atualizado: ${email}`, email, JSON.stringify(req.body));
  res.json({ user: session.user });
});

// ─── DB Monitor ───────────────────────────────────────────────────────────────
app.get("/api/db-monitor", requireAuth, async (req, res) => {
  try {
    const list   = await queryD1("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tables = list.map((i: any) => i.name);
    let totalRows = 0;
    const tableStats = [];
    for (const t of tables) {
      const rows = await queryD1(`SELECT COUNT(*) as count FROM "${t}";`);
      const count = rows[0]?.count || 0;
      tableStats.push({ name: t, count });
      totalRows += count;
    }
    const [pageSizeRows, pageCountRows, schemaRows] = await Promise.all([
      queryD1("PRAGMA page_size;"),
      queryD1("PRAGMA page_count;"),
      queryD1("PRAGMA schema_version;")
    ]);
    const pageSize    = pageSizeRows[0]?.page_size    || 4096;
    const pageCount   = pageCountRows[0]?.page_count  || 1;
    const schemaVersion = schemaRows[0]?.schema_version || 1;
    res.json({
      success: true,
      databaseId: DATABASE_ID,
      accountID: ACCOUNT_ID,
      tableName: "Cloudflare D1",
      tablesCount: tables.length,
      tables: tableStats,
      totalRows,
      schemaVersion,
      estimatedSizeKB: Number(((pageSize * pageCount) / 1024).toFixed(2)),
      connectionStatus: "Conectado"
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── System Logs ──────────────────────────────────────────────────────────────
app.get("/api/system-logs", requireAuth, async (_req: express.Request, res) => {
  try {
    const logs = await queryD1("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 250;");
    res.json(logs);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.post("/api/system-logs", async (req, res) => {
  try {
    const { level, type, message, userEmail, details } = req.body;
    const session = getSessionFromRequest(req);
    await logEvent(
      level || "INFO",
      type  || "Sistema",
      message || "",
      userEmail || session?.user?.email || "",
      details || ""
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dynamic CRUD ─────────────────────────────────────────────────────────────
const TABLES = [
  { path: "system-config",     table: "system_config"    },
  { path: "contacts",          table: "contacts"          },
  { path: "products",          table: "products"          },
  { path: "deals",             table: "deals"             },
  { path: "transactions",      table: "transactions"      },
  { path: "partners",          table: "partners"          },
  { path: "proposals",         table: "proposals"         },
  { path: "projects",          table: "projects"          },
  { path: "project-stages",    table: "project_stages"    },
  { path: "project-tasks",     table: "project_tasks"     },
  { path: "project-products",  table: "project_products"  },
  { path: "users",             table: "users"             },
  { path: "user-groups",       table: "user_groups"       },
  { path: "group-permissions", table: "group_permissions" }
];

TABLES.forEach(({ path: routePath, table }) => {
  // LIST / SINGLE
  app.get(`/api/${routePath}`, requireAuth, async (req, res) => {
    try {
      const filters = { ...req.query } as Record<string, any>;
      const limit  = filters._limit;
      const single = filters._single;
      delete filters._limit;
      delete filters._single;

      const keys = Object.keys(filters);
      let sql = `SELECT * FROM "${table}"`;
      const params: any[] = [];

      if (keys.length > 0) {
        sql += " WHERE " + keys.map(k => `"${k}" = ?`).join(" AND ");
        keys.forEach(k => params.push(filters[k]));
      }
      if (limit) sql += ` LIMIT ${Number(limit)}`;

      const rows = await queryD1(sql, params);
      const parsed = rows.map(r => parseRecordFromDb(table, r));

      res.json(single === "true" ? (parsed[0] || null) : parsed);
    } catch (err: any) {
      const session = getSessionFromRequest(req);
      await logEvent("ERROR", "API", `GET /api/${routePath}: ${err.message}`, session?.user?.email);
      res.status(500).send(err.message);
    }
  });

  // CREATE
  app.post(`/api/${routePath}`, requireAuth, async (req, res) => {
    try {
      const body = { ...req.body };
      const session = getSessionFromRequest(req)!;
      const userEmail = session.user.email;

      // system_config: upsert com id fixo 1
      if (table === "system_config") {
        await queryD1(
          `INSERT OR REPLACE INTO system_config
            (id,name,logo,cnpj,address,email,phone,expenseAlertThreshold,customLists)
           VALUES (?,?,?,?,?,?,?,?,?);`,
          [
            1,
            body.name ?? null,
            body.logo ?? null,
            body.cnpj ?? "",
            body.address ?? "",
            body.email ?? "",
            body.phone ?? "",
            body.expenseAlertThreshold ?? 15,
            prepareValueForDb(table, "customLists", body.customLists)
          ]
        );
        await logEvent("INFO", "Ação do Usuário", "Configurações do sistema atualizadas", userEmail, JSON.stringify(body));
        return res.json({ id: 1, ...body });
      }

      // Gerar ID se não fornecido
      if (!body.id) {
        body.id = generateId();
      }

      const columns = Object.keys(body);
      const values  = columns.map(col => prepareValueForDb(table, col, body[col]));
      await queryD1(
        `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        values
      );

      await logEvent("INFO", "Ação do Usuário", `Criou registro em ${table} (id: ${body.id})`, userEmail, JSON.stringify({ id: body.id }));
      res.status(201).json(body);
    } catch (err: any) {
      const session = getSessionFromRequest(req);
      await logEvent("ERROR", "API", `POST /api/${routePath}: ${err.message}`, session?.user?.email, JSON.stringify(req.body));
      res.status(500).send(err.message);
    }
  });

  // UPDATE
  app.put(`/api/${routePath}/:id`, requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const session = getSessionFromRequest(req)!;
      const userEmail = session.user.email;

      const columns   = Object.keys(body).filter(k => k !== "id");
      const values    = columns.map(col => prepareValueForDb(table, col, body[col]));
      values.push(id);

      await queryD1(
        `UPDATE "${table}" SET ${columns.map(c => `"${c}" = ?`).join(", ")} WHERE "id" = ?`,
        values
      );

      await logEvent("INFO", "Ação do Usuário", `Atualizou registro em ${table} (id: ${id})`, userEmail, JSON.stringify({ id }));
      res.json({ id, ...body });
    } catch (err: any) {
      const session = getSessionFromRequest(req);
      await logEvent("ERROR", "API", `PUT /api/${routePath}/${req.params.id}: ${err.message}`, session?.user?.email);
      res.status(500).send(err.message);
    }
  });

  // DELETE
  app.delete(`/api/${routePath}/:id`, requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = getSessionFromRequest(req)!;
      const userEmail = session.user.email;

      await queryD1(`DELETE FROM "${table}" WHERE "id" = ?`, [id]);

      await logEvent("INFO", "Ação do Usuário", `Deletou registro em ${table} (id: ${id})`, userEmail, JSON.stringify({ id }));
      res.json({ success: true });
    } catch (err: any) {
      const session = getSessionFromRequest(req);
      await logEvent("ERROR", "API", `DELETE /api/${routePath}/${req.params.id}: ${err.message}`, session?.user?.email);
      res.status(500).send(err.message);
    }
  });
});

// ─── MCP ──────────────────────────────────────────────────────────────────────
app.post("/api/mcp", requireAuth, async (req, res) => {
  const { method, params } = req.body;

  try {
    if (method === "tools/list") {
      return res.json({
        result: {
          tools: [
            {
              name: "get_contacts",
              description: "Retorna a lista de contatos cadastrados.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_deals",
              description: "Retorna as oportunidades de venda.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_transactions",
              description: "Retorna o histórico financeiro.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "execute_sql_query",
              description: "Executa SQL somente leitura no banco D1.",
              inputSchema: {
                type: "object",
                properties: {
                  sql:    { type: "string", description: "Instrução SQL SELECT." },
                  params: { type: "array",  items: {}, description: "Parâmetros opcionais." }
                },
                required: ["sql"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params || {};
      let rows: any[];

      if (name === "get_contacts")     rows = await queryD1("SELECT * FROM contacts");
      else if (name === "get_deals")   rows = await queryD1("SELECT * FROM deals");
      else if (name === "get_transactions") rows = await queryD1("SELECT * FROM transactions");
      else if (name === "execute_sql_query") {
        const { sql, params: sqlParams } = args || {};
        // Somente permitir SELECT por segurança
        if (!/^\s*SELECT\s/i.test(sql)) {
          return res.status(403).json({ error: { message: "Apenas queries SELECT são permitidas via MCP." } });
        }
        rows = await queryD1(sql, sqlParams || []);
      } else {
        return res.status(404).json({ error: { message: `Ferramenta MCP '${name}' não encontrada.` } });
      }

      return res.json({ result: { content: [{ type: "text", text: JSON.stringify(rows) }] } });
    }

    res.status(400).json({ error: { message: "Método inválido." } });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── Pagar.me Webhook ─────────────────────────────────────────────────────────
app.post("/api/pagarme/webhook", async (req, res) => {
  try {
    const body = req.body || {};

    let eventType    = body.event || body.type || "unknown_event";
    let status       = "";
    let amountCents  = 0;
    let transactionId = "";
    let customerName  = "Cliente Pagar.me";
    let customerEmail = "";
    let customerPhone = "";

    // Payload v5
    if (body.data?.status) {
      status        = body.data.status;
      amountCents   = body.data.amount || 0;
      transactionId = body.data.id || String(body.id || "");
      customerName  = body.data.customer?.name  || customerName;
      customerEmail = body.data.customer?.email || "";
      customerPhone = body.data.customer?.phones?.mobile_phone?.number || body.data.customer?.phone || "";
    }
    // Payload v4
    else if (body.transaction) {
      status        = body.current_status || body.transaction.status || "";
      amountCents   = body.transaction.amount || 0;
      transactionId = String(body.transaction.id || "");
      customerName  = body.transaction.customer?.name  || customerName;
      customerEmail = body.transaction.customer?.email || "";
      customerPhone = body.transaction.customer?.phone || "";
    }
    // Fallback
    else {
      status        = body.status || "";
      amountCents   = body.amount || 0;
      transactionId = body.id    || "";
      customerName  = body.customer?.name  || customerName;
      customerEmail = body.customer?.email || "";
    }

    const amountReal = amountCents ? amountCents / 100 : 0;
    await logEvent("INFO", "API", `Pagar.me webhook — evento: ${eventType}, id: ${transactionId}, status: ${status}`, "api-bot", JSON.stringify(body));

    if ((status === "paid" || status === "captured" || eventType.includes("paid")) && amountReal > 0) {
      const txId = `pagarme_${transactionId || Date.now()}`;
      const existing = await queryD1("SELECT id FROM transactions WHERE id = ? LIMIT 1;", [txId]);

      if (existing.length === 0) {
        const dateStr = new Date().toISOString().split("T")[0];
        await queryD1(
          `INSERT INTO transactions (id, date, description, amount, type, dealId, contactId, partnerId, targetPartnerId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [txId, dateStr, `Receita via Pagar.me #${transactionId} — ${customerName}`, amountReal, "Receita", null, null, null, null]
        );
        await logEvent("INFO", "D1", `Transação de receita criada via Pagar.me: R$ ${amountReal.toFixed(2)}`, "api-bot");

        if (customerEmail) {
          const contactExisting = await queryD1("SELECT id FROM contacts WHERE email = ? LIMIT 1;", [customerEmail]);
          if (contactExisting.length === 0) {
            const newContactId = generateId("c_pagarme_");
            await queryD1(
              `INSERT INTO contacts (id, name, email, phone, type, address, cpfCnpj, description, commercialContact)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                newContactId, customerName, customerEmail,
                customerPhone || "", "Cliente", "", "",
                `Cadastrado automaticamente via Pagar.me (Transação #${transactionId})`,
                null
              ]
            );
            await logEvent("INFO", "D1", `Contato criado via Pagar.me: ${customerName} (${customerEmail})`, "api-bot");
          }
        }
      } else {
        await logEvent("INFO", "API", `Webhook Pagar.me #${transactionId} já processado. Ignorando.`, "api-bot");
      }
    }

    res.json({ received: true, processed: true });
  } catch (err: any) {
    console.error("[Pagar.me Webhook Error]", err);
    await logEvent("ERROR", "API", `Erro no webhook Pagar.me: ${err.message}`, "api-bot");
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  await initializeSchema();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aura CRM] Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
