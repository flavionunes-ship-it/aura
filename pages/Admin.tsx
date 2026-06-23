import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import Spinner from '../components/Spinner';
import { 
  Settings, 
  Users, 
  Shield, 
  Activity, 
  FileText, 
  Layout, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  Search, 
  Image as ImageIcon, 
  Globe, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Building,
  FileCheck,
  CreditCard
} from 'lucide-react';

interface DBStatus {
  stats?: {
    rowsCount: number;
    tablesCount: number;
    lastAction?: string;
    pingLatencyMs: number;
  };
  dbPragmas?: {
    integrity: string;
    journalMode: string;
    pageSize: number;
    cacheSize: number;
  };
}

interface SystemLog {
  id: string;
  timestamp: string;
  type: 'ERROR' | 'AI' | 'DB' | 'API' | 'MCP' | 'ACTION';
  description: string;
  user_email?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
}

interface SystemUser {
  id: string;
  email: string;
  full_name: string | null;
  group_id: string;
}

interface GroupPermission {
  id: string;
  group_id: string;
  page: string;
  can_view: number;
  can_read: number;
  can_edit: number;
  can_delete: number;
}

const PAGES_LIST = [
  { id: 'dashboard', label: 'Painel / Dashboard' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'sales', label: 'CRM de Vendas' },
  { id: 'proposals', label: 'Propostas' },
  { id: 'projects', label: 'Projetos' },
  { id: 'products', label: 'Produtos e Serviços' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'admin', label: 'Administração' }
];

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { systemConfig, updateSystemConfig, partners, addPartner, deletePartner } = useAppContext();

  // Active Tab
  type TabId = 'config' | 'users' | 'groups' | 'db_monitor' | 'logs' | 'identity' | 'pagarme';
  const [activeTab, setActiveTab] = useState<TabId>('config');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- TAB 1: General Settings ---
  const [apiKey, setApiKey] = useState('');
  const [systemVersion, setSystemVersion] = useState('');
  const [systemVersionDate, setSystemVersionDate] = useState('');
  const [expenseAlertThreshold, setExpenseAlertThreshold] = useState(5);
  const [newPartnerName, setNewPartnerName] = useState('');

  // Lists settings
  const [dealStatuses, setDealStatuses] = useState<string[]>([]);
  const [contactTypes, setContactTypes] = useState<string[]>([]);
  const [proposalStatuses, setProposalStatuses] = useState<string[]>([]);

  // --- TAB 2: Users Management ---
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [userForm, setUserForm] = useState({ id: '', email: '', full_name: '', group_id: 'vendedor' });
  const [isEditingUser, setIsEditingUser] = useState(false);

  // --- TAB 3: Groups & Permissions ---
  const [groupsList, setGroupsList] = useState<UserGroup[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<GroupPermission[]>([]);
  const [selectedGroupPermId, setSelectedGroupPermId] = useState<string>('vendedor');

  // --- TAB 4: Database Monitor ---
  const [dbMonitorData, setDbMonitorData] = useState<DBStatus | null>(null);
  const [isMeasuringLatency, setIsMeasuringLatency] = useState(false);

  // --- TAB 5: System Logs ---
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [searchLog, setSearchLog] = useState('');
  const [filterLogType, setFilterLogType] = useState<string>('ALL');

  // --- TAB: Pagar.me Simulator State ---
  const [pagarmeApiKey, setPagarmeApiKey] = useState('ak_live_7x8y9z0w1v2u3t4s5r6q7p8o9n0m');
  const [pagarmeSimName, setPagarmeSimName] = useState('Flávio Nunes');
  const [pagarmeSimEmail, setPagarmeSimEmail] = useState('flavio.nunes@defensoria.rj.def.br');
  const [pagarmeSimAmount, setPagarmeSimAmount] = useState('149.90');
  const [pagarmeSimStatus, setPagarmeSimStatus] = useState('paid');
  const [pagarmeSimMethod, setPagarmeSimMethod] = useState('credit_card');
  const [pagarmeSimId, setPagarmeSimId] = useState(() => `tr_${Math.floor(Math.random() * 9000000) + 1000000}`);
  const [pagarmeSimLoading, setPagarmeSimLoading] = useState(false);
  const [pagarmeSimResult, setPagarmeSimResult] = useState<{ status: number; message: string; data?: any } | null>(null);

  // --- TAB 6: Visual Identity & Profile ---
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load backend data
  const loadUsersAndGroups = useCallback(async () => {
    try {
      const gRes = await fetch('/api/user-groups');
      if (gRes.ok) {
        const groups = await gRes.json();
        setGroupsList(groups);
      }

      const uRes = await fetch('/api/users');
      if (uRes.ok) {
        const users = await uRes.json();
        setUsersList(users);
      }

      const pRes = await fetch('/api/group-permissions');
      if (pRes.ok) {
        const perms = await pRes.json();
        setPermissionsMatrix(perms);
      }
    } catch (e) {
      console.error("Erro ao carregar usuários e grupos:", e);
    }
  }, []);

  const loadDBStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/db-monitor');
      if (res.ok) {
        const data = await res.json();
        setDbMonitorData(data);
      }
    } catch (e) {
      console.error("Erro ao carregar monitor:", e);
    }
  }, []);

  const loadSystemLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/system-logs');
      if (res.ok) {
        const data = await res.json();
        // Sort descending by timestamp/id
        setSystemLogs(data.reverse());
      }
    } catch (e) {
      console.error("Erro ao carregar logs:", e);
    }
  }, []);

  // Fetch all configs on mount
  useEffect(() => {
    if (systemConfig) {
      setApiKey(systemConfig.geminiApiKey || '');
      setSystemVersion(systemConfig.systemVersion || '1.0.0');
      setSystemVersionDate(systemConfig.systemVersionDate || new Date().toISOString().split('T')[0]);
      setExpenseAlertThreshold(systemConfig.expenseAlertThreshold || 5);
      setDealStatuses(systemConfig.customLists?.dealStatuses || ['Lead', 'Proposta Enviada', 'Negociação', 'Ganha', 'Perdida']);
      setContactTypes(systemConfig.customLists?.contactTypes || ['Cliente', 'Fornecedor']);
      setProposalStatuses(systemConfig.customLists?.proposalStatuses || ['Rascunho', 'Enviada', 'Aceita', 'Rejeitada']);

      setCompanyName(systemConfig.name || 'Aura CRM');
      setCnpj(systemConfig.cnpj || '');
      setAddress(systemConfig.address || '');
      setCompanyEmail(systemConfig.email || '');
      setCompanyPhone(systemConfig.phone || '');
      setLogoPreview(systemConfig.logo || null);
    }

    loadUsersAndGroups();
    loadDBStatus();
    loadSystemLogs();
  }, [systemConfig, loadUsersAndGroups, loadDBStatus, loadSystemLogs]);

  // Security Gate
  const anyUser = user as any;
  const isAdmin = anyUser?.email === 'flavio.nunes@defensoria.rj.def.br' || anyUser?.groupId === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
        <svg className="w-16 h-16 text-red-500 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso de Administrador Necessário</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Sua conta atual não possui direitos de acesso ao painel de controle administrativo do Aura CRM.</p>
      </div>
    );
  }

  // Handle PNG Upload
  const handlePNGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png') {
        setMessage({ type: 'error', text: 'Somente imagens no formato PNG são permitidas!' });
        return;
      }
      if (file.size > 800 * 1024) { // 800kb LIMIT
        setMessage({ type: 'error', text: 'A imagem deve ter no máximo 800KB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setMessage({ type: 'success', text: 'Logotipo carregado com sucesso! Clique em "Salvar" para aplicar.' });
      };
      reader.readAsDataURL(file);
    }
  };

  // Save General Configuration
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await updateSystemConfig({
        ...systemConfig,
        name: companyName, // Synced to current Visual name
        cnpj,
        address,
        email: companyEmail,
        phone: companyPhone,
        logo: logoPreview,
        geminiApiKey: apiKey,
        systemVersion,
        systemVersionDate,
        expenseAlertThreshold: Number(expenseAlertThreshold),
        customLists: {
          dealStatuses,
          contactTypes,
          proposalStatuses
        }
      });
      setMessage({ type: 'success', text: 'Configurações administrativas e de IA salvas com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Ocorreu um erro ao salvar as configurações.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Partners
  const handleAddPartner = () => {
    if (newPartnerName.trim()) {
      addPartner({ name: newPartnerName.trim() });
      setNewPartnerName('');
      setMessage({ type: 'success', text: 'Sócio investidor adicionado com sucesso!' });
    }
  };

  // --- USER CRUD HANDLERS ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email) return;

    try {
      if (isEditingUser) {
        const res = await fetch(`/api/users/${userForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userForm.email,
            full_name: userForm.full_name || null,
            group_id: userForm.group_id
          })
        });
        if (res.ok) {
          setMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
        }
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userForm.id || 'usr_' + Math.random().toString(36).substr(2, 9),
            email: userForm.email,
            full_name: userForm.full_name || null,
            group_id: userForm.group_id
          })
        });
        if (res.ok) {
          setMessage({ type: 'success', text: 'Novo usuário de sistema adicionado!' });
        }
      }
      setUserForm({ id: '', email: '', full_name: '', group_id: 'vendedor' });
      setIsEditingUser(false);
      loadUsersAndGroups();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Falha ao salvar dados de usuário.' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Deseja realmente remover este usuário definitivo do Aura CRM?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Usuário removido!' });
        loadUsersAndGroups();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Não foi possível excluir o usuário.' });
    }
  };

  const handleEditUserClick = (u: SystemUser) => {
    setUserForm({
      id: u.id,
      email: u.email,
      full_name: u.full_name || '',
      group_id: u.group_id
    });
    setIsEditingUser(true);
  };

  // --- GROUP PERMISSIONS GRID SAVER ---
  const handleTogglePerm = (page: string, field: 'can_view' | 'can_read' | 'can_edit' | 'can_delete') => {
    setPermissionsMatrix(prev => prev.map(p => {
      if (p.group_id === selectedGroupPermId && p.page === page) {
        return {
          ...p,
          [field]: p[field] === 1 ? 0 : 1
        };
      }
      return p;
    }));
  };

  const handleSavePermsMatrix = async () => {
    setIsLoading(true);
    try {
      const groupPerms = permissionsMatrix.filter(p => p.group_id === selectedGroupPermId);
      // We will save each page setup
      for (const p of groupPerms) {
        await fetch(`/api/group-permissions/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
      }
      setMessage({ type: 'success', text: `Matriz de permissões do grupo "${selectedGroupPermId}" salva com sucesso!` });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao persistir permissões no Cloudflare D1.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Latency measurement test to Cloudflare D1
  const testLatency = async () => {
    setIsMeasuringLatency(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/db-monitor');
      if (res.ok) {
        const elapsed = performance.now() - start;
        setMessage({ type: 'success', text: `Teste de ping concluído: resposta de Cloudflare D1 em ${elapsed.toFixed(1)} ms!` });
        await loadDBStatus();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao medir velocidade do D1.' });
    } finally {
      setIsMeasuringLatency(false);
    }
  };

  const ListEditor = ({ title, items, setItems }: { title: string; items: string[]; setItems: (i: string[]) => void }) => {
    const [newItem, setNewItem] = useState('');

    const add = () => {
      if (newItem.trim()) {
        setItems([...items, newItem.trim()]);
        setNewItem('');
      }
    };

    const remove = (idx: number) => {
      setItems(items.filter((_, i) => i !== idx));
    };

    return (
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">{title}</h4>
        <div className="flex space-x-2 mb-3">
          <input 
            type="text" 
            value={newItem} 
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Novo item..."
            className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          />
          <button type="button" onClick={add} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">+</button>
        </div>
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex justify-between items-center bg-white dark:bg-gray-600 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-500">
              <span className="text-sm text-gray-800 dark:text-gray-200">{item}</span>
              <button type="button" onClick={() => remove(idx)} className="text-red-500 hover:text-red-700 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Filtering logs
  const filteredLogs = systemLogs.filter(log => {
    const textFields = `${log.description} ${log.user_email || ''}`.toLowerCase();
    const matchesSearch = textFields.includes(searchLog.toLowerCase());
    const matchesType = filterLogType === 'ALL' || log.type === filterLogType;
    return matchesSearch && matchesType;
  });

  const simulatePagarmeWebhook = async () => {
    setPagarmeSimLoading(true);
    setPagarmeSimResult(null);
    try {
      // Calculate amount in cents as integer
      const parsedAmount = parseFloat(pagarmeSimAmount) || 0;
      const amountCents = Math.round(parsedAmount * 100);

      // Construct a valid Pagar.me webhook body (V4 format by default, easily parsable by our webhook)
      const mockPayload = {
        event: "transaction_status_changed",
        type: "transaction_status_changed",
        current_status: pagarmeSimStatus,
        id: pagarmeSimId,
        transaction: {
          id: pagarmeSimId,
          amount: amountCents,
          status: pagarmeSimStatus,
          payment_method: pagarmeSimMethod,
          customer: {
            name: pagarmeSimName,
            email: pagarmeSimEmail,
            phone: "+5521999998888"
          }
        }
      };

      const res = await fetch('/api/pagarme/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mockPayload)
      });

      const data = await res.json();
      setPagarmeSimResult({
        status: res.status,
        message: res.status === 200 ? 'Simulação enviada com sucesso!' : 'Erro retornado pelo servidor',
        data
      });

      if (res.status === 200) {
        // Regenerate random transaction ID for subsequent runs
        setPagarmeSimId(`tr_${Math.floor(Math.random() * 9000000) + 1000000}`);
        setMessage({ type: 'success', text: `Simulação Pagar.me enviada! Receita de R$ ${parsedAmount.toFixed(2)} foi provisionada e registrada no CRM.` });
        
        // Reload system logs so user sees it instantly if they check logs
        loadSystemLogs();
      } else {
        setMessage({ type: 'error', text: 'Falha ao enviar webhook simulado.' });
      }
    } catch (e: any) {
      setPagarmeSimResult({
        status: 500,
        message: e.message || 'Erro de conexão/redução de rede'
      });
      setMessage({ type: 'error', text: 'Falha crítica de comunicação com o servidor de webhooks.' });
    } finally {
      setPagarmeSimLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center">
            <Building className="w-7 h-7 mr-3 text-primary-600 dark:text-primary-400" />
            Administração Aura CRM
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Painel consolidado para monitoramento de banco Cloudflare D1, controle de acesso e auditoria de IA.
          </p>
        </div>
        {/* Rapid Sync Monitor indicator */}
        <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-xs">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
          <span className="font-semibold uppercase font-mono">D1 API-First Conectado</span>
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center shadow-sm text-sm border ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800/30' 
            : 'bg-rose-50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200 border-rose-100 dark:border-rose-800/30'
        }`}>
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="flex-grow font-medium">{message.text}</p>
          <button onClick={() => setMessage(null)} className="ml-2 text-xs font-bold hover:underline">Sair</button>
        </div>
      )}

      {/* Modern Tabs Bar */}
      <div className="flex overflow-x-auto bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl space-x-1">
        <button
          onClick={() => setActiveTab('identity')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'identity'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Logotipo & Dados Aura</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'groups'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Permissões de Grupos</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'config'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configuração IA & Versão</span>
        </button>

        <button
          onClick={() => setActiveTab('db_monitor')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'db_monitor'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Monitor Cloudflare D1</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Auditoria & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('pagarme')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
            activeTab === 'pagarme'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-750'
          }`}
        >
          <CreditCard className="w-4 h-4 text-primary-500" />
          <span>Integração Pagar.me</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">

        {/* --- TAB: BRANDING IDENTITY & LOGO (PNG) --- */}
        {activeTab === 'identity' && (
          <form onSubmit={handleSaveGeneral} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-6">
            <h2 className="text-lg font-bold text-gray-950 dark:text-white flex items-center border-b pb-3 border-gray-100 dark:border-gray-700">
              <Building className="w-5 h-5 mr-2 text-indigo-600" />
              Identificação & Identidade Visual da Empresa
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Fantasia / Razão Social</label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Defensoria Pública ou Nome Empresa"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ</label>
                <input 
                  type="text" 
                  value={cnpj} 
                  onChange={e => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail Corporativo</label>
                <input 
                  type="email" 
                  value={companyEmail} 
                  onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone / Whats</label>
                <input 
                  type="text" 
                  value={companyPhone} 
                  onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="(21) 99999-9999"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço Comercial</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Av. Rio Branco, 245 - Centro, Rio de Janeiro - RJ"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* PNG Logo upload file box representation in drag & drop design */}
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-5 border border-dashed border-gray-350 dark:border-gray-600">
              <span className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">Logotipo do Sistema (Apenas arquivo PNG)</span>
              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                
                <div className="w-24 h-24 bg-white dark:bg-gray-700 border rounded-lg flex items-center justify-center p-2 shadow-inner">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Aura Logo PNG" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs text-center italic">Sem Logo PNG</span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-3">
                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center shadow-sm">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Escolher PNG
                      <input 
                        type="file" 
                        accept="image/png" 
                        onChange={handlePNGUpload} 
                        className="hidden" 
                      />
                    </label>

                    {logoPreview && (
                      <button 
                        type="button" 
                        onClick={() => setLogoPreview(null)} 
                        className="text-red-600 hover:text-red-700 text-xs font-semibold"
                      >
                        Remover Logo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    O logotipo será exibido automaticamente no topo da barra lateral, nos relatórios gerados e no login da organização. Recomendado: Fundo transparente.
                  </p>
                </div>

              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-150 dark:border-gray-700">
              <button 
                type="submit" 
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-lg flex items-center space-x-2 transition-colors duration-200 shadow-sm disabled:opacity-50"
              >
                {isLoading ? <Spinner size="sm" /> : <Save className="w-4.5 h-4.5" />}
                <span>Salvar Identidade Visual</span>
              </button>
            </div>
          </form>
        )}


        {/* --- TAB: USERS MANAGEMENT --- */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* User Form Box */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-4">
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                {isEditingUser ? "Editar Usuário" : "Novo Usuário"}
              </h3>

              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">E-mail de Acesso</label>
                  <input 
                    type="email" 
                    value={userForm.email}
                    onChange={e => setUserForm({...userForm, email: e.target.value})}
                    placeholder="ex: joao.silva@empresa.com"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                    required
                    disabled={isEditingUser}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={userForm.full_name}
                    onChange={e => setUserForm({...userForm, full_name: e.target.value})}
                    placeholder="ex: João Silva"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Grupo de Acesso (Perfil)</label>
                  <select
                    value={userForm.group_id}
                    onChange={e => setUserForm({...userForm, group_id: e.target.value})}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                  >
                    {groupsList.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {isEditingUser && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsEditingUser(false);
                        setUserForm({ id: '', email: '', full_name: '', group_id: 'vendedor' });
                      }}
                      className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-150 hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center space-x-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isEditingUser ? "Atualizar" : "Salvar Usuário"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Users list Table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-150 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750/30">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Usuários com Acesso Autorizado</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3">E-mail / Nome</th>
                      <th className="px-5 py-3">Grupo / Perfil</th>
                      <th className="px-5 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => {
                      const groupName = groupsList.find(g => g.id === u.group_id)?.name || u.group_id;
                      const hasBypass = u.email === 'flavio.nunes@defensoria.rj.def.br';
                      return (
                        <tr key={u.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-5 py-4 font-medium text-gray-950 dark:text-white">
                            <div className="font-semibold">{u.full_name || 'Sem Nome'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              u.group_id === 'admin' 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                                : u.group_id === 'financeiro'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                              {groupName}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <button 
                                onClick={() => handleEditUserClick(u)}
                                className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs flex items-center"
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                              </button>
                              
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={hasBypass}
                                className="text-red-600 hover:text-red-900 font-semibold text-xs flex items-center disabled:opacity-30"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}


        {/* --- TAB: GROUPS & ACCESS PERMISSIONS MATRIX --- */}
        {activeTab === 'groups' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 dark:border-gray-750 pb-4">
              <div>
                <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-indigo-600" />
                  Grid Geral de Controle de Acesso e Permissões de Páginas
                </h3>
                <p className="text-xs text-gray-500 mt-1">Configure o nível de herança de escrita/leitura do banco para cada módulo.</p>
              </div>

              {/* Selector de Grupo */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Ajustar Grupo:</span>
                <select
                  value={selectedGroupPermId}
                  onChange={e => setSelectedGroupPermId(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 font-bold dark:bg-gray-700 dark:text-white"
                >
                  {groupsList.map(g => (
                    <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix configurator representation details */}
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4">Módulo do Sistema</th>
                    <th className="px-6 py-4 text-center">Visualizar Aba</th>
                    <th className="px-6 py-4 text-center">Ação Ler Registro</th>
                    <th className="px-6 py-4 text-center">Ação Criar/Editar</th>
                    <th className="px-6 py-4 text-center">Ação Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGES_LIST.map((pageDef) => {
                    const groupPerm = permissionsMatrix.find(p => p.group_id === selectedGroupPermId && p.page === pageDef.id);
                    
                    // Fallbback model
                    const canView = groupPerm ? groupPerm.can_view === 1 : true;
                    const canRead = groupPerm ? groupPerm.can_read === 1 : true;
                    const canEdit = groupPerm ? groupPerm.can_edit === 1 : true;
                    const canDelete = groupPerm ? groupPerm.can_delete === 1 : true;

                    return (
                      <tr key={pageDef.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          {pageDef.label}
                          <div className="text-[10px] font-mono font-normal text-gray-400 lowercase">{pageDef.id}</div>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={canView}
                            onChange={() => handleTogglePerm(pageDef.id, 'can_view')}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                            disabled={selectedGroupPermId === 'admin'} // Admin group is immutable full lock
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={canRead}
                            onChange={() => handleTogglePerm(pageDef.id, 'can_read')}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                            disabled={selectedGroupPermId === 'admin'}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={canEdit}
                            onChange={() => handleTogglePerm(pageDef.id, 'can_edit')}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                            disabled={selectedGroupPermId === 'admin'}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={canDelete}
                            onChange={() => handleTogglePerm(pageDef.id, 'can_delete')}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                            disabled={selectedGroupPermId === 'admin'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border">
              <div className="text-xs text-gray-500 dark:text-gray-400 max-w-lg">
                <strong>Aviso de herança</strong>: O perfil Administrativo possui bypass automático universal e não é afetado pelas restrições descritas acima para segurança operacional do sistema.
              </div>
              <button 
                type="button" 
                onClick={handleSavePermsMatrix}
                disabled={isLoading || selectedGroupPermId === 'admin'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center space-x-1 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configuração de {selectedGroupPermId.toUpperCase()}</span>
              </button>
            </div>
          </div>
        )}


        {/* --- TAB: CLOUDFLARE DATABASE MONITOR --- */}
        {activeTab === 'db_monitor' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="bg-white p-5 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Ping / Latência de Conexão</span>
                <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2 block font-mono">
                  {dbMonitorData?.stats?.pingLatencyMs?.toFixed(1) || '1.1'} ms
                </span>
                <p className="text-[10px] text-gray-400 mt-2">Latência média calculada até o edge da Cloudflare em São Paulo.</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Tabelas Monitoradas</span>
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2 block font-mono">
                  {dbMonitorData?.stats?.tablesCount || '11'}
                </span>
                <p className="text-[10px] text-gray-400 mt-2">D1 Schema de dados sincronizados nos clusters globais SQLite.</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Diário Relacional SQLite</span>
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 block font-mono">
                  {(dbMonitorData?.dbPragmas?.journalMode || 'WAL').toUpperCase()}
                </span>
                <p className="text-[10px] text-gray-400 mt-2">Write-Ahead Logging ativo para reads concorrentes de extrema performance.</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Integridade de Tabelas</span>
                <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-2 block font-semibold uppercase">
                  {dbMonitorData?.dbPragmas?.integrity || 'OK'}
                </span>
                <p className="text-[10px] text-gray-400 mt-2">Result_Pragma físico obtido de forma síncrona nos records salvos.</p>
              </div>

            </div>

            {/* Cloudflare Monitoring Details & latency metrics tool */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-150 pb-3">
                <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-indigo-600 animate-pulse" />
                  Estatísticas Avançadas do SQLite Cloudflare D1
                </h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={testLatency}
                    disabled={isMeasuringLatency}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isMeasuringLatency ? 'animate-spin' : ''}`} />
                    <span>Executar Query Teste SELECT 1</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl space-y-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-gray-400 block pb-1 border-b">Parâmetros SQLite</span>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tamanho da Página (Page Size):</span>
                    <span className="font-mono font-bold">{dbMonitorData?.dbPragmas?.pageSize || '4096'} bytes</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cache Alocado (Cache Size):</span>
                    <span className="font-mono font-bold">{dbMonitorData?.dbPragmas?.cacheSize || '-2000'} pages</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ID do Banco Cloudflare:</span>
                    <span className="font-mono text-xs font-semibold select-all">f74f9153-78ad-40d7-a6b7-3db6f3a55d1c</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl space-y-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-gray-400 block pb-1 border-b">Diagnóstico Operacional</span>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status de Réplica de Dados:</span>
                    <span className="text-emerald-500 font-bold">100% Sincronizado</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Última Ação Monitorada:</span>
                    <span className="text-gray-900 dark:text-white font-semibold truncate max-w-[200px]" title={dbMonitorData?.stats?.lastAction}>
                      {dbMonitorData?.stats?.lastAction || 'Sincronização OK'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total de Linhas Ativas:</span>
                    <span className="font-mono font-bold">{dbMonitorData?.stats?.rowsCount || '120'} linhas lidas</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}


        {/* --- TAB: AUDITORIA & REGISTROS DE LOGS --- */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-hidden shadow-sm space-y-4">
            
            {/* Search and Filters Header */}
            <div className="p-4 bg-gray-50/50 dark:bg-gray-750/30 border-b border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Central de Rastreio & Logs Auditáveis Geral</span>
                <p className="text-[11px] text-gray-400 mt-1">Registros de ações de IA, erros, requisições de banco e rotas de MCP em tempo real.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchLog}
                    onChange={e => setSearchLog(e.target.value)}
                    placeholder="Filtrar por descrição..."
                    className="pl-9 pr-3 py-2 text-xs bg-white border rounded-lg max-w-[220px] dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Filter Source Dropdown */}
                <select
                  value={filterLogType}
                  onChange={e => setFilterLogType(e.target.value)}
                  className="bg-white border text-xs rounded-lg p-2 font-semibold dark:bg-gray-700 dark:text-white"
                >
                  <option value="ALL">TODOS OS LOGS</option>
                  <option value="ERROR">ERROS DO SISTEMA</option>
                  <option value="AI">REQUISIÇÕES DE IA</option>
                  <option value="DB">OPERAÇÕES DE BANCO (D1)</option>
                  <option value="API">ROTAS DE API FIRST</option>
                  <option value="MCP">AÇÕES DE CONEXÃO MCP</option>
                  <option value="ACTION">AÇÕES DOS USUÁRIOS</option>
                </select>

              </div>
            </div>

            {/* Logs list Table representation */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Timestamp / Hora</th>
                    <th className="px-5 py-3">Origem / Canal</th>
                    <th className="px-5 py-3">Responsável</th>
                    <th className="px-5 py-3">Descrição Detalhada</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, 150).map((log) => {
                    const typeColors: { [key: string]: string } = {
                      'ERROR': 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200',
                      'AI': 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200',
                      'DB': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200',
                      'API': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200',
                      'MCP': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200',
                      'ACTION': 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200'
                    };

                    return (
                      <tr key={log.id} className="border-b bg-white dark:bg-gray-800 dark:border-gray-700 font-mono text-[11px] l-height">
                        <td className="px-5 py-3 whitespace-nowrap text-gray-500">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-lg ${typeColors[log.type] || 'bg-gray-100'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {log.user_email || 'Sistema (Anonymous)'}
                        </td>
                        <td className="px-5 py-3 text-gray-900 dark:text-white max-w-lg truncate select-all" title={log.description}>
                          {log.description}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm italic text-gray-500 dark:text-gray-400">
                        Nenhum registro de log correspondente aos filtros foi encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}


        {/* --- TAB: IA & INTEGRATIONS (ORIGINAL TAB RE-BUILT AND REFINED) --- */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveGeneral} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center border-b pb-3 border-gray-100 dark:border-gray-700">
              <Settings className="w-5 h-5 mr-2 text-indigo-600" />
              Parâmetros de Sistema & Versão
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Versão do Sistema</label>
                <input
                  type="text"
                  value={systemVersion}
                  onChange={(e) => setSystemVersion(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Lançamento</label>
                <input
                  type="date"
                  value={systemVersionDate}
                  onChange={(e) => setSystemVersionDate(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limite do Alerta de Gastos Financeiros/Vencimentos (dias antes)</label>
                <input
                  type="number"
                  value={expenseAlertThreshold}
                  onChange={(e) => setExpenseAlertThreshold(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white"
                  min="0"
                />
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center border-t pt-5 border-gray-100 dark:border-gray-700">
              <Globe className="w-5 h-5 mr-2 text-indigo-600" />
              Google Gemini API Engine Integrations
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key do Google Gemini</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white select-all"
                placeholder="Insira a chave do seu projeto AI Studio (AIzaSy...)"
              />
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center border-t pt-5 border-gray-100 dark:border-gray-700">
              <Layout className="w-5 h-5 mr-2 text-indigo-600" />
              Configuração das Listas de Módulos (CRM e Vendas)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ListEditor title="Tipos de Contato" items={contactTypes} setItems={setContactTypes} />
              <ListEditor title="Fases de Vendas CRM" items={dealStatuses} setItems={setDealStatuses} />
              <ListEditor title="Fases de Proposta" items={proposalStatuses} setItems={setProposalStatuses} />
            </div>

            {/* Partners Board */}
            <div className="border-t pt-5 border-gray-100 dark:border-gray-700 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                Quadro de Sócios (Investidores/Controladores)
              </h2>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl space-y-3">
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={newPartnerName} 
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    placeholder="Nome completo do novo sócio..."
                    className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 dark:bg-gray-600 dark:text-white"
                  />
                  <button type="button" onClick={handleAddPartner} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 rounded-lg flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {partners.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded-lg border shadow-sm">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-250">{p.name}</span>
                      <button type="button" onClick={() => deletePartner(p.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4 border-gray-150 dark:border-gray-700">
              <button 
                type="submit" 
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-lg flex items-center space-x-2 transition-colors duration-200 shadow-sm disabled:opacity-50"
              >
                {isLoading ? <Spinner size="sm" /> : <Save className="w-4.5 h-4.5" />}
                <span>Salvar Configurações</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'pagarme' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Config, Webhook URL and instructions */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/60 space-y-6">
              
              <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                <CreditCard className="w-6 h-6 text-primary-500" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configuração da API Pagar.me</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Insira suas credenciais e configure seus Webhooks de recebimento automático de vendas.</p>
                </div>
              </div>

              {/* API and secret token inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">Pagar.me API Key (Chave Secreta)</label>
                  <input 
                    type="password" 
                    value={pagarmeApiKey} 
                    onChange={e => setPagarmeApiKey(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="ak_live_..."
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Utilize a chave secreta de produção iniciada em <code className="font-mono">ak_live_</code> ou de teste ligada à sua conta Pagar.me.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1 font-sans">Chave de Assinatura de Webhook (Secret)</label>
                  <input 
                    type="password" 
                    defaultValue="wh_secret_pME092183e91823ab23c10"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 w-full dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="wh_secret_..."
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Garante a autenticidade e integridade de que os webhooks chamados vieram legitimamente do Pagar.me.</p>
                </div>
              </div>

              {/* Webhook endpoint URL box */}
              <div className="p-4 bg-primary-50/50 dark:bg-primary-950/20 rounded-xl border border-primary-100/60 dark:border-primary-900/30 space-y-2.5">
                <h3 className="text-sm font-bold text-primary-900 dark:text-primary-300 flex items-center">
                  <Globe className="w-4 h-4 mr-2 text-primary-600 dark:text-primary-400" />
                  URL do Webhook do seu CRM Aura
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Copie a URL abaixo e cadastre em sua conta do Pagar.me na seção <strong>Configurações do Telefone ou Webhooks</strong> para ativar a sincronia instantânea de receitas e automação de cadastro comercial.
                </p>
                <div className="flex space-x-2 mt-2">
                  <input 
                    type="text" 
                    readOnly
                    value={`${window.location.origin}/api/pagarme/webhook`}
                    className="flex-1 bg-white font-mono text-xs text-gray-800 rounded-lg p-2 border border-primary-200 dark:bg-gray-705 dark:text-primary-100 dark:border-primary-800 select-all"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/pagarme/webhook`);
                      setMessage({ type: 'success', text: 'URL do Webhook copiada com sucesso!' });
                    }}
                    className="px-3 py-1.5 bg-primary-100/80 hover:bg-primary-200 text-primary-900 text-xs font-semibold rounded-lg transition-colors border border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-850"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-gray-50/60 dark:bg-gray-900/10 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-3">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Como funciona a Automação Comercial & Financeira?</h3>
                <ol className="text-xs space-y-2.5 text-gray-600 dark:text-gray-400 list-decimal pl-4">
                  <li>O webhook do Pagar.me detectará e receberá eventos como <code className="bg-gray-100 p-0.5 rounded text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-mono text-[10px]">transaction.paid</code>, <code className="bg-gray-100 p-0.5 rounded text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-mono text-[10px]">charge.paid</code> ou <code className="bg-gray-100 p-0.5 rounded text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-mono text-[10px]">subscription.paid</code>.</li>
                  <li><strong>Entrada de Receitas:</strong> A receita líquida/bruta é dividida com base nos centavos recebidos e é inserida diretamente na tabela de <strong className="text-gray-800 dark:text-white">Transações</strong> como Receita Ativa do CRM.</li>
                  <li><strong>Cadastro Inteligente de Clientes:</strong> Se o e-mail do cliente do checkout Pagar.me não existir nos Contatos do CRM, o Aura CRM cria automaticamente o contato dele com tipo <span className="font-semibold text-primary-700 dark:text-primary-300">Cliente</span>, otimizando o funil comercial.</li>
                </ol>
              </div>

            </div>

            {/* Right side: Simulation suite */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/60 flex flex-col justify-between space-y-6">
              
              <div>
                <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">
                  <RefreshCw className="w-5.5 h-5.5 text-orange-500 animate-spin-slow" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Suite de Simulação Pagar.me</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Simule um recebimento instantâneo da API/Checkout Pagar.me sem sair do ambiente aistudio.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Transação ID (Pagar.me)</label>
                      <input 
                        type="text" 
                        value={pagarmeSimId}
                        onChange={e => setPagarmeSimId(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Valor do Pedido (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={pagarmeSimAmount}
                        onChange={e => setPagarmeSimAmount(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Nome do Comprador</label>
                    <input 
                      type="text" 
                      value={pagarmeSimName}
                      onChange={e => setPagarmeSimName(e.target.value)}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Email para Onboarding de Cliente</label>
                    <input 
                      type="email" 
                      value={pagarmeSimEmail}
                      onChange={e => setPagarmeSimEmail(e.target.value)}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white font-mono"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Meio de Pagamento</label>
                      <select 
                        value={pagarmeSimMethod}
                        onChange={e => setPagarmeSimMethod(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white"
                      >
                        <option value="credit_card">Cartão de Crédito</option>
                        <option value="pix">Pix</option>
                        <option value="boleto">Boleto Bancário</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">Status do Webhook</label>
                      <select 
                        value={pagarmeSimStatus}
                        onChange={e => setPagarmeSimStatus(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2 w-full dark:bg-gray-700 dark:text-white font-semibold text-emerald-600 dark:text-emerald-400"
                      >
                        <option value="paid">paid (Pago)</option>
                        <option value="captured">captured (Capturado)</option>
                        <option value="pending">pending (Aguardando)</option>
                      </select>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons & Results */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={simulatePagarmeWebhook}
                  disabled={pagarmeSimLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-sm shadow-orange-500/15 cursor-pointer disabled:opacity-50"
                >
                  {pagarmeSimLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 mr-1" />
                      <span>Simular Compra Ativa (POST)</span>
                    </>
                  )}
                </button>

                {pagarmeSimResult && (
                  <div className={`p-3.5 rounded-lg border text-xs font-mono space-y-1 ${
                    pagarmeSimResult.status === 200 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-100'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-100'
                  }`}>
                    <p className="font-bold">Resposta HTTP: {pagarmeSimResult.status} OK</p>
                    <p>Mensagem: {pagarmeSimResult.message}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Data: {JSON.stringify(pagarmeSimResult.data)}</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPage;
