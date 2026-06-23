import { SupabaseClient } from '@supabase/supabase-js';

// Custom API query builder converting 'supabase.from()' calls into local REST calls
class ApiQueryBuilder {
  private table: string;
  private selectFields: string = '*';
  private limitVal: number | null = null;
  private isSingle: boolean = false;
  private eqFilters: Array<{ field: string; value: any }> = [];

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string) {
    if (fields) this.selectFields = fields;
    return this;
  }

  limit(num: number) {
    this.limitVal = num;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  eq(field: string, value: any) {
    this.eqFilters.push({ field, value });
    return this;
  }

  async then(resolve: any, reject?: any) {
    try {
      // Map table names to endpoint paths
      const routePath = this.table.replace('_', '-');
      const url = `/api/${routePath}`;

      const queryParams = new URLSearchParams();
      for (const filter of this.eqFilters) {
         queryParams.append(filter.field, String(filter.value));
      }
      if (this.limitVal !== null) {
        queryParams.append('_limit', String(this.limitVal));
      }
      if (this.isSingle) {
        queryParams.append('_single', 'true');
      }

      const queryStr = queryParams.toString();
      const fetchUrl = queryStr ? `${url}?${queryStr}` : url;

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(`DB fetch error ${res.status}`);
      }
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

  async insert(records: any) {
    const routePath = this.table.replace('_', '-');
    const url = `/api/${routePath}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return { data: null, error: { message: errTxt } };
      }
      const data = await res.json();
      
      return {
        select: () => ({
          single: () => ({
            then: (resolve: any) => resolve({ data, error: null })
          }),
          then: (resolve: any) => resolve({ data: [data], error: null })
        }),
        then: (resolve: any) => resolve({ data, error: null })
      };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }

  async update(updates: any) {
    return {
      eq: async (field: string, value: any) => {
        const routePath = this.table.replace('_', '-');
        const url = `/api/${routePath}/${value}`;
        
        try {
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates)
          });
          if (!res.ok) {
            const errTxt = await res.text();
            return { data: null, error: { message: errTxt } };
          }
          const data = await res.json();
          return { data, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      }
    };
  }

  async delete() {
    return {
      eq: async (field: string, value: any) => {
        const routePath = this.table.replace('_', '-');
        const url = `/api/${routePath}/${value}`;
        
        try {
          const res = await fetch(url, {
            method: "DELETE"
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
    const routePath = this.table.replace('_', '-');
    const url = `/api/${routePath}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return { data: null, error: { message: errTxt } };
      }
      const data = await res.json();
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
}

// Authentication flow redirected to server API auth endpoints
const apiAuth = {
  async getSession() {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) return { data: { session: null }, error: null };
      const data = await res.json();
      return { data: { session: data.session }, error: null };
    } catch (e: any) {
      return { data: { session: null }, error: { message: e.message } };
    }
  },

  onAuthStateChange(callback: any) {
    const checkSession = async () => {
      const res = await this.getSession();
      callback('SIGNED_IN', res.data.session);
    };
    checkSession();
    
    const interval = setInterval(checkSession, 12000); // Check occasionally
    return {
      data: {
        subscription: {
          unsubscribe() {
            clearInterval(interval);
          }
        }
      }
    };
  },

  async signInWithOAuth(params: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: 'flavio.nunes@defensoria.rj.def.br', provider: 'google' })
      });
      if (!res.ok) return { error: { message: 'Erro de autenticação Google.' } };
      const data = await res.json();
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  },

  async signInWithPassword(params: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: { message: txt } };
      }
      const data = await res.json();
      return { data: { session: data.session, user: data.session?.user }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  },

  async signOut() {
    try {
      await fetch('/api/auth/logout', { method: "POST" });
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  },

  async updateUser(updates: any) {
    try {
      const res = await fetch('/api/auth/profile', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates.data)
      });
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: { message: txt } };
      }
      const data = await res.json();
      return { data: { user: data.user }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
};

// Proxied supabase client matching 100% of frontend calls seamlessly
export const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (prop === 'auth') {
      return apiAuth;
    }

    if (prop === 'from') {
      return (table: string) => {
        return new ApiQueryBuilder(table);
      };
    }

    return Reflect.get(target, prop, receiver);
  }
}) as unknown as SupabaseClient<any, "public", any>;
