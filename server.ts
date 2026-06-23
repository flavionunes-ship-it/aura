import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Cloudflare D1 REST API Credentials
const ACCOUNT_ID = "421d29651d6541cc953ee57131b6d289";
const DATABASE_ID = "f74f9153-78ad-40d7-a6b7-3db6f3a55d1c";
const API_TOKEN = "cfat_vgcLkZmzS7T3pWtkILIDhOLnGxTp8IEI1ViFhimi2bd9c27c";

// CENTRAL LOGGING SYSTEM
async function logEvent(level: "INFO" | "WARN" | "ERROR", type: "Sistema" | "IA" | "D1" | "API" | "MCP" | "Ação do Usuário", message: string, userEmail: string = "", details: string = "") {
  const id = `log_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
  const timestamp = new Date().toISOString();
  console.log(`[SYSTEM LOG ${level}] [${type}] ${message} (User: ${userEmail || 'Anonymous'})`);
  try {
    await queryD1(
      `INSERT INTO system_logs (id, timestamp, level, type, message, user_email, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, timestamp, level, type, message, userEmail, details]
    );
  } catch (err) {
    console.error("Failed to write to DB system_logs:", err);
  }
}

// Central D1 fetch query logic
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
      console.error(`D1 Network request failed [HTTP ${res.status}]:`, errText);
      throw new Error(`Cloudflare D1 HTTP Error ${res.status}: ${errText}`);
    }

    const payload: any = await res.json();
    if (!payload.success) {
      console.error("D1 API Response returned failures:", payload.errors);
      throw new Error(`D1 API Error: ${JSON.stringify(payload.errors)}`);
    }

    const resultObj = Array.isArray(payload.result) ? payload.result[0] : payload.result;
    return resultObj?.results || [];
  } catch (err: any) {
    console.error(`Error querying D1. SQL: "${sql}". Params: ${JSON.stringify(params)}`, err);
    throw err;
  }
}

// Prepare database schema
async function initializeSchema() {
  console.log("Setting up Cloudflare D1 Database schema if missing...");
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
        name TEXT,
        email TEXT,
        phone TEXT,
        type TEXT,
        address TEXT,
        cpfCnpj TEXT,
        description TEXT,
        commercialContact TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        price REAL
      );`,
      `CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        title TEXT,
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
        dealId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS partners (
        id TEXT PRIMARY KEY,
        name TEXT
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
        dealId TEXT,
        clientId TEXT,
        name TEXT,
        status TEXT,
        startDate TEXT
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
        isCompleted INTEGER,
        predecessorTaskId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS project_products (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        productId TEXT,
        quantity INTEGER,
        price REAL
      );`,
      `CREATE TABLE IF NOT EXISTS user_groups (
        id TEXT PRIMARY KEY,
        name TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS group_permissions (
        id TEXT PRIMARY KEY,
        groupId TEXT,
        page TEXT,
        can_view INTEGER,
        can_read INTEGER,
        can_edit INTEGER,
        can_delete INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
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

    // SQLite migration column checks in case database had pre-existing tables without cnpj, etc
    try { await queryD1("ALTER TABLE system_config ADD COLUMN cnpj TEXT;"); } catch {}
    try { await queryD1("ALTER TABLE system_config ADD COLUMN address TEXT;"); } catch {}
    try { await queryD1("ALTER TABLE system_config ADD COLUMN email TEXT;"); } catch {}
    try { await queryD1("ALTER TABLE system_config ADD COLUMN phone TEXT;"); } catch {}

    // Seed default system_config if empty
    const configs = await queryD1("SELECT * FROM system_config WHERE id = 1 LIMIT 1;");
    if (configs.length === 0) {
      await queryD1(`
        INSERT INTO system_config (id, name, logo, cnpj, address, email, phone, expenseAlertThreshold, customLists)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        "Aura CRM",
        null,
        "",
        "",
        "",
        "",
        15,
        JSON.stringify({
          contactTypes: ["Cliente", "Fornecedor"],
          dealStatuses: ["Lead", "Proposta Enviada", "Negociação", "Ganha", "Perdida"],
          proposalStatuses: ["Rascunho", "Enviada", "Aceita", "Rejeitada"]
        })
      ]);
    }

    // Seed default groups and permissions
    const groups = await queryD1("SELECT * FROM user_groups LIMIT 1;");
    if (groups.length === 0) {
      const defaultGroups = [
        { id: "admin", name: "Administrador" },
        { id: "vendedor", name: "Vendedor" },
        { id: "financeiro", name: "Financeiro" }
      ];
      for (const g of defaultGroups) {
        await queryD1("INSERT INTO user_groups (id, name) VALUES (?, ?)", [g.id, g.name]);
      }

      const pages = ['dashboard', 'contacts', 'sales', 'products', 'finance', 'proposals', 'projects', 'profile', 'admin'];
      for (const page of pages) {
        // Admin permissions: full access
        await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [`perm_admin_${page}`, "admin", page, 1, 1, 1, 1]);

        // Vendedor permissions
        if (['sales', 'proposals', 'contacts'].includes(page)) {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_vend_${page}`, "vendedor", page, 1, 1, 1, 1]);
        } else if (['dashboard', 'products', 'profile'].includes(page)) {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_vend_${page}`, "vendedor", page, 1, 1, 0, 0]);
        } else {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_vend_${page}`, "vendedor", page, 0, 0, 0, 0]);
        }

        // Financeiro permissions
        if (['finance', 'profile'].includes(page)) {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_fin_${page}`, "financeiro", page, 1, 1, 1, 1]);
        } else if (['dashboard', 'contacts'].includes(page)) {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_fin_${page}`, "financeiro", page, 1, 1, 0, 0]);
        } else {
          await queryD1("INSERT INTO group_permissions (id, groupId, page, can_view, can_read, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`perm_fin_${page}`, "financeiro", page, 0, 0, 0, 0]);
        }
      }
    }

    // Seed default user mapping
    const dbUsers = await queryD1("SELECT * FROM users LIMIT 1;");
    if (dbUsers.length === 0) {
      await queryD1("INSERT INTO users (id, name, email, groupId) VALUES (?, ?, ?, ?)", [
        "flavio-user-id",
        "Flávio Nunes",
        "flavio.nunes@defensoria.rj.def.br",
        "admin"
      ]);
    }

    await logEvent("INFO", "Sistema", "Aura CRM inicializado com suporte a Cloudflare D1 e API First");
    console.log("Cloudflare D1 tables checked and operational!");
  } catch (err) {
    console.error("Schema bootup crashed:", err);
  }
}

// Serialization helpers for JSON fields in standard SQLite
function prepareValueForDb(table: string, key: string, val: any): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

function parseRecordFromDb(table: string, record: any): any {
  if (!record) return record;
  const parsed = { ...record };
  
  for (const key of Object.keys(parsed)) {
    const val = parsed[key];
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try {
        parsed[key] = JSON.parse(val);
      } catch {
        // Leave as normal string
      }
    }
  }

  // Handle boolean representations
  if ('isCompleted' in parsed) {
    parsed.isCompleted = parsed.isCompleted === 1 || parsed.isCompleted === true;
  }

  return parsed;
}

// Authentication Memory Session Broker
let currentSession: any = {
  access_token: 'mock-session-token',
  user: {
    id: 'flavio-user-id',
    email: 'flavio.nunes@defensoria.rj.def.br',
    user_metadata: {
      full_name: 'Flávio Nunes'
    }
  }
};

// API auth routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password, provider } = req.body;
  const userEmail = email || 'flavio.nunes@defensoria.rj.def.br';
  const name = email ? email.split('@')[0] : 'Flávio Nunes';

  if (provider === 'google') {
    currentSession = {
      access_token: 'mock-google-token',
      user: {
        id: 'flavio-user-id',
        email: 'flavio.nunes@defensoria.rj.def.br',
        user_metadata: {
          full_name: 'Flávio Nunes (Google)'
        }
      }
    };
  } else {
    currentSession = {
      access_token: 'mock-password-token',
      user: {
        id: `mock-user-${Math.random().toString(36).substring(2, 11)}`,
        email: userEmail,
        user_metadata: {
          full_name: name
        }
      }
    };
  }

  // Ensure user is registered in the "users" table
  try {
    const existing = await queryD1("SELECT id FROM users WHERE email = ? LIMIT 1;", [userEmail]);
    if (existing.length === 0) {
      const newUserId = `u_${Math.random().toString(36).substring(2, 9)}`;
      await queryD1("INSERT INTO users (id, name, email, groupId) VALUES (?, ?, ?, ?);", [
        newUserId,
        name,
        userEmail,
        userEmail === 'flavio.nunes@defensoria.rj.def.br' ? 'admin' : 'vendedor'
      ]);
    }
  } catch (err) {
    console.error("Failed to sync logged-in user in database:", err);
  }

  await logEvent("INFO", "Ação do Usuário", `Usuário ${userEmail} realizou login com sucesso`, userEmail);
  res.json({ session: currentSession });
});

app.post('/api/auth/logout', async (req, res) => {
  const email = currentSession?.user?.email || "unknown";
  await logEvent("INFO", "Ação do Usuário", `Usuário ${email} encerrou a sessão`, email);
  currentSession = null;
  res.json({ success: true });
});

app.get('/api/auth/session', async (req, res) => {
  if (currentSession && currentSession.user) {
    try {
      const email = currentSession.user.email;
      const userRows = await queryD1("SELECT * FROM users WHERE email = ? LIMIT 1;", [email]);
      if (userRows.length > 0) {
        const u = userRows[0];
        const groupRows = await queryD1("SELECT name FROM user_groups WHERE id = ? LIMIT 1;", [u.groupId]);
        const groupName = groupRows[0]?.name || "Nenhum";
        const permRows = await queryD1("SELECT * FROM group_permissions WHERE groupId = ?;", [u.groupId]);

        res.json({
          session: {
            ...currentSession,
            user: {
              ...currentSession.user,
              groupId: u.groupId,
              groupName,
              permissions: permRows
            }
          }
        });
        return;
      } else {
        // Fallback or automatic registration for Flavio
        const groupId = email === 'flavio.nunes@defensoria.rj.def.br' ? 'admin' : 'vendedor';
        const newUserId = `u_${Date.now()}`;
        await queryD1("INSERT INTO users (id, name, email, groupId) VALUES (?, ?, ?, ?)", [
          newUserId,
          currentSession.user.user_metadata?.full_name || email.split('@')[0],
          email,
          groupId
        ]);
        const permRows = await queryD1("SELECT * FROM group_permissions WHERE groupId = ?;", [groupId]);
        res.json({
          session: {
            ...currentSession,
            user: {
              ...currentSession.user,
              groupId,
              groupName: groupId === 'admin' ? 'Administrador' : 'Vendedor',
              permissions: permRows
            }
          }
        });
        return;
      }
    } catch (e) {
      console.error("Failed to inject user permissions from D1:", e);
    }
  }
  res.json({ session: currentSession });
});

app.post('/api/auth/profile', async (req, res) => {
  if (currentSession && currentSession.user) {
    currentSession.user.user_metadata = {
      ...currentSession.user.user_metadata,
      ...req.body
    };
    const email = currentSession.user.email;
    await logEvent("INFO", "Ação do Usuário", `Usuário ${email} atualizou as informações do perfil`, email, JSON.stringify(req.body));
    res.json({ user: currentSession.user });
  } else {
    res.status(401).send('Sessão indisponível.');
  }
});

// Database statistics monitoring route
app.get('/api/db-monitor', async (req, res) => {
  try {
    const list = await queryD1("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tables = list.map((item: any) => item.name);
    const tableStats = [];
    let totalRows = 0;

    for (const t of tables) {
      const rows = await queryD1(`SELECT COUNT(*) as count FROM "${t}";`);
      const count = rows[0]?.count || 0;
      tableStats.push({ name: t, count });
      totalRows += count;
    }

    const pageSizeRows = await queryD1("PRAGMA page_size;");
    const pageCountRows = await queryD1("PRAGMA page_count;");
    const schemaRows = await queryD1("PRAGMA schema_version;");

    const pageSize = pageSizeRows[0]?.page_size || 4096;
    const pageCount = pageCountRows[0]?.page_count || 1;
    const schemaVersion = schemaRows[0]?.schema_version || 1;
    const sizeKB = (pageSize * pageCount) / 1024;

    res.json({
      success: true,
      databaseId: DATABASE_ID,
      accountID: ACCOUNT_ID,
      tableName: "Cloudflare D1",
      tablesCount: tables.length,
      tables: tableStats,
      totalRows,
      schemaVersion,
      estimatedSizeKB: Number(sizeKB.toFixed(2)),
      connectionStatus: "Conectado"
    });
  } catch (err: any) {
    await logEvent("ERROR", "D1", `Erro ao obter monitoramento do banco: ${err.message}`, currentSession?.user?.email || "");
    res.status(500).json({ success: false, error: err.message });
  }
});

// System logs retrieval route
app.get('/api/system-logs', async (req, res) => {
  try {
    const logs = await queryD1("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 250;");
    res.json(logs);
  } catch (err: any) {
    res.status(500).send(err.message || "Failed to fetch logs");
  }
});

// System logs add route (used for client logs as well)
app.post('/api/system-logs', async (req, res) => {
  try {
    const { level, type, message, userEmail, details } = req.body;
    await logEvent(level || "INFO", type || "Sistema", message || "", userEmail || currentSession?.user?.email || "", details || "");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dynamic CRUD Entity Maps
const TABLES = [
  { path: "system-config", table: "system_config" },
  { path: "contacts", table: "contacts" },
  { path: "products", table: "products" },
  { path: "deals", table: "deals" },
  { path: "transactions", table: "transactions" },
  { path: "partners", table: "partners" },
  { path: "proposals", table: "proposals" },
  { path: "projects", table: "projects" },
  { path: "project-stages", table: "project_stages" },
  { path: "project-tasks", table: "project_tasks" },
  { path: "project-products", table: "project_products" },
  { path: "users", table: "users" },
  { path: "user-groups", table: "user_groups" },
  { path: "group-permissions", table: "group_permissions" }
];

TABLES.forEach(({ path: routePath, table }) => {
  // Read List or single item
  app.get(`/api/${routePath}`, async (req, res) => {
    try {
      const filters = { ...req.query };
      const limit = filters._limit;
      const single = filters._single;
      delete filters._limit;
      delete filters._single;

      let sql = `SELECT * FROM "${table}"`;
      const params: any[] = [];
      const keys = Object.keys(filters);

      if (keys.length > 0) {
        sql += " WHERE " + keys.map((k) => `"${k}" = ?`).join(" AND ");
        keys.forEach((k) => params.push(filters[k]));
      }

      if (limit) {
        sql += ` LIMIT ${Number(limit)}`;
      }

      const rows = await queryD1(sql, params);
      const parsedRows = rows.map((r) => parseRecordFromDb(table, r));

      if (single === 'true') {
        res.json(parsedRows[0] || null);
      } else {
        res.json(parsedRows);
      }
    } catch (err: any) {
      await logEvent("ERROR", "API", `Erro na requisição GET /api/${routePath}: ${err.message}`, currentSession?.user?.email);
      console.error(`Error on GET /api/${routePath}:`, err);
      res.status(500).send(err.message || "Internal Server Error");
    }
  });

  // Create
  app.post(`/api/${routePath}`, async (req, res) => {
    try {
      const body = req.body;
      const userEmail = currentSession?.user?.email || "api-bot";
      
      if (table === "system_config") {
        const values = [
          1,
          body.name === undefined ? null : body.name,
          body.logo === undefined ? null : body.logo,
          body.cnpj === undefined ? null : body.cnpj,
          body.address === undefined ? null : body.address,
          body.email === undefined ? null : body.email,
          body.phone === undefined ? null : body.phone,
          body.expenseAlertThreshold === undefined ? 15 : body.expenseAlertThreshold,
          prepareValueForDb(table, "customLists", body.customLists)
        ];
        
        await queryD1(
          `INSERT OR REPLACE INTO system_config (id, name, logo, cnpj, address, email, phone, expenseAlertThreshold, customLists)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          values
        );
        await logEvent("INFO", "Ação do Usuário", `Alterou configurações gerais do sistema`, userEmail, JSON.stringify(body));
        return res.json({ id: 1, ...body });
      }

      const columns = Object.keys(body);
      const valPlaceholders = columns.map(() => "?").join(", ");
      const values = columns.map((col) => prepareValueForDb(table, col, body[col]));

      const sql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${valPlaceholders})`;
      await queryD1(sql, values);

      await logEvent("INFO", "Ação do Usuário", `Criou novo registro em ${table}`, userEmail, JSON.stringify(body));
      res.status(201).json(body);
    } catch (err: any) {
      await logEvent("ERROR", "API", `Erro na requisição POST /api/${routePath}: ${err.message}`, currentSession?.user?.email, JSON.stringify(req.body));
      console.error(`Error on POST /api/${routePath}:`, err);
      res.status(500).send(err.message || "Internal Server Error");
    }
  });

  // Update
  app.put(`/api/${routePath}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const userEmail = currentSession?.user?.email || "api-bot";
      
      const columns = Object.keys(body).filter((k) => k !== 'id');
      const assignments = columns.map((col) => `"${col}" = ?`).join(", ");
      const values = columns.map((col) => prepareValueForDb(table, col, body[col]));
      values.push(id);

      const sql = `UPDATE "${table}" SET ${assignments} WHERE "id" = ?`;
      await queryD1(sql, values);

      await logEvent("INFO", "Ação do Usuário", `Atualizou registro id ${id} em ${table}`, userEmail, JSON.stringify(body));
      res.json({ id, ...body });
    } catch (err: any) {
      await logEvent("ERROR", "API", `Erro na requisição PUT /api/${routePath}/${req.params.id}: ${err.message}`, currentSession?.user?.email, JSON.stringify(req.body));
      console.error(`Error on PUT /api/${routePath}:`, err);
      res.status(500).send(err.message || "Internal Server Error");
    }
  });

  // Delete
  app.delete(`/api/${routePath}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      const sql = `DELETE FROM "${table}" WHERE "id" = ?`;
      await queryD1(sql, [id]);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`Error on DELETE /api/${routePath}:`, err);
      res.status(500).send(err.message || "Internal Server Error");
    }
  });
});

// JSON-RPC Model Context Protocol (MCP) Server Endpoint mapping
app.post('/api/mcp', async (req, res) => {
  const { method, params } = req.body;

  try {
    if (method === 'tools/list') {
      return res.json({
        result: {
          tools: [
            {
              name: "get_contacts",
              description: "Retorna a lista de contatos (clientes/fornecedores) cadastrados no CRM Aura.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_deals",
              description: "Retorna todos os negócios/oportunidades de vendas em negociação do CRM.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_transactions",
              description: "Retorna o histórico de transações financeiras (receitas e despesas).",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "execute_sql_query",
              description: "Executa instruções SQL ad-hoc no banco de dados SQLite Cloudflare D1.",
              inputSchema: {
                type: "object",
                properties: {
                  sql: { type: "string", description: "O comando SQL a ser executado." },
                  params: { type: "array", items: {}, description: "Valores das variáveis do SQL (opcional)." }
                },
                required: ["sql"]
              }
            }
          ]
        }
      });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};

      if (name === 'get_contacts') {
        const rows = await queryD1('SELECT * FROM contacts');
        return res.json({
          result: {
            content: [{ type: "text", text: JSON.stringify(rows) }]
          }
        });
      }

      if (name === 'get_deals') {
        const rows = await queryD1('SELECT * FROM deals');
        return res.json({
          result: {
            content: [{ type: "text", text: JSON.stringify(rows) }]
          }
        });
      }

      if (name === 'get_transactions') {
        const rows = await queryD1('SELECT * FROM transactions');
        return res.json({
          result: {
            content: [{ type: "text", text: JSON.stringify(rows) }]
          }
        });
      }

      if (name === 'execute_sql_query') {
        const { sql, params: sqlParams } = args || {};
        const rows = await queryD1(sql, sqlParams || []);
        return res.json({
          result: {
            content: [{ type: "text", text: JSON.stringify(rows) }]
          }
        });
      }

      return res.status(404).json({ error: { message: `MCP Tool ${name} not found.` } });
    }

    res.status(400).json({ error: { message: "Invalid method payload." } });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || "Internal MCP Server error." } });
  }
});

// Pagar.me Webhook Receiver
app.post('/api/pagarme/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    console.log("[Pagar.me Webhook] Received payload:", JSON.stringify(body));

    // Extract details based on standard Pagar.me payload versions (v4 and v5)
    let eventType = body.event || body.type || 'unknown_event';
    let status = '';
    let amountCents = 0;
    let transactionId = '';
    let customerName = 'Cliente Pagar.me';
    let customerEmail = '';
    let customerPhone = '';
    let paymentMethod = '';

    // V5 Payload structure
    if (body.data && body.data.status) {
      status = body.data.status;
      amountCents = body.data.amount || 0;
      transactionId = body.data.id || String(body.id || '');
      paymentMethod = body.data.payment_method || '';
      if (body.data.customer) {
        customerName = body.data.customer.name || customerName;
        customerEmail = body.data.customer.email || '';
        customerPhone = body.data.customer.phones?.mobile_phone?.number || body.data.customer.phone || '';
      }
    } 
    // V4 Payload structure
    else if (body.transaction) {
      status = body.current_status || body.transaction.status || '';
      amountCents = body.transaction.amount || 0;
      transactionId = String(body.transaction.id || '');
      paymentMethod = body.transaction.payment_method || '';
      if (body.transaction.customer) {
        customerName = body.transaction.customer.name || customerName;
        customerEmail = body.transaction.customer.email || '';
        customerPhone = body.transaction.customer.phone || '';
      }
    } else {
      // Generic backup detection
      status = body.status || '';
      amountCents = body.amount || 0;
      transactionId = body.id || '';
      if (body.customer) {
        customerName = body.customer.name || customerName;
        customerEmail = body.customer.email || '';
      }
    }

    const amountReal = amountCents ? amountCents / 100 : 0;

    await logEvent("INFO", "API", `Pagar.me: Webhook recebido - Evento ${eventType}, Transação #${transactionId}, Status ${status}`, "api-bot", JSON.stringify(body));

    // Check if this tells us that a purchase was paid/settled
    if (status === 'paid' || status === 'captured' || eventType.includes('paid')) {
      if (amountReal > 0) {
        // Insert into transactions table
        const transactionUuid = `pagarme_${transactionId || Date.now()}`;
        
        // Deduplicate: check if this transaction already exists
        const existing = await queryD1("SELECT id FROM transactions WHERE id = ? LIMIT 1;", [transactionUuid]);
        if (existing.length === 0) {
          const dateStr = new Date().toISOString().split('T')[0];
          const description = `Receita de Compra (Pagar.me #${transactionId}) - ${customerName}`;
          
          // Insert transaction
          await queryD1(`
            INSERT INTO transactions (id, date, description, amount, type, dealId)
            VALUES (?, ?, ?, ?, ?, ?);
          `, [
            transactionUuid,
            dateStr,
            description,
            amountReal,
            'receita',
            null
          ]);

          await logEvent("INFO", "DB", `Transação de receita criada automaticamente: +R$ ${amountReal.toFixed(2)} (Pagar.me #${transactionId})`, "api-bot");

          // Onboard contact automatically if they don't exist
          if (customerEmail) {
            const contactExisting = await queryD1("SELECT id FROM contacts WHERE email = ? LIMIT 1;", [customerEmail]);
            if (contactExisting.length === 0) {
              const newContactId = `c_pagarme_${Date.now()}`;
              await queryD1(`
                INSERT INTO contacts (id, name, email, phone, type, address, cpfCnpj, description, commercialContact)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
              `, [
                newContactId,
                customerName,
                customerEmail,
                customerPhone || '',
                'Cliente',
                '',
                '',
                `Cliente cadastrado automaticamente via checkout Pagar.me (Transação #${transactionId})`,
                'Pagar.me Checkout'
              ]);
              await logEvent("INFO", "DB", `Cliente cadastrado automaticamente via Pagar.me: ${customerName} (${customerEmail})`, "api-bot");
            }
          }
        } else {
          await logEvent("INFO", "API", `Webhook Pagar.me #${transactionId} já processado anteriormente. Ignorando duplicação.`, "api-bot");
        }
      }
    }

    res.json({ received: true, processed: true });
  } catch (err: any) {
    console.error("[Pagar.me Webhook Error]", err);
    await logEvent("ERROR", "API", `Erro ao processar Webhook do Pagar.me: ${err.message}`, "api-bot");
    res.status(500).json({ error: err.message });
  }
});

// Mount Vite middleware for local compilation context
async function startServer() {
  await initializeSchema();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aura CRM] API First Server is running at http://localhost:${PORT}`);
  });
}

startServer();
