
export type Page = 'dashboard' | 'contacts' | 'sales' | 'products' | 'finance' | 'proposals' | 'projects' | 'profile' | 'admin';

export interface SystemConfig {
    name: string;
    logo: string | null; // Base64 string or URL
    cnpj?: string;
    address?: string;
    email?: string;
    phone?: string;
    geminiApiKey?: string;
    systemVersion?: string;
    systemVersionDate?: string;
    expenseAlertThreshold?: number; // Dias antes do vencimento para alertar
    customLists?: {
        contactTypes?: string[];
        dealStatuses?: string[];
        proposalStatuses?: string[];
    };
}

export enum ContactType {
    CLIENT = 'Cliente',
    SUPPLIER = 'Fornecedor'
}

export interface CommercialContact {
    name: string;
    email: string;
    mobile: string;
}

export interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    type: string; // Changed from Enum to string to support dynamic lists
    address?: string;
    cpfCnpj?: string;
    description?: string; // Novo campo
    service?: string; // Novo campo
    commercialContact?: CommercialContact;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
}

export enum DealStatus {
    LEAD = 'Lead',
    PROPOSAL = 'Proposta Enviada',
    NEGOTIATION = 'Negociação',
    WON = 'Ganha',
    LOST = 'Perdida'
}

export interface Deal {
    id: string;
    title: string;
    contactId: string;
    productId: string;
    value: number;
    status: string; // Changed from Enum to string
    predictedBillingDate?: string; // ISO string
}

export enum TransactionType {
    REVENUE = 'Receita',
    EXPENSE = 'Despesa',
    INVESTMENT = 'Investimento',
    TRANSFER = 'Transferência entre Sócios'
}

export interface Partner {
    id: string;
    name: string;
}

export interface Transaction {
    id: string;
    date: string; // ISO string
    description: string;
    amount: number;
    type: TransactionType;
    dealId?: string;
    contactId?: string; // ID de um contato (Cliente/Fornecedor)
    partnerId?: string; // ID do sócio (Origem na transferência ou vinculado a despesa)
    targetPartnerId?: string; // ID do sócio destino (apenas para transferências)
}

export enum ProposalStatus {
    DRAFT = 'Rascunho',
    SENT = 'Enviada',
    ACCEPTED = 'Aceita',
    REJECTED = 'Rejeitada'
}

export interface ProposalItem {
    productId: string;
    quantity: number;
    unitPrice: number;
    dueDate?: string; // ISO string
}

export interface Proposal {
    id: string;
    clientId: string;
    items: ProposalItem[];
    total: number;
    generatedText: string;
    status: string; // Changed from Enum to string
    date: string; // ISO string
}

// --- Tipos de Projeto ---
export enum ProjectStatus {
    NOT_STARTED = 'Não Iniciado',
    IN_PROGRESS = 'Em Andamento',
    COMPLETED = 'Concluído',
    ON_HOLD = 'Em Espera',
    CANCELED = 'Cancelado'
}

export interface QualityCriterion {
    id: string;
    text: string;
    isMet: boolean;
}

export interface ProjectProduct {
    id: string;
    projectId: string;
    name: string;
    description: string;
    qualityCriteria: QualityCriterion[];
}

export interface ProjectTask {
    id: string;
    stageId: string; // Renamed from phaseId
    projectId: string;
    name: string;
    startDate: string; // ISO string
    endDate: string; // ISO string
    durationDays: number;
    isCompleted: boolean;
    predecessorTaskId?: string; // ID da tarefa que deve terminar antes desta começar
}

export interface ProjectStage { // Renamed from ProjectPhase
    id: string;
    projectId: string;
    name: string;
    order: number;
    predecessorStageId?: string; // ID do estágio que deve terminar antes deste começar
}

export interface Project {
    id: string;
    proposalId?: string;
    dealId?: string;
    clientId: string;
    name: string;
    status: ProjectStatus;
    businessCase?: string;
    projectManager?: string;
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    lessonsLearned?: string;
}
