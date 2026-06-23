
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Contact, Product, Deal, Transaction, ContactType, DealStatus, TransactionType, Proposal, ProposalStatus, Project, ProjectStage, ProjectTask, ProjectStatus, ProjectProduct, Partner, SystemConfig } from '../types';
import { supabase } from '../services/supabase';
import { SALES_STAGES } from '../constants';

interface AppContextType {
    systemConfig: SystemConfig;
    updateSystemConfig: (config: SystemConfig) => void;
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
    
    // Lists Options
    salesStages: string[];
    contactTypes: string[];
    proposalStatuses: string[];

    isLoading: boolean;
    addContact: (contact: Omit<Contact, 'id'>) => void;
    updateContact: (contact: Contact) => void;
    deleteContact: (id: string) => void;
    addProduct: (product: Omit<Product, 'id'>) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (id: string) => void;
    addDeal: (deal: Omit<Deal, 'id'>) => void;
    updateDeal: (deal: Deal) => void;
    deleteDeal: (id: string) => void;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    updateTransaction: (transaction: Transaction) => void;
    deleteTransaction: (id: string) => void;
    addPartner: (partner: Omit<Partner, 'id'>) => void;
    deletePartner: (id: string) => void;
    addProposal: (proposal: Omit<Proposal, 'id'>) => void;
    updateProposal: (proposal: Proposal) => void;
    deleteProposal: (id: string) => void;
    addProject: (project: Omit<Project, 'id'>) => void;
    updateProject: (project: Project) => void;
    deleteProject: (id: string) => void;
    addStage: (stage: Omit<ProjectStage, 'id'>) => void;
    updateStage: (stage: ProjectStage) => void;
    deleteStage: (id: string) => void;
    addTask: (task: Omit<ProjectTask, 'id'>) => void;
    updateTask: (task: ProjectTask) => void;
    deleteTask: (id: string) => void;
    addProjectProduct: (product: Omit<ProjectProduct, 'id'>) => void;
    updateProjectProduct: (product: ProjectProduct) => void;
    deleteProjectProduct: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialSystemConfig: SystemConfig = {
    name: 'Nexus CRM',
    logo: null
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

    // --- Data Fetching ---
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

            if (results[0].data) setSystemConfig(results[0].data);
            if (results[1].data) setContacts(results[1].data);
            if (results[2].data) setProducts(results[2].data);
            if (results[3].data) setDeals(results[3].data);
            if (results[4].data) setTransactions(results[4].data);
            if (results[5].data) setPartners(results[5].data);
            if (results[6].data) setProposals(results[6].data);
            if (results[7].data) setProjects(results[7].data);
            if (results[8].data) setProjectStages(results[8].data);
            if (results[9].data) setProjectTasks(results[9].data);
            if (results[10].data) setProjectProducts(results[10].data);

        } catch (error) {
            console.error("Erro ao carregar dados do Supabase:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Dynamic Lists ---
    const salesStages = systemConfig.customLists?.dealStatuses || SALES_STAGES;
    const contactTypes = systemConfig.customLists?.contactTypes || [ContactType.CLIENT, ContactType.SUPPLIER];
    const proposalStatuses = systemConfig.customLists?.proposalStatuses || Object.values(ProposalStatus);


    // --- Helper for Date Manipulation ---
    const addDays = (dateString: string, days: number): string => {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString();
    };

    // --- Helper to recursively update dependent tasks ---
    const recalculateTaskChain = (
        allTasks: ProjectTask[],
        updatedTask: ProjectTask
    ): ProjectTask[] => {
        let updatedList = allTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        const successors = updatedList.filter(t => t.predecessorTaskId === updatedTask.id);

        successors.forEach(successor => {
            const newStartDate = addDays(updatedTask.endDate, 1);
            const newEndDate = addDays(newStartDate, successor.durationDays);

            if (newStartDate !== successor.startDate || newEndDate !== successor.endDate) {
                const newSuccessor = { ...successor, startDate: newStartDate, endDate: newEndDate };
                updatedList = recalculateTaskChain(updatedList, newSuccessor);
                // Important: Side effect to update Supabase for chained tasks
                updateTask(newSuccessor); 
            }
        });

        return updatedList;
    };
    
    // --- System Config ---
    const updateSystemConfig = async (config: SystemConfig) => {
        // Upsert based on a fixed ID or assume only one row
        const { error } = await supabase.from('system_config').upsert({ id: 1, ...config });
        if (!error) setSystemConfig(config);
    };

    // --- CRUD Functions ---
    // Note: We use optimistic updates or re-fetching. Here we push to state to keep UI responsive.

    const addContact = async (contact: Omit<Contact, 'id'>) => {
        const { data, error } = await supabase.from('contacts').insert(contact).select().single();
        if (data && !error) setContacts(p => [...p, data]);
    };
    const updateContact = async (updated: Contact) => {
        const { error } = await supabase.from('contacts').update(updated).eq('id', updated.id);
        if (!error) setContacts(p => p.map(c => (c.id === updated.id ? updated : c)));
    };
    const deleteContact = async (id: string) => {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (!error) setContacts(p => p.filter(c => c.id !== id));
    };

    const addProduct = async (product: Omit<Product, 'id'>) => {
        const { data, error } = await supabase.from('products').insert(product).select().single();
        if (data && !error) setProducts(p => [...p, data]);
    };
    const updateProduct = async (updated: Product) => {
        const { error } = await supabase.from('products').update(updated).eq('id', updated.id);
        if (!error) setProducts(p => p.map(prod => (prod.id === updated.id ? updated : prod)));
    };
    const deleteProduct = async (id: string) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) setProducts(p => p.filter(prod => prod.id !== id));
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
        const { data, error } = await supabase.from('transactions').insert(transaction).select().single();
        if (data && !error) setTransactions(p => [...p, data]);
    };
    const updateTransaction = async (updated: Transaction) => {
        const { error } = await supabase.from('transactions').update(updated).eq('id', updated.id);
        if (!error) setTransactions(p => p.map(t => (t.id === updated.id ? updated : t)));
    };
    const deleteTransaction = async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) setTransactions(p => p.filter(t => t.id !== id));
    };
    
    const addDeal = async (deal: Omit<Deal, 'id'>) => {
        const { data, error } = await supabase.from('deals').insert(deal).select().single();
        if (data && !error) setDeals(p => [...p, data]);
    };
    const deleteDeal = async (id: string) => {
        const { error } = await supabase.from('deals').delete().eq('id', id);
        if (!error) setDeals(p => p.filter(d => d.id !== id));
    };
    
    const updateDeal = async (updated: Deal) => {
        const oldDeal = deals.find(d => d.id === updated.id);
        const { error } = await supabase.from('deals').update(updated).eq('id', updated.id);
        
        if (!error) {
            setDeals(prev => prev.map(d => (d.id === updated.id ? updated : d)));

            if (oldDeal && oldDeal.status !== DealStatus.WON && updated.status === DealStatus.WON) {
                // Create transaction
                await addTransaction({
                    date: new Date().toISOString(),
                    description: `Venda: ${updated.title}`,
                    amount: updated.value,
                    type: TransactionType.REVENUE,
                    dealId: updated.id,
                });

                // Create project from deal
                const existingProject = projects.find(p => p.dealId === updated.id);
                if (!existingProject) {
                    const product = products.find(p => p.id === updated.productId);
                    
                    // 1. Create Project
                    const { data: newProject, error: projError } = await supabase.from('projects').insert({
                        dealId: updated.id,
                        clientId: updated.contactId,
                        name: `Projeto: ${updated.title}`,
                        status: ProjectStatus.NOT_STARTED,
                    }).select().single();

                    if (newProject && !projError) {
                        setProjects(prev => [...prev, newProject]);
                        
                        // 2. Create Stages
                        const newStages = [
                            { projectId: newProject.id, name: 'Iniciação do Projeto', order: 1 },
                            { projectId: newProject.id, name: 'Execução', order: 2 }, // Will update predecessor later or simpler logic
                            { projectId: newProject.id, name: 'Fechamento do Projeto', order: 3 },
                        ];
                        
                        // Insert sequentially to get IDs if needed, or simple batch
                        const { data: createdStages } = await supabase.from('project_stages').insert(newStages).select();
                        
                        if(createdStages) {
                            setProjectStages(prev => [...prev, ...createdStages]);
                            
                            // Link predecessors (simple assumption: index 1 needs 0, index 2 needs 1)
                            if (createdStages.length === 3) {
                                await updateStage({ ...createdStages[1], predecessorStageId: createdStages[0].id });
                                await updateStage({ ...createdStages[2], predecessorStageId: createdStages[1].id });
                            }

                            // 3. Create Default Task
                            const startDate = new Date();
                            const endDate = updated.predictedBillingDate ? new Date(updated.predictedBillingDate) : new Date(new Date().setDate(startDate.getDate() + 14));
                            const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

                            // Find Execution Stage
                            const execStage = createdStages.find(s => s.name === 'Execução');
                            
                            if(execStage) {
                                await addTask({
                                    projectId: newProject.id,
                                    stageId: execStage.id,
                                    name: product?.name || 'Tarefa Principal do Negócio',
                                    startDate: startDate.toISOString(),
                                    endDate: endDate.toISOString(),
                                    durationDays: duration,
                                    isCompleted: false,
                                });
                            }
                        }
                    }
                }
            }
        }
    };

    const addPartner = async (partner: Omit<Partner, 'id'>) => {
        const { data, error } = await supabase.from('partners').insert(partner).select().single();
        if (data && !error) setPartners(p => [...p, data]);
    };
    const deletePartner = async (id: string) => {
        const { error } = await supabase.from('partners').delete().eq('id', id);
        if (!error) setPartners(p => p.filter(s => s.id !== id));
    };

    const addProposal = async (proposal: Omit<Proposal, 'id'>) => {
        const { data, error } = await supabase.from('proposals').insert(proposal).select().single();
        if (data && !error) setProposals(p => [...p, data]);
    };
    const deleteProposal = async (id: string) => {
        const { error } = await supabase.from('proposals').delete().eq('id', id);
        if (!error) setProposals(p => p.filter(pr => pr.id !== id));
    };

    const addProject = async (project: Omit<Project, 'id'>) => {
        const { data: newProject, error } = await supabase.from('projects').insert(project).select().single();
        if (newProject && !error) {
            setProjects(p => [...p, newProject]);
            
            // Default stages
            const newStages = [
                { projectId: newProject.id, name: 'Iniciação do Projeto', order: 1 },
                { projectId: newProject.id, name: 'Execução', order: 2 },
                { projectId: newProject.id, name: 'Fechamento do Projeto', order: 3 },
            ];
             const { data: createdStages } = await supabase.from('project_stages').insert(newStages).select();
             if(createdStages) {
                 setProjectStages(prev => [...prev, ...createdStages]);
                 if (createdStages.length === 3) {
                     await updateStage({ ...createdStages[1], predecessorStageId: createdStages[0].id });
                     await updateStage({ ...createdStages[2], predecessorStageId: createdStages[1].id });
                 }
             }
        }
    };
    const updateProject = async (updated: Project) => {
        const { error } = await supabase.from('projects').update(updated).eq('id', updated.id);
        if (!error) setProjects(p => p.map(proj => (proj.id === updated.id ? updated : proj)));
    };
    const deleteProject = async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (!error) {
            setProjects(p => p.filter(proj => proj.id !== id));
            // Cascade delete handled by DB usually, but cleaning state here
            setProjectStages(p => p.filter(s => s.projectId !== id));
            setProjectTasks(p => p.filter(t => t.projectId !== id));
            setProjectProducts(p => p.filter(pp => pp.projectId !== id));
        }
    };

    const addStage = async (stage: Omit<ProjectStage, 'id'>) => {
        const { data, error } = await supabase.from('project_stages').insert(stage).select().single();
        if (data && !error) setProjectStages(p => [...p, data]);
    };
    
    // Updated Logic for Stages: Cascade shift
    const updateStage = async (updated: ProjectStage) => {
        const { error } = await supabase.from('project_stages').update(updated).eq('id', updated.id);
        
        if (!error) {
            setProjectStages(p => p.map(ph => (ph.id === updated.id ? updated : ph)));

            // If predecessor exists, calculate if tasks need to shift
            if (updated.predecessorStageId) {
                const predStageTasks = projectTasks.filter(t => t.stageId === updated.predecessorStageId);
                
                if (predStageTasks.length > 0) {
                    const predEndDate = predStageTasks.reduce((max, t) => {
                        return new Date(t.endDate) > new Date(max) ? t.endDate : max;
                    }, predStageTasks[0].endDate);
                    
                    const newStageStartDate = addDays(predEndDate, 1);
                    const currentStageTasks = projectTasks.filter(t => t.stageId === updated.id);
                    
                    if (currentStageTasks.length > 0) {
                        const currentMinDate = currentStageTasks.reduce((min, t) => {
                            return new Date(t.startDate) < new Date(min) ? t.startDate : min;
                        }, currentStageTasks[0].startDate);

                        const diffTime = new Date(newStageStartDate).getTime() - new Date(currentMinDate).getTime();
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays !== 0) {
                            // Shift all tasks in this stage
                            for (const task of currentStageTasks) {
                                const newStart = addDays(task.startDate, diffDays);
                                const newEnd = addDays(task.endDate, diffDays);
                                const updatedTask = { ...task, startDate: newStart, endDate: newEnd };
                                
                                await updateTask(updatedTask); // This will handle recursion via updateTask logic
                            }
                        }
                    }
                }
            }
        }
    };
    
    const deleteStage = async (id: string) => {
        const { error } = await supabase.from('project_stages').delete().eq('id', id);
        if (!error) setProjectStages(p => p.filter(ph => ph.id !== id));
    };

    const addTask = async (task: Omit<ProjectTask, 'id'>) => {
        let newTaskData = { ...task };
        
        if (newTaskData.predecessorTaskId) {
            const predTask = projectTasks.find(t => t.id === newTaskData.predecessorTaskId);
            if (predTask) {
                newTaskData.startDate = addDays(predTask.endDate, 1);
                newTaskData.endDate = addDays(newTaskData.startDate, newTaskData.durationDays);
            }
        }

        const { data, error } = await supabase.from('project_tasks').insert(newTaskData).select().single();
        if (data && !error) setProjectTasks(p => [...p, data]);
    };

    // Updated Logic for Tasks: Recalculate Chain
    const updateTask = async (updated: ProjectTask) => {
        let taskToProcess = { ...updated };
        
        if (taskToProcess.predecessorTaskId) {
            const predTask = projectTasks.find(t => t.id === taskToProcess.predecessorTaskId);
            if (predTask) {
                const requiredStart = addDays(predTask.endDate, 1);
                if (new Date(taskToProcess.startDate).getTime() !== new Date(requiredStart).getTime()) {
                    taskToProcess.startDate = requiredStart;
                    taskToProcess.endDate = addDays(requiredStart, taskToProcess.durationDays);
                }
            }
        }

        const { error } = await supabase.from('project_tasks').update(taskToProcess).eq('id', taskToProcess.id);
        
        if (!error) {
            setProjectTasks(prevTasks => recalculateTaskChain(prevTasks, taskToProcess));
        }
    };

    const deleteTask = async (id: string) => {
         const { error } = await supabase.from('project_tasks').delete().eq('id', id);
         if (!error) setProjectTasks(p => p.filter(t => t.id !== id));
    };
    
    const addProjectProduct = async (product: Omit<ProjectProduct, 'id'>) => {
        const { data, error } = await supabase.from('project_products').insert(product).select().single();
        if (data && !error) setProjectProducts(p => [...p, data]);
    };
    const updateProjectProduct = async (updated: ProjectProduct) => {
        const { error } = await supabase.from('project_products').update(updated).eq('id', updated.id);
        if (!error) setProjectProducts(p => p.map(pp => (pp.id === updated.id ? updated : pp)));
    };
    const deleteProjectProduct = async (id: string) => {
        const { error } = await supabase.from('project_products').delete().eq('id', id);
        if (!error) setProjectProducts(p => p.filter(pp => pp.id !== id));
    };

    // --- Main Business Logic ---
    const updateProposal = async (updated: Proposal) => {
        const oldProposal = proposals.find(p => p.id === updated.id);
        const { error } = await supabase.from('proposals').update(updated).eq('id', updated.id);

        if (!error) {
            setProposals(prev => prev.map(p => (p.id === updated.id ? updated : p)));

            if (oldProposal && oldProposal.status !== ProposalStatus.ACCEPTED && updated.status === ProposalStatus.ACCEPTED) {
                const client = contacts.find(c => c.id === updated.clientId);
                
                // Create Project
                const { data: newProject } = await supabase.from('projects').insert({
                    proposalId: updated.id,
                    clientId: updated.clientId,
                    name: `Projeto para ${client?.name || 'Cliente'} - Proposta #${updated.id.substring(0, 8)}`,
                    status: ProjectStatus.NOT_STARTED,
                }).select().single();

                if (newProject) {
                    setProjects(prev => [...prev, newProject]);

                     // Create Stages
                    const newStages = [
                        { projectId: newProject.id, name: 'Iniciação do Projeto', order: 1 },
                        { projectId: newProject.id, name: 'Execução', order: 2 },
                        { projectId: newProject.id, name: 'Fechamento do Projeto', order: 3 },
                    ];
                    
                    const { data: createdStages } = await supabase.from('project_stages').insert(newStages).select();
                    
                    if(createdStages) {
                        setProjectStages(prev => [...prev, ...createdStages]);
                        
                        // Link Stages
                        if (createdStages.length === 3) {
                            await updateStage({ ...createdStages[1], predecessorStageId: createdStages[0].id });
                            await updateStage({ ...createdStages[2], predecessorStageId: createdStages[1].id });
                        }

                        // Create Tasks
                        const execStage = createdStages.find(s => s.name === 'Execução');
                        if (execStage) {
                            for (let i = 0; i < updated.items.length; i++) {
                                const item = updated.items[i];
                                const product = products.find(p => p.id === item.productId);
                                const startDate = new Date();
                                const endDate = item.dueDate ? new Date(item.dueDate) : new Date(new Date().setDate(startDate.getDate() + 7));
                                const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

                                await addTask({
                                    projectId: newProject.id,
                                    stageId: execStage.id,
                                    name: product?.name || `Tarefa ${i + 1}`,
                                    startDate: startDate.toISOString(),
                                    endDate: endDate.toISOString(),
                                    durationDays: duration,
                                    isCompleted: false,
                                });
                            }
                        }
                    }
                }
            }
        }
    };

    const value = {
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
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
