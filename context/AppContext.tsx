
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Contact, Product, Deal, Transaction, ContactType, DealStatus, TransactionType, Proposal, ProposalStatus, Project, ProjectStage, ProjectTask, ProjectStatus, ProjectProduct, Partner, SystemConfig } from '../types';
import { supabase } from '../services/supabase';
import { useToast } from '../components/Toast';
import { SALES_STAGES } from '../constants';

interface AppContextType {
    systemConfig: SystemConfig;
    updateSystemConfig: (config: SystemConfig) => Promise<void>;
    contacts: Contact[];
    products: Product[];
    deals: Deal[];
    transactions: Transaction[];
    partners: Partner[];
    proposals: Proposal[];
    projects: Project[];
    projectStages: ProjectStage[];
    projectTasks: ProjectTask[];
    projectProducts: ProjectProduct[];

    salesStages: string[];
    contactTypes: string[];
    proposalStatuses: string[];

    isLoading: boolean;
    addContact: (contact: Omit<Contact, 'id'>) => Promise<void>;
    updateContact: (contact: Contact) => Promise<void>;
    deleteContact: (id: string) => Promise<void>;
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addDeal: (deal: Omit<Deal, 'id'>) => Promise<void>;
    updateDeal: (deal: Deal) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
    updateTransaction: (transaction: Transaction) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    addPartner: (partner: Omit<Partner, 'id'>) => Promise<void>;
    deletePartner: (id: string) => Promise<void>;
    addProposal: (proposal: Omit<Proposal, 'id'>) => Promise<void>;
    updateProposal: (proposal: Proposal) => Promise<void>;
    deleteProposal: (id: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    addStage: (stage: Omit<ProjectStage, 'id'>) => Promise<void>;
    updateStage: (stage: ProjectStage) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
    addTask: (task: Omit<ProjectTask, 'id'>) => Promise<void>;
    updateTask: (task: ProjectTask) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    addProjectProduct: (product: Omit<ProjectProduct, 'id'>) => Promise<void>;
    updateProjectProduct: (product: ProjectProduct) => Promise<void>;
    deleteProjectProduct: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialSystemConfig: SystemConfig = {
    name: 'Aura CRM',
    logo: null
};

// ─── Helpers de Data ──────────────────────────────────────────────────────────
function addDays(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { showToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [systemConfig, setSystemConfig] = useState<SystemConfig>(initialSystemConfig);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectStages, setProjectStages] = useState<ProjectStage[]>([]);
    const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
    const [projectProducts, setProjectProducts] = useState<ProjectProduct[]>([]);

    // ─── Fetch Inicial ────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const results = await Promise.all([
                supabase.from('system_config').select('*').limit(1).single(),
                supabase.from('contacts').select('*'),
                supabase.from('products').select('*'),
                supabase.from('deals').select('*'),
                supabase.from('transactions').select('*'),
                supabase.from('partners').select('*'),
                supabase.from('proposals').select('*'),
                supabase.from('projects').select('*'),
                supabase.from('project_stages').select('*'),
                supabase.from('project_tasks').select('*'),
                supabase.from('project_products').select('*')
            ]);

            if (results[0].data)  setSystemConfig(results[0].data);
            if (results[1].data)  setContacts(results[1].data);
            if (results[2].data)  setProducts(results[2].data);
            if (results[3].data)  setDeals(results[3].data);
            if (results[4].data)  setTransactions(results[4].data);
            if (results[5].data)  setPartners(results[5].data);
            if (results[6].data)  setProposals(results[6].data);
            if (results[7].data)  setProjects(results[7].data);
            if (results[8].data)  setProjectStages(results[8].data);
            if (results[9].data)  setProjectTasks(results[9].data);
            if (results[10].data) setProjectProducts(results[10].data);
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
            showToast('Erro ao carregar dados do sistema.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Listas dinâmicas ─────────────────────────────────────────────────────
    const salesStages      = systemConfig.customLists?.dealStatuses    || SALES_STAGES;
    const contactTypes     = systemConfig.customLists?.contactTypes    || [ContactType.CLIENT, ContactType.SUPPLIER];
    const proposalStatuses = systemConfig.customLists?.proposalStatuses || Object.values(ProposalStatus);

    // ─── Lógica de cadeia de tarefas ──────────────────────────────────────────
    // Recalcula as datas de tasks sucessoras APENAS no estado local.
    // As atualizações no banco são feitas individualmente pelos chamadores.
    const computeTaskChain = (
        allTasks: ProjectTask[],
        changedTask: ProjectTask
    ): ProjectTask[] => {
        const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));
        taskMap.set(changedTask.id, { ...changedTask });

        const visit = (taskId: string, visited = new Set<string>()) => {
            if (visited.has(taskId)) return; // prevenção de ciclo
            visited.add(taskId);
            const task = taskMap.get(taskId);
            if (!task) return;
            taskMap.forEach(successor => {
                if (successor.predecessorTaskId === taskId) {
                    const newStart = addDays(task.endDate, 1);
                    const newEnd   = addDays(newStart, successor.durationDays - 1);
                    successor.startDate = newStart;
                    successor.endDate   = newEnd;
                    visit(successor.id, visited);
                }
            });
        };

        visit(changedTask.id);
        return allTasks.map(t => taskMap.get(t.id) || t);
    };

    // ─── Lógica de criação de Projeto + Stages (única fonte de verdade) ───────
    const createProjectWithStages = async (
        projectData: Omit<Project, 'id'>,
        initialTaskData?: { name: string; startDate: string; endDate: string; durationDays: number }
    ): Promise<Project | null> => {
        const { data: newProject, error: projErr } = await supabase.from('projects').insert(projectData).select().single();
        if (!newProject || projErr) return null;

        setProjects(prev => [...prev, newProject]);

        const stageNames = ['Iniciação do Projeto', 'Execução', 'Fechamento do Projeto'];
        const { data: createdStages } = await supabase.from('project_stages').insert(
            stageNames.map((name, i) => ({ projectId: newProject.id, name, order: i + 1 }))
        ).select();

        if (createdStages && createdStages.length === 3) {
            setProjectStages(prev => [...prev, ...createdStages]);
            // Encadear predecessores
            await supabase.from('project_stages').update({ predecessorStageId: createdStages[0].id }).eq('id', createdStages[1].id);
            await supabase.from('project_stages').update({ predecessorStageId: createdStages[1].id }).eq('id', createdStages[2].id);
            setProjectStages(prev => prev.map(s => {
                if (s.id === createdStages[1].id) return { ...s, predecessorStageId: createdStages[0].id };
                if (s.id === createdStages[2].id) return { ...s, predecessorStageId: createdStages[1].id };
                return s;
            }));

            // Tarefa inicial na fase Execução
            if (initialTaskData) {
                const execStage = createdStages.find(s => s.name === 'Execução');
                if (execStage) {
                    const taskPayload = {
                        projectId: newProject.id,
                        stageId: execStage.id,
                        isCompleted: false,
                        ...initialTaskData
                    };
                    const { data: newTask } = await supabase.from('project_tasks').insert(taskPayload).select().single();
                    if (newTask) setProjectTasks(prev => [...prev, newTask]);
                }
            }
        }

        return newProject;
    };

    // ─── System Config ────────────────────────────────────────────────────────
    const updateSystemConfig = async (config: SystemConfig) => {
        const { error } = await supabase.from('system_config').upsert({ id: 1, ...config });
        if (error) { showToast('Erro ao salvar configurações.', 'error'); return; }
        setSystemConfig(config);
        showToast('Configurações salvas com sucesso.');
    };

    // ─── Contacts ─────────────────────────────────────────────────────────────
    const addContact = async (contact: Omit<Contact, 'id'>) => {
        const { data, error } = await supabase.from('contacts').insert(contact).select().single();
        if (error || !data) { showToast('Erro ao criar contato.', 'error'); return; }
        setContacts(p => [...p, data]);
        showToast('Contato criado com sucesso.');
    };
    const updateContact = async (updated: Contact) => {
        const { error } = await supabase.from('contacts').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar contato.', 'error'); return; }
        setContacts(p => p.map(c => c.id === updated.id ? updated : c));
        showToast('Contato atualizado.');
    };
    const deleteContact = async (id: string) => {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir contato.', 'error'); return; }
        setContacts(p => p.filter(c => c.id !== id));
        showToast('Contato excluído.');
    };

    // ─── Products ─────────────────────────────────────────────────────────────
    const addProduct = async (product: Omit<Product, 'id'>) => {
        const { data, error } = await supabase.from('products').insert(product).select().single();
        if (error || !data) { showToast('Erro ao criar produto.', 'error'); return; }
        setProducts(p => [...p, data]);
        showToast('Produto criado com sucesso.');
    };
    const updateProduct = async (updated: Product) => {
        const { error } = await supabase.from('products').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar produto.', 'error'); return; }
        setProducts(p => p.map(prod => prod.id === updated.id ? updated : prod));
        showToast('Produto atualizado.');
    };
    const deleteProduct = async (id: string) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir produto.', 'error'); return; }
        setProducts(p => p.filter(prod => prod.id !== id));
        showToast('Produto excluído.');
    };

    // ─── Transactions ─────────────────────────────────────────────────────────
    const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
        const { data, error } = await supabase.from('transactions').insert(transaction).select().single();
        if (error || !data) { showToast('Erro ao criar transação.', 'error'); return; }
        setTransactions(p => [...p, data]);
        showToast('Transação registrada.');
    };
    const updateTransaction = async (updated: Transaction) => {
        const { error } = await supabase.from('transactions').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar transação.', 'error'); return; }
        setTransactions(p => p.map(t => t.id === updated.id ? updated : t));
        showToast('Transação atualizada.');
    };
    const deleteTransaction = async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir transação.', 'error'); return; }
        setTransactions(p => p.filter(t => t.id !== id));
        showToast('Transação excluída.');
    };

    // ─── Deals ────────────────────────────────────────────────────────────────
    const addDeal = async (deal: Omit<Deal, 'id'>) => {
        const { data, error } = await supabase.from('deals').insert(deal).select().single();
        if (error || !data) { showToast('Erro ao criar oportunidade.', 'error'); return; }
        setDeals(p => [...p, data]);
        showToast('Oportunidade criada.');
    };
    const deleteDeal = async (id: string) => {
        const { error } = await supabase.from('deals').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir oportunidade.', 'error'); return; }
        setDeals(p => p.filter(d => d.id !== id));
        showToast('Oportunidade excluída.');
    };
    const updateDeal = async (updated: Deal) => {
        const oldDeal = deals.find(d => d.id === updated.id);
        const { error } = await supabase.from('deals').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar oportunidade.', 'error'); return; }

        setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));

        // Automação: deal ganho → cria transação de receita + projeto
        if (oldDeal?.status !== DealStatus.WON && updated.status === DealStatus.WON) {
            await addTransaction({
                date: new Date().toISOString(),
                description: `Venda: ${updated.title}`,
                amount: updated.value,
                type: TransactionType.REVENUE,
                dealId: updated.id,
                contactId: updated.contactId,
            });

            const existingProject = projects.find(p => p.dealId === updated.id);
            if (!existingProject) {
                const product = products.find(p => p.id === updated.productId);
                const startDate = new Date();
                const endDate = updated.predictedBillingDate
                    ? new Date(updated.predictedBillingDate)
                    : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
                const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

                await createProjectWithStages(
                    { dealId: updated.id, clientId: updated.contactId, name: `Projeto: ${updated.title}`, status: ProjectStatus.NOT_STARTED },
                    { name: product?.name || 'Tarefa Principal', startDate: startDate.toISOString(), endDate: endDate.toISOString(), durationDays: duration }
                );
            }
            showToast(`Deal "${updated.title}" ganho! Receita e projeto criados automaticamente.`, 'success');
        } else {
            showToast('Oportunidade atualizada.');
        }
    };

    // ─── Partners ─────────────────────────────────────────────────────────────
    const addPartner = async (partner: Omit<Partner, 'id'>) => {
        const { data, error } = await supabase.from('partners').insert(partner).select().single();
        if (error || !data) { showToast('Erro ao criar sócio.', 'error'); return; }
        setPartners(p => [...p, data]);
        showToast('Sócio adicionado.');
    };
    const deletePartner = async (id: string) => {
        const { error } = await supabase.from('partners').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir sócio.', 'error'); return; }
        setPartners(p => p.filter(s => s.id !== id));
        showToast('Sócio removido.');
    };

    // ─── Proposals ────────────────────────────────────────────────────────────
    const addProposal = async (proposal: Omit<Proposal, 'id'>) => {
        const { data, error } = await supabase.from('proposals').insert(proposal).select().single();
        if (error || !data) { showToast('Erro ao criar proposta.', 'error'); return; }
        setProposals(p => [...p, data]);
        showToast('Proposta criada.');
    };
    const deleteProposal = async (id: string) => {
        const { error } = await supabase.from('proposals').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir proposta.', 'error'); return; }
        setProposals(p => p.filter(pr => pr.id !== id));
        showToast('Proposta excluída.');
    };
    const updateProposal = async (updated: Proposal) => {
        const oldProposal = proposals.find(p => p.id === updated.id);
        const { error } = await supabase.from('proposals').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar proposta.', 'error'); return; }

        setProposals(prev => prev.map(p => p.id === updated.id ? updated : p));

        // Automação: proposta aceita → cria projeto
        if (oldProposal?.status !== ProposalStatus.ACCEPTED && updated.status === ProposalStatus.ACCEPTED) {
            const client = contacts.find(c => c.id === updated.clientId);
            const today  = new Date();

            await createProjectWithStages(
                {
                    proposalId: updated.id,
                    clientId: updated.clientId,
                    name: `Projeto para ${client?.name || 'Cliente'} — Proposta #${updated.id.substring(0, 8)}`,
                    status: ProjectStatus.NOT_STARTED
                },
                updated.items.length > 0
                    ? {
                        name: 'Execução da Proposta',
                        startDate: today.toISOString(),
                        endDate: addDays(today.toISOString(), 7),
                        durationDays: 7
                    }
                    : undefined
            );
            showToast('Proposta aceita! Projeto criado automaticamente.', 'success');
        } else {
            showToast('Proposta atualizada.');
        }
    };

    // ─── Projects ─────────────────────────────────────────────────────────────
    const addProject = async (project: Omit<Project, 'id'>) => {
        const newProject = await createProjectWithStages(project);
        if (!newProject) { showToast('Erro ao criar projeto.', 'error'); return; }
        showToast('Projeto criado com sucesso.');
    };
    const updateProject = async (updated: Project) => {
        const { error } = await supabase.from('projects').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar projeto.', 'error'); return; }
        setProjects(p => p.map(proj => proj.id === updated.id ? updated : proj));
        showToast('Projeto atualizado.');
    };
    const deleteProject = async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir projeto.', 'error'); return; }
        setProjects(p => p.filter(proj => proj.id !== id));
        setProjectStages(p => p.filter(s => s.projectId !== id));
        setProjectTasks(p => p.filter(t => t.projectId !== id));
        setProjectProducts(p => p.filter(pp => pp.projectId !== id));
        showToast('Projeto excluído.');
    };

    // ─── Stages ───────────────────────────────────────────────────────────────
    const addStage = async (stage: Omit<ProjectStage, 'id'>) => {
        const { data, error } = await supabase.from('project_stages').insert(stage).select().single();
        if (error || !data) { showToast('Erro ao criar fase.', 'error'); return; }
        setProjectStages(p => [...p, data]);
        showToast('Fase criada.');
    };
    const updateStage = async (updated: ProjectStage) => {
        const { error } = await supabase.from('project_stages').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar fase.', 'error'); return; }
        setProjectStages(p => p.map(s => s.id === updated.id ? updated : s));
    };
    const deleteStage = async (id: string) => {
        const { error } = await supabase.from('project_stages').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir fase.', 'error'); return; }
        setProjectStages(p => p.filter(s => s.id !== id));
        showToast('Fase excluída.');
    };

    // ─── Tasks ────────────────────────────────────────────────────────────────
    const addTask = async (task: Omit<ProjectTask, 'id'>) => {
        let taskData = { ...task };
        if (taskData.predecessorTaskId) {
            const pred = projectTasks.find(t => t.id === taskData.predecessorTaskId);
            if (pred) {
                taskData.startDate = addDays(pred.endDate, 1);
                taskData.endDate   = addDays(taskData.startDate, taskData.durationDays - 1);
            }
        }
        const { data, error } = await supabase.from('project_tasks').insert(taskData).select().single();
        if (error || !data) { showToast('Erro ao criar tarefa.', 'error'); return; }
        setProjectTasks(p => [...p, data]);
        showToast('Tarefa criada.');
    };

    const updateTask = async (updated: ProjectTask) => {
        let taskToSave = { ...updated };

        // Respeita predecessor ao atualizar datas
        if (taskToSave.predecessorTaskId) {
            const pred = projectTasks.find(t => t.id === taskToSave.predecessorTaskId);
            if (pred) {
                const requiredStart = addDays(pred.endDate, 1);
                if (new Date(taskToSave.startDate).getTime() !== new Date(requiredStart).getTime()) {
                    taskToSave.startDate = requiredStart;
                    taskToSave.endDate   = addDays(requiredStart, taskToSave.durationDays - 1);
                }
            }
        }

        const { error } = await supabase.from('project_tasks').update(taskToSave).eq('id', taskToSave.id);
        if (error) { showToast('Erro ao atualizar tarefa.', 'error'); return; }

        // Recalcula estado local das tasks sucessoras (sem chamadas API adicionais)
        setProjectTasks(prev => computeTaskChain(prev, taskToSave));

        // Persiste mudanças de data nos sucessores no banco (em background, sem bloquear UI)
        const updated_chain = computeTaskChain(projectTasks, taskToSave);
        const successorsToSave = updated_chain.filter(
            t => t.id !== taskToSave.id && t.predecessorTaskId
        );
        for (const s of successorsToSave) {
            const original = projectTasks.find(t => t.id === s.id);
            if (original && (original.startDate !== s.startDate || original.endDate !== s.endDate)) {
                supabase.from('project_tasks').update(s).eq('id', s.id);
            }
        }

        showToast('Tarefa atualizada.');
    };

    const deleteTask = async (id: string) => {
        const { error } = await supabase.from('project_tasks').delete().eq('id', id);
        if (error) { showToast('Erro ao excluir tarefa.', 'error'); return; }
        setProjectTasks(p => p.filter(t => t.id !== id));
        showToast('Tarefa excluída.');
    };

    // ─── Project Products ─────────────────────────────────────────────────────
    const addProjectProduct = async (product: Omit<ProjectProduct, 'id'>) => {
        const { data, error } = await supabase.from('project_products').insert(product).select().single();
        if (error || !data) { showToast('Erro ao adicionar produto ao projeto.', 'error'); return; }
        setProjectProducts(p => [...p, data]);
        showToast('Produto adicionado ao projeto.');
    };
    const updateProjectProduct = async (updated: ProjectProduct) => {
        const { error } = await supabase.from('project_products').update(updated).eq('id', updated.id);
        if (error) { showToast('Erro ao atualizar produto do projeto.', 'error'); return; }
        setProjectProducts(p => p.map(pp => pp.id === updated.id ? updated : pp));
        showToast('Produto do projeto atualizado.');
    };
    const deleteProjectProduct = async (id: string) => {
        const { error } = await supabase.from('project_products').delete().eq('id', id);
        if (error) { showToast('Erro ao remover produto do projeto.', 'error'); return; }
        setProjectProducts(p => p.filter(pp => pp.id !== id));
        showToast('Produto removido do projeto.');
    };

    const value: AppContextType = {
        isLoading,
        systemConfig, updateSystemConfig,
        contacts, addContact, updateContact, deleteContact,
        products, addProduct, updateProduct, deleteProduct,
        deals, addDeal, updateDeal, deleteDeal,
        transactions, addTransaction, updateTransaction, deleteTransaction,
        partners, addPartner, deletePartner,
        proposals, addProposal, updateProposal, deleteProposal,
        projects, addProject, updateProject, deleteProject,
        projectStages, addStage, updateStage, deleteStage,
        projectTasks, addTask, updateTask, deleteTask,
        projectProducts, addProjectProduct, updateProjectProduct, deleteProjectProduct,
        salesStages, contactTypes, proposalStatuses
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext deve ser usado dentro de AppProvider');
    return context;
};
