import { SupabaseClient } from '@supabase/supabase-js';

const TOKEN_KEY = 'aura_auth_token';

function getStoredToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ''; }
  catch { return ''; }
}

function setStoredToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* SSR / ambiente sem localStorage */ }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { 'X-Auth-Token': token } : {};
}

// Converte nome de tabela para path da rota (underscores → hífens)
function tableToPath(table: string): string {
  return table.replaceAll('_', '-');
}

// ─── Query Builder ────────────────────────────────────────────────────────────
class ApiQueryBuilder {
  private table: string;
  private limitVal: number | null = null;
  private isSingle: boolean = false;
  private eqFilters: Array<{ field: string; value: any }> = [];

  constructor(table: string) {
    this.table = table;
  }

  select(_fields?: string) { return this; }

  limit(num: number) { this.limitVal = num; return this; }

  single() { this.isSingle = true; return this; }

  eq(field: string, value: any) {
    this.eqFilters.push({ field, value });
    return this;
  }

  async then(resolve: (result: any) => void, reject?: (err: any) => void) {
    try {
      const url  = `/api/${tableToPath(this.table)}`;
      const qs   = new URLSearchParams();

      for (const f of this.eqFilters) qs.append(f.field, String(f.value));
      if (this.limitVal !== null) qs.append('_limit', String(this.limitVal));
      if (this.isSingle) qs.append('_single', 'true');

      const fetchUrl = qs.toString() ? `${url}?${qs}` : url;
      const res = await fetch(fetchUrl, { headers: authHeaders() });

      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

      const data = await res.json();
      if (this.isSingle) {
        resolve({ data: data || null, error: null });
      } else {
        resolve({ data: Array.isArray(data) ? data : [data], error: null });
      }
    } catch (err: any) {
      if (reject) reject(err);
      else resolve({ data: null, error: err });
    }
  }

  insert(records: any) {
    const url = `/api/${tableToPath(this.table)}`;

    // Inicia o fetch imediatamente e armazena a promise
    const fetchPromise: Promise<{ data: any; error: any }> = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(records)
    }).then(async res => {
      if (!res.ok) return { data: null, error: { message: await res.text() } };
      return { data: await res.json(), error: null };
    }).catch((e: any) => ({ data: null, error: { message: e.message } }));

    // Retorna builder compatível com .select().single() e await direto
    return {
      select: () => ({
        single: () => ({
          then: (resolve: any, reject?: any) =>
            fetchPromise.then(resolve, reject)
        }),
        then: (resolve: any, reject?: any) =>
          fetchPromise.then(({ data, error }) => resolve({ data: data ? [data] : null, error }), reject)
      }),
      then: (resolve: any, reject?: any) => fetchPromise.then(resolve, reject)
    };
  }

  async update(updates: any) {
    const table = this.table;
    return {
      eq: async (_field: string, value: any) => {
        const url = `/api/${tableToPath(table)}/${value}`;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(updates)
          });
          if (!res.ok) {
            const errTxt = await res.text();
            return { data: null, error: { message: errTxt } };
          }
          return { data: await res.json(), error: null };
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      }
    };
  }

  async delete() {
    const table = this.table;
    return {
      eq: async (_field: string, value: any) => {
        const url = `/api/${tableToPath(table)}/${value}`;
        try {
          const res = await fetch(url, {
            method: 'DELETE',
            headers: authHeaders()
          });
          if (!res.ok) {
            const errTxt = await res.text();
            return { data: null, error: { message: errTxt } };
          }
          return { data: null, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      }
    };
  }

  async upsert(records: any) {
    const url = `/api/${tableToPath(this.table)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(records)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return { data: null, error: { message: errTxt } };
      }
      return { data: await res.json(), error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
}

// ─── Auth Proxy ───────────────────────────────────────────────────────────────
const apiAuth = {
  async getSession() {
    try {
      const res = await fetch('/api/auth/session', { headers: authHeaders() });
      if (!res.ok) return { data: { session: null }, error: null };
      const data = await res.json();
      return { data: { session: data.session }, error: null };
    } catch (e: any) {
      return { data: { session: null }, error: { message: e.message } };
    }
  },

  // Verifica sessão periodicamente (a cada 5 minutos — apenas para keepalive)
  onAuthStateChange(callback: any) {
    const check = async () => {
      const res = await this.getSession();
      callback('SIGNED_IN', res.data.session);
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return {
      data: {
        subscription: { unsubscribe() { clearInterval(interval); } }
      }
    };
  },

  async signInWithOAuth(_params: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'flavio.nunes@defensoria.rj.def.br', provider: 'google' })
      });
      if (!res.ok) return { error: { message: 'Erro de autenticação.' } };
      const data = await res.json();
      if (data.session?.access_token) setStoredToken(data.session.access_token);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  },

  async signInWithPassword(params: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        return { data: null, error: { message: await res.text() } };
      }
      const data = await res.json();
      if (data.session?.access_token) setStoredToken(data.session.access_token);
      return { data: { session: data.session, user: data.session?.user }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  },

  async signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
      setStoredToken('');
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  },

  async updateUser(updates: any) {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updates.data)
      });
      if (!res.ok) {
        return { data: null, error: { message: await res.text() } };
      }
      return { data: { user: (await res.json()).user }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
};

// ─── Proxy Supabase ───────────────────────────────────────────────────────────
export const supabase = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'auth') return apiAuth;
    if (prop === 'from') return (table: string) => new ApiQueryBuilder(table);
    return undefined;
  }
}) as unknown as SupabaseClient<any, 'public', any>;
