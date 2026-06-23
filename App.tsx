
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NAV_ITEMS } from './constants';
import { Page, SystemConfig, TransactionType, Transaction } from './types';
import DashboardPage from './pages/Dashboard';
import ContactsPage from './pages/Contacts';
import SalesCRMPage from './pages/SalesCRM';
import ProductsPage from './pages/Products';
import FinancePage from './pages/Finance';
import ProposalsPage from './pages/Proposals';
import ProjectsPage from './pages/Projects';
import UserProfile from './pages/UserProfile';
import AdminPage from './pages/Admin';
import LoginPage from './pages/Login';
import Modal from './components/Modal';
import Spinner from './components/Spinner';

// --- Reusable Components defined here for simplicity ---

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  checkPermission: (page: Page, action: 'view' | 'read' | 'edit' | 'delete') => boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isSidebarOpen, setSidebarOpen, checkPermission }) => {
  const baseClasses = "flex items-center p-3 rounded-lg text-gray-900 dark:text-white group transition-all duration-200";
  const activeClasses = "bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300";
  const hoverClasses = "hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white border-r border-gray-200 sm:translate-x-0 dark:bg-gray-800 dark:border-gray-700`}
        aria-label="Sidebar"
      >
        <div className="h-full px-3 pb-4 overflow-y-auto bg-white dark:bg-gray-800">
          <ul className="space-y-2 font-medium">
            {NAV_ITEMS.filter((item) => checkPermission(item.id, 'view')).map((item) => (
              <li key={item.id}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActivePage(item.id);
                    if (window.innerWidth < 640) {
                        setSidebarOpen(false);
                    }
                  }}
                  className={`${baseClasses} ${activePage === item.id ? activeClasses : hoverClasses}`}
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-gray-900/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </>
  );
};

const Header: React.FC<{ 
    onMenuClick: () => void; 
    systemConfig: SystemConfig; 
    onOpenSettings: () => void;
    onNavigate: (page: Page) => void;
    isAdmin: boolean;
}> = ({ onMenuClick, systemConfig, onOpenSettings, onNavigate, isAdmin }) => {
    const { user, signOut } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    return (
        <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-b-0">
            <div className="px-3 py-3 lg:px-5 lg:pl-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center justify-start">
                <button
                    onClick={onMenuClick}
                    aria-controls="logo-sidebar"
                    type="button"
                    className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                >
                    <span className="sr-only">Open sidebar</span>
                    <svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path clipRule="evenodd" fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"></path>
                    </svg>
                </button>
                <a href="#" className="flex ml-2 md:mr-24 items-center">
                    {systemConfig.logo ? (
                        <img src={systemConfig.logo} alt="Logo" className="h-8 object-contain rounded-lg max-w-[140px]" />
                    ) : (
                        <>
                            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            <span className="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap dark:text-white">{systemConfig.name}</span>
                        </>
                    )}
                </a>
                </div>
                
                {/* User Menu Area */}
                <div className="flex items-center relative" ref={menuRef}>
                    {isAdmin && (
                        <button 
                            onClick={() => onNavigate('admin')}
                            className="hidden md:flex items-center mr-4 px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-lg dark:text-gray-200 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Administração
                        </button>
                    )}

                    <button 
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center space-x-3 focus:outline-none"
                    >
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.user_metadata?.full_name || user?.email}</span>
                        </div>
                        {user?.user_metadata?.avatar_url ? (
                            <img className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600" src={user.user_metadata.avatar_url} alt="User photo" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold border border-gray-200 dark:border-gray-600">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 z-50">
                            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 md:hidden">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{user?.email}</p>
                            </div>
                            <button onClick={() => { onNavigate('profile'); setIsUserMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">Meu Perfil</button>
                            {isAdmin && (
                                <button onClick={() => { onNavigate('admin'); setIsUserMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">Administração</button>
                            )}
                            <button onClick={onOpenSettings} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">Configurações</button>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                            <button onClick={signOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700">Sair</button>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </nav>
    );
};

const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { systemConfig, updateSystemConfig } = useAppContext();
    const [name, setName] = useState(systemConfig.name);
    const [logoPreview, setLogoPreview] = useState<string | null>(systemConfig.logo);

    useEffect(() => {
        if(isOpen) {
            setName(systemConfig.name);
            setLogoPreview(systemConfig.logo);
        }
    }, [isOpen, systemConfig]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 500000) { // Limit 500kb
                alert("O arquivo é muito grande (máx 500kb).");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateSystemConfig({ ...systemConfig, name, logo: logoPreview });
        onClose();
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Sistema">
            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <label htmlFor="systemName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome do Sistema</label>
                    <input 
                        type="text" 
                        id="systemName" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:text-white" 
                        required 
                    />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Logo do Sistema</label>
                    <div className="flex items-center space-x-4">
                        {logoPreview ? (
                            <div className="relative">
                                <img src={logoPreview} alt="Preview" className="h-16 w-auto object-contain border border-gray-200 rounded" />
                                <button type="button" onClick={handleRemoveLogo} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded text-gray-400 text-xs">Sem Logo</div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Recomendado: PNG ou SVG transparente. Máx 500kb.</p>
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Salvar Alterações</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Footer Component ---
const Footer: React.FC<{ systemConfig: SystemConfig }> = ({ systemConfig }) => {
    return (
        <footer className="mt-auto py-4 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p>
                {systemConfig.name} © {new Date().getFullYear()} 
                {systemConfig.systemVersion && ` - v${systemConfig.systemVersion}`}
                {systemConfig.systemVersionDate && ` (${new Date(systemConfig.systemVersionDate).toLocaleDateString()})`}
            </p>
        </footer>
    );
};

// --- Expense Alert Component ---
const ExpenseAlertModal: React.FC<{ transactions: Transaction[], threshold: number, onClose: () => void }> = ({ transactions, threshold, onClose }) => {
    const expiringExpenses = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + threshold);
        limitDate.setHours(23,59,59,999);

        return transactions.filter(t => {
            if (t.type !== TransactionType.EXPENSE) return false;
            const tDate = new Date(t.date);
            return tDate >= today && tDate <= limitDate;
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, threshold]);

    if (expiringExpenses.length === 0) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title="⚠️ Alerta de Vencimentos">
            <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                    As seguintes despesas vencerão nos próximos <strong>{threshold} dias</strong>:
                </p>
                <div className="max-h-60 overflow-y-auto border rounded-lg border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Descrição</th>
                                <th className="px-4 py-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringExpenses.map(t => (
                                <tr key={t.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <td className="px-4 py-2">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{t.description}</td>
                                    <td className="px-4 py-2 text-right font-bold text-red-600">R${t.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Entendido</button>
                </div>
            </div>
        </Modal>
    );
};

const MainLayout: React.FC = () => {
    const { systemConfig, isLoading, transactions } = useAppContext();
    const { user } = useAuth();
    const [activePage, setActivePage] = useState<Page>('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showAlert, setShowAlert] = useState(true);

    useEffect(() => {
        document.title = systemConfig.name;
    }, [systemConfig.name]);

    const checkPermission = React.useCallback((page: Page, action: 'view' | 'read' | 'edit' | 'delete'): boolean => {
        const anyUser = user as any;
        if (!anyUser) return false;
        
        // Root override
        if (anyUser.email === 'flavio.nunes@defensoria.rj.def.br') return true;
        if (anyUser.groupId === 'admin') return true;

        if (!anyUser.permissions || !Array.isArray(anyUser.permissions)) {
            // Default rules: everything but admin page
            return page !== 'admin';
        }

        const perm = anyUser.permissions.find((p: any) => p.page === page);
        if (!perm) return false;

        if (action === 'view') return perm.can_view === 1;
        if (action === 'read') return perm.can_read === 1;
        if (action === 'edit') return perm.can_edit === 1;
        if (action === 'delete') return perm.can_delete === 1;

        return false;
    }, [user]);

    const renderContent = () => {
        if (isLoading) {
             return <div className="h-[80vh] flex items-center justify-center"><Spinner size="lg" /></div>;
        }

        // Secure page view
        if (!checkPermission(activePage, 'view')) {
            return (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm max-w-lg mx-auto">
                    <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Restrito</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Você não tem permissão para acessar esta seção. Entre em contato com o administrador.</p>
                </div>
            );
        }

        switch (activePage) {
        case 'dashboard': return <DashboardPage />;
        case 'contacts': return <ContactsPage />;
        case 'sales': return <SalesCRMPage />;
        case 'proposals': return <ProposalsPage />;
        case 'projects': return <ProjectsPage />;
        case 'products': return <ProductsPage />;
        case 'finance': return <FinancePage />;
        case 'profile': return <UserProfile />;
        case 'admin': return <AdminPage />;
        default: return <DashboardPage />;
        }
    };

    const isAdmin = user?.email === 'flavio.nunes@defensoria.rj.def.br' || (user as any)?.groupId === 'admin';

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <Header 
                onMenuClick={() => setSidebarOpen(!isSidebarOpen)} 
                systemConfig={systemConfig} 
                onOpenSettings={() => setIsSettingsOpen(true)}
                onNavigate={setActivePage}
                isAdmin={isAdmin}
            />
            <Sidebar activePage={activePage} setActivePage={setActivePage} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} checkPermission={checkPermission} />
            <main className="p-4 sm:ml-64 flex-grow flex flex-col">
                <div className="mt-14 flex-grow">
                    {renderContent()}
                </div>
                <Footer systemConfig={systemConfig} />
            </main>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            
            {/* Expense Alert Modal - Shows once on load if enabled and data exists */}
            {!isLoading && showAlert && systemConfig.expenseAlertThreshold && systemConfig.expenseAlertThreshold > 0 && (
                <ExpenseAlertModal 
                    transactions={transactions} 
                    threshold={systemConfig.expenseAlertThreshold} 
                    onClose={() => setShowAlert(false)} 
                />
            )}
        </div>
    );
}

const AppContent: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><Spinner size="lg" /></div>;
    }

    if (!user) {
        return <LoginPage />;
    }

    return (
        <AppProvider>
            <MainLayout />
        </AppProvider>
    );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
