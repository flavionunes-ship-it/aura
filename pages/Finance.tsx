
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Transaction, TransactionType, Partner, ContactType } from '../types';
import Modal from '../components/Modal';

// --- Sub-component: TransactionForm (Receitas, Despesas, Investimentos) ---
const TransactionForm: React.FC<{ transaction?: Transaction; onSave: (transaction: Omit<Transaction, 'id'> | Transaction) => void; onCancel: () => void; }> = ({ transaction, onSave, onCancel }) => {
    const { partners, contacts } = useAppContext();
    const [description, setDescription] = useState(transaction?.description || '');
    const [amount, setAmount] = useState(transaction?.amount || 0);
    const [date, setDate] = useState(transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>(transaction?.type === TransactionType.TRANSFER ? TransactionType.EXPENSE : (transaction?.type || TransactionType.EXPENSE));
    
    // Specific state for Investment type
    const [investmentPartnerId, setInvestmentPartnerId] = useState(transaction?.type === TransactionType.INVESTMENT ? transaction?.partnerId : '');

    // General state for Expense/Revenue linkage (Client, Supplier, Partner)
    // Format: "contact:ID" or "partner:ID"
    const [linkedEntity, setLinkedEntity] = useState<string>(() => {
        if (transaction?.type === TransactionType.INVESTMENT) return '';
        if (transaction?.partnerId) return `partner:${transaction.partnerId}`;
        if (transaction?.contactId) return `contact:${transaction.contactId}`;
        return '';
    });

    const clients = useMemo(() => contacts.filter(c => c.type === ContactType.CLIENT), [contacts]);
    const suppliers = useMemo(() => contacts.filter(c => c.type === ContactType.SUPPLIER), [contacts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload: any = { 
            id: transaction?.id, 
            description, 
            amount: Number(amount), 
            date: new Date(date).toISOString(), 
            type 
        };

        if (type === TransactionType.INVESTMENT) {
            payload.partnerId = investmentPartnerId;
            if(!investmentPartnerId) {
                alert("Por favor, selecione um sócio para o investimento.");
                return;
            }
            // Clear contactId just in case
            payload.contactId = null;
        } else if (type === TransactionType.EXPENSE || type === TransactionType.REVENUE) {
            // Parse linked entity
            if (linkedEntity) {
                const [entityType, entityId] = linkedEntity.split(':');
                if (entityType === 'partner') {
                    payload.partnerId = entityId;
                    payload.contactId = null;
                } else if (entityType === 'contact') {
                    payload.contactId = entityId;
                    payload.partnerId = null;
                }
            } else {
                payload.partnerId = null;
                payload.contactId = null;
            }
        }

        onSave(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="type" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tipo</label>
                <select id="type" value={type} onChange={e => setType(e.target.value as TransactionType)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    <option value={TransactionType.REVENUE}>Receita</option>
                    <option value={TransactionType.EXPENSE}>Despesa</option>
                    <option value={TransactionType.INVESTMENT}>Investimento (Aporte)</option>
                </select>
            </div>

            {/* Special Selection for Investments (Equity logic) */}
            {type === TransactionType.INVESTMENT && (
                 <div>
                    <label htmlFor="invPartner" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Sócio Responsável (Aporte)</label>
                    <select id="invPartner" value={investmentPartnerId} onChange={e => setInvestmentPartnerId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                        <option value="">Selecione um sócio</option>
                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            )}

            {/* Generic Selection for Revenue/Expense */}
            {(type === TransactionType.EXPENSE || type === TransactionType.REVENUE) && (
                <div>
                    <label htmlFor="linkedEntity" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Vinculado a (Opcional)</label>
                    <select 
                        id="linkedEntity" 
                        value={linkedEntity} 
                        onChange={e => setLinkedEntity(e.target.value)} 
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                    >
                        <option value="">Sem vínculo específico</option>
                        
                        {clients.length > 0 && (
                            <optgroup label="Clientes">
                                {clients.map(c => <option key={`client-${c.id}`} value={`contact:${c.id}`}>{c.name}</option>)}
                            </optgroup>
                        )}
                        
                        {suppliers.length > 0 && (
                            <optgroup label="Fornecedores">
                                {suppliers.map(s => <option key={`supplier-${s.id}`} value={`contact:${s.id}`}>{s.name}</option>)}
                            </optgroup>
                        )}

                        {partners.length > 0 && (
                            <optgroup label="Sócios">
                                {partners.map(p => <option key={`partner-${p.id}`} value={`partner:${p.id}`}>{p.name}</option>)}
                            </optgroup>
                        )}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Selecione quem recebeu ou pagou este valor.</p>
                </div>
            )}

            <div>
                <label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Descrição</label>
                <input type="text" id="description" value={description} onChange={e => setDescription(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div>
                <label htmlFor="amount" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Valor (R$)</label>
                <input type="number" id="amount" value={amount} onChange={e => setAmount(Number(e.target.value))} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div>
                <label htmlFor="date" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data</label>
                <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Salvar</button>
            </div>
        </form>
    );
};

// --- Sub-component: TransferForm (Transferência entre Sócios) ---
const TransferForm: React.FC<{ onSave: (transaction: Omit<Transaction, 'id'>) => void; onCancel: () => void; }> = ({ onSave, onCancel }) => {
    const { partners } = useAppContext();
    const [fromPartnerId, setFromPartnerId] = useState('');
    const [toPartnerId, setToPartnerId] = useState('');
    const [amount, setAmount] = useState(0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (fromPartnerId === toPartnerId) {
            alert("O sócio de origem e destino não podem ser o mesmo.");
            return;
        }
        
        const fromPartner = partners.find(p => p.id === fromPartnerId);
        const toPartner = partners.find(p => p.id === toPartnerId);

        onSave({
            date: new Date(date).toISOString(),
            description: `Transferência: ${fromPartner?.name} -> ${toPartner?.name}`,
            amount: Number(amount),
            type: TransactionType.TRANSFER,
            partnerId: fromPartnerId,
            targetPartnerId: toPartnerId
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fromPartner" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">De (Quem pagou)</label>
                    <select id="fromPartner" value={fromPartnerId} onChange={e => setFromPartnerId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                        <option value="">Selecione</option>
                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="toPartner" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Para (Quem recebeu)</label>
                    <select id="toPartner" value={toPartnerId} onChange={e => setToPartnerId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                        <option value="">Selecione</option>
                        {partners.filter(p => p.id !== fromPartnerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
             </div>

            <div>
                <label htmlFor="amount" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Valor Transferido (R$)</label>
                <input type="number" id="amount" value={amount} onChange={e => setAmount(Number(e.target.value))} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div>
                <label htmlFor="date" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data da Transferência</label>
                <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Registrar Transferência</button>
            </div>
        </form>
    );
};

interface InvestmentsTabProps {
    onEdit: (t: Transaction) => void;
}

const InvestmentsTab: React.FC<InvestmentsTabProps> = ({ onEdit }) => {
    const { partners, transactions, deleteTransaction, addTransaction } = useAppContext();
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const investmentsList = useMemo(() => {
        return transactions
            .filter(t => t.type === TransactionType.INVESTMENT || t.type === TransactionType.TRANSFER)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    const investmentData = useMemo(() => {
        // Only INVESTMENT type counts towards company capital
        const totalInvested = transactions
            .filter(t => t.type === TransactionType.INVESTMENT)
            .reduce((acc, t) => acc + t.amount, 0);
            
        const partnerCount = partners.length;
        const sharePerPartner = partnerCount > 0 ? totalInvested / partnerCount : 0;

        const partnerStats = partners.map(partner => {
            // Amount paid directly to company
            const directInvestment = transactions
                .filter(t => t.type === TransactionType.INVESTMENT && t.partnerId === partner.id)
                .reduce((acc, t) => acc + t.amount, 0);

            // Amount sent to other partners (credits)
            const transfersSent = transactions
                .filter(t => t.type === TransactionType.TRANSFER && t.partnerId === partner.id)
                .reduce((acc, t) => acc + t.amount, 0);
            
            // Amount received from other partners (debits - reduces their effective contribution credit)
            const transfersReceived = transactions
                .filter(t => t.type === TransactionType.TRANSFER && t.targetPartnerId === partner.id)
                .reduce((acc, t) => acc + t.amount, 0);

            // Effective "Paid" for balancing purposes = Direct + (Sent - Received)
            const paid = directInvestment + (transfersSent - transfersReceived);
            const balance = paid - sharePerPartner;
            
            return { ...partner, paid, balance, directInvestment };
        });

        // Settlement Calculation
        const settlements: { from: string; to: string; amount: number }[] = [];
        const debtors = partnerStats.filter(p => p.balance < -0.01).sort((a, b) => a.balance - b.balance); // Ascending (Most negative first)
        const creditors = partnerStats.filter(p => p.balance > 0.01).sort((a, b) => b.balance - a.balance); // Descending (Most positive first)

        let i = 0; // debtor index
        let j = 0; // creditor index

        // Deep copy to not mutate state directly in calculation
        const debtorsCopy = debtors.map(d => ({...d}));
        const creditorsCopy = creditors.map(c => ({...c}));

        while (i < debtorsCopy.length && j < creditorsCopy.length) {
            const debtor = debtorsCopy[i];
            const creditor = creditorsCopy[j];
            const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

            if (amount > 0) {
                settlements.push({
                    from: debtor.name,
                    to: creditor.name,
                    amount: amount
                });
            }

            debtor.balance += amount;
            creditor.balance -= amount;

            if (Math.abs(debtor.balance) < 0.01) i++;
            if (creditor.balance < 0.01) j++;
        }

        return { totalInvested, sharePerPartner, partnerStats, settlements };
    }, [partners, transactions]);

    const handleSaveTransfer = (t: Omit<Transaction, 'id'>) => {
        addTransaction(t);
        setIsTransferModalOpen(false);
    }

    const getPartnerName = (id?: string) => {
        return partners.find(p => p.id === id)?.name || 'Desconhecido';
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200">Investimento Total Acumulado</h4>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatCurrency(investmentData.totalInvested)}</div>
                </div>
                 <div className="p-4 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                    <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Cota Ideal por Sócio ({partners.length})</h4>
                    <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{formatCurrency(investmentData.sharePerPartner)}</div>
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2">
                 <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sócios & Balanço</h3>
                 <div className="flex space-x-2">
                    <button onClick={() => setIsTransferModalOpen(true)} className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-300">Registrar Transferência</button>
                 </div>
            </div>

            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Sócio</th>
                            <th scope="col" className="px-6 py-3">Aporte Direto</th>
                            <th scope="col" className="px-6 py-3">Saldo Ajustado (Pago)</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3">Balanço</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investmentData.partnerStats.map(p => (
                            <tr key={p.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{p.name}</th>
                                <td className="px-6 py-4">{formatCurrency(p.directInvestment)}</td>
                                <td className="px-6 py-4 font-semibold">{formatCurrency(p.paid)}</td>
                                <td className="px-6 py-4">
                                    {Math.abs(p.balance) < 0.01 ? (
                                        <span className="text-green-600 font-medium">Quitado</span>
                                    ) : p.balance > 0 ? (
                                        <span className="text-blue-600 font-medium">A Receber</span>
                                    ) : (
                                        <span className="text-red-600 font-medium">A Pagar</span>
                                    )}
                                </td>
                                <td className={`px-6 py-4 font-bold ${p.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {p.balance > 0 ? '+' : ''}{formatCurrency(p.balance)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {investmentData.settlements.length > 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Plano de Acerto de Contas</h3>
                    <ul className="space-y-2">
                        {investmentData.settlements.map((s, idx) => (
                            <li key={idx} className="flex items-center text-gray-800 dark:text-gray-200">
                                <svg className="w-4 h-4 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                                <span><strong>{s.from}</strong> deve transferir <strong>{formatCurrency(s.amount)}</strong> para <strong>{s.to}</strong>.</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-center text-green-800 dark:text-green-200">
                    <span className="font-semibold">Tudo certo!</span> Todos os investimentos estão equalizados entre os sócios.
                </div>
            )}

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8">Histórico de Aportes e Transferências</h3>
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Data</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Envolvidos</th>
                            <th scope="col" className="px-6 py-3">Valor</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {investmentsList.map(t => (
                            <tr key={t.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === TransactionType.TRANSFER ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'}`}>
                                        {t.type === TransactionType.TRANSFER ? 'Transferência' : 'Aporte'}
                                    </span>
                                </td>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {t.type === TransactionType.TRANSFER ? (
                                        <div className="flex items-center space-x-2">
                                            <span>{getPartnerName(t.partnerId)}</span>
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                            <span>{getPartnerName(t.targetPartnerId)}</span>
                                        </div>
                                    ) : (
                                        <span>{getPartnerName(t.partnerId)}</span>
                                    )}
                                </th>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(t.amount)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    {t.type !== TransactionType.TRANSFER && (
                                        <button onClick={() => onEdit(t)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Editar</button>
                                    )}
                                    <button onClick={() => deleteTransaction(t.id)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Deletar</button>
                                </td>
                            </tr>
                        ))}
                        {investmentsList.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum aporte ou transferência registrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {partners.length === 0 && (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg dark:bg-gray-800">
                    Cadastre os sócios na Administração para começar o controle de investimentos.
                </div>
            )}
            
            <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Registrar Transferência entre Sócios">
                <TransferForm onSave={handleSaveTransfer} onCancel={() => setIsTransferModalOpen(false)} />
            </Modal>
        </div>
    );
}

const FinancePage: React.FC = () => {
    const { transactions, partners, contacts, addTransaction, updateTransaction, deleteTransaction } = useAppContext();
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'INVESTMENT'>('GENERAL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

    const { revenues, expenses, netBalance } = useMemo(() => {
        // Updated: Revenues now include direct REVENUE transactions AND INVESTMENT transactions
        const revenues = transactions.filter(t => t.type === TransactionType.REVENUE || t.type === TransactionType.INVESTMENT);
        const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
        const totalRevenue = revenues.reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
        return { revenues, expenses, netBalance: totalRevenue - totalExpense };
    }, [transactions]);
    
    const displayedTransactions = useMemo(() => {
         if (activeTab === 'INVESTMENT') return [];
         // General Tab: Revenue and Expense
         return transactions
            .filter(t => t.type === TransactionType.REVENUE || t.type === TransactionType.EXPENSE)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, activeTab]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handleSave = (transactionData: Omit<Transaction, 'id'> | Transaction) => {
        if ('id' in transactionData && transactionData.id) {
            updateTransaction(transactionData as Transaction);
        } else {
            addTransaction(transactionData);
        }
        setIsModalOpen(false);
        setEditingTransaction(undefined);
    };

    const getLinkedName = (transaction: Transaction) => {
        if (transaction.partnerId) {
            return partners.find(p => p.id === transaction.partnerId)?.name;
        } else if (transaction.contactId) {
            return contacts.find(c => c.id === transaction.contactId)?.name;
        }
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financeiro</h1>
                <button onClick={() => { setEditingTransaction(undefined); setIsModalOpen(true); }} className="mt-4 md:mt-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Adicionar Transação</button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg"><h3 className="font-semibold text-green-800 dark:text-green-200">Receita Total: {formatCurrency(revenues.reduce((s, t) => s + t.amount, 0))}</h3></div>
                <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg"><h3 className="font-semibold text-red-800 dark:text-red-200">Despesas Totais: {formatCurrency(expenses.reduce((s, t) => s + t.amount, 0))}</h3></div>
                <div className={`p-4 rounded-lg ${netBalance >= 0 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-yellow-100 dark:bg-yellow-900'}`}><h3 className={`font-semibold ${netBalance >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-yellow-800 dark:text-yellow-200'}`}>Saldo Líquido: {formatCurrency(netBalance)}</h3></div>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700">
                <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500 dark:text-gray-400">
                    <li className="mr-2">
                        <button onClick={() => setActiveTab('GENERAL')} className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'GENERAL' ? 'text-primary-600 border-primary-600 dark:text-primary-500 dark:border-primary-500' : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'}`}>
                            Lançamentos (Extrato)
                        </button>
                    </li>
                    <li className="mr-2">
                        <button onClick={() => setActiveTab('INVESTMENT')} className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'INVESTMENT' ? 'text-primary-600 border-primary-600 dark:text-primary-500 dark:border-primary-500' : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'}`}>
                            Investimentos & Sócios
                        </button>
                    </li>
                </ul>
            </div>
            
            {activeTab === 'INVESTMENT' ? (
                <InvestmentsTab onEdit={(t) => { setEditingTransaction(t); setIsModalOpen(true); }} />
            ) : (
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Data</th>
                                <th scope="col" className="px-6 py-3">Tipo</th>
                                <th scope="col" className="px-6 py-3">Descrição</th>
                                <th scope="col" className="px-6 py-3">Vinculado a</th>
                                <th scope="col" className="px-6 py-3">Valor</th>
                                <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedTransactions.map(t => {
                                const linkedName = getLinkedName(t);
                                const isRevenue = t.type === TransactionType.REVENUE;
                                return (
                                    <tr key={t.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${isRevenue ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{t.description}</th>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {linkedName ? (
                                                <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300">{linkedName}</span>
                                            ) : '-'}
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {isRevenue ? '+' : '-'} {formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Editar</button>
                                            <button onClick={() => deleteTransaction(t.id)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Deletar</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayedTransactions.length === 0 && (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">Nenhuma transação encontrada.</div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTransaction ? 'Editar Transação' : 'Adicionar Nova Transação'}>
                <TransactionForm transaction={editingTransaction} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default FinancePage;
