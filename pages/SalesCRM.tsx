
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Deal, DealStatus, ContactType } from '../types';
import Modal from '../components/Modal';
import { SALES_STAGES, STAGE_COLORS } from '../constants';

const DealForm: React.FC<{ deal?: Deal; onSave: (deal: Omit<Deal, 'id'> | Deal) => void; onCancel: () => void; }> = ({ deal, onSave, onCancel }) => {
    const { contacts, products } = useAppContext();
    const [title, setTitle] = useState(deal?.title || '');
    const [contactId, setContactId] = useState(deal?.contactId || '');
    const [productId, setProductId] = useState(deal?.productId || '');
    const [value, setValue] = useState(deal?.value || 0);
    const [status, setStatus] = useState<DealStatus>(deal?.status || DealStatus.LEAD);
    const [predictedBillingDate, setPredictedBillingDate] = useState(deal?.predictedBillingDate ? deal.predictedBillingDate.split('T')[0] : '');

    const clientContacts = contacts.filter(c => c.type === ContactType.CLIENT);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dealData: Deal = {
            id: deal?.id || '',
            title,
            contactId,
            productId,
            value: Number(value),
            status,
        };

        if (status === DealStatus.WON) {
            if (!predictedBillingDate) {
                alert('A data de previsão de faturamento é obrigatória para negócios ganhos.');
                return;
            }
            dealData.predictedBillingDate = new Date(predictedBillingDate).toISOString();
        } else {
            delete dealData.predictedBillingDate;
        }

        onSave(dealData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="title" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Título do Negócio</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
             <div>
                <label htmlFor="contact" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cliente</label>
                <select id="contact" value={contactId} onChange={e => setContactId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                    <option value="">Selecione um cliente</option>
                    {clientContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="product" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Produto/Serviço</label>
                <select id="product" value={productId} onChange={e => setProductId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                    <option value="">Selecione um produto/serviço</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="value" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Valor (R$)</label>
                <input type="number" id="value" value={value} onChange={e => setValue(Number(e.target.value))} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div>
                <label htmlFor="status" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Status</label>
                <select id="status" value={status} onChange={e => setStatus(e.target.value as DealStatus)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    {SALES_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
            </div>
            {status === DealStatus.WON && (
                <div>
                    <label htmlFor="predictedBillingDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data de Previsão de Faturamento</label>
                    <input type="date" id="predictedBillingDate" value={predictedBillingDate} onChange={e => setPredictedBillingDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
                </div>
            )}
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Salvar</button>
            </div>
        </form>
    );
};

const DealCard: React.FC<{deal: Deal; onEdit: (deal: Deal) => void}> = ({deal, onEdit}) => {
    const { contacts } = useAppContext();
    const contact = contacts.find(c => c.id === deal.contactId);
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('dealId', deal.id);
    };

    return (
        <div 
            draggable="true"
            onDragStart={handleDragStart}
            onClick={() => onEdit(deal)} 
            className="p-4 mb-4 bg-white rounded-lg shadow-sm cursor-pointer dark:bg-gray-800 hover:shadow-md transition-shadow"
        >
            <h4 className="font-bold text-gray-900 dark:text-white">{deal.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">{contact?.name || 'Cliente Desconhecido'}</p>
            <p className="mt-2 font-semibold text-primary-600 dark:text-primary-400">{deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
    );
}

const KanbanColumn: React.FC<{ 
    stage: DealStatus; 
    deals: Deal[]; 
    onEditDeal: (deal: Deal) => void;
    onDropDeal: (dealId: string, newStatus: DealStatus) => void;
}> = ({ stage, deals, onEditDeal, onDropDeal }) => {
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
        const dealId = e.dataTransfer.getData('dealId');
        if (dealId) {
            onDropDeal(dealId, stage);
        }
    };

    return (
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-shrink-0 w-72 rounded-lg p-3 transition-colors duration-200 ${isOver ? 'bg-primary-100 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-900'}`}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">{stage}</h3>
                 <span className={`px-2 py-1 text-xs font-medium rounded-full ${STAGE_COLORS[stage]}`}>{deals.length}</span>
            </div>
            <div className="h-full space-y-2">
                {deals.map(deal => (
                   <DealCard key={deal.id} deal={deal} onEdit={onEditDeal} />
                ))}
            </div>
        </div>
    );
};

const BillingDateModal: React.FC<{ deal: Deal; onConfirm: (dealWithDate: Deal) => void; onCancel: () => void; }> = ({ deal, onConfirm, onCancel }) => {
    const [date, setDate] = useState('');

    const handleSubmit = () => {
        if (date) {
            onConfirm({ ...deal, predictedBillingDate: new Date(date).toISOString() });
        } else {
            alert('Por favor, selecione uma data.');
        }
    };

    return (
        <Modal isOpen={true} onClose={onCancel} title="Definir Previsão de Faturamento">
            <div className="space-y-4">
                <p>O negócio "{deal.title}" foi ganho. Por favor, defina a data de previsão de faturamento.</p>
                <div>
                    <label htmlFor="billingDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data de Faturamento</label>
                    <input type="date" id="billingDate" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300">Confirmar</button>
                </div>
            </div>
        </Modal>
    );
};

const SalesCRMPage: React.FC = () => {
    const { deals, addDeal, updateDeal } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | undefined>(undefined);
    const [dealToSetDate, setDealToSetDate] = useState<Deal | null>(null);

    const handleSave = (dealData: Omit<Deal, 'id'> | Deal) => {
        if ('id' in dealData && dealData.id) {
            updateDeal(dealData as Deal);
        } else {
            addDeal(dealData);
        }
        setIsModalOpen(false);
        setEditingDeal(undefined);
    };

    const handleEditDeal = (deal: Deal) => {
        setEditingDeal(deal);
        setIsModalOpen(true);
    };

    const handleDropDeal = (dealId: string, newStatus: DealStatus) => {
        const dealToUpdate = deals.find(d => d.id === dealId);
        if (dealToUpdate && dealToUpdate.status !== newStatus) {
            if (newStatus === DealStatus.WON) {
                setDealToSetDate({ ...dealToUpdate, status: newStatus });
            } else {
                const updatedDeal = { ...dealToUpdate, status: newStatus };
                delete updatedDeal.predictedBillingDate; // Remove date if moved out of WON
                updateDeal(updatedDeal);
            }
        }
    };

    const handleConfirmBillingDate = (dealWithDate: Deal) => {
        updateDeal(dealWithDate);
        setDealToSetDate(null);
    };

    return (
         <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pipeline de Vendas</h1>
                <button onClick={() => { setEditingDeal(undefined); setIsModalOpen(true); }} className="mt-4 md:mt-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Adicionar Novo Negócio</button>
            </div>
            <div className="flex p-2 space-x-4 overflow-x-auto bg-gray-50 dark:bg-gray-900/50 rounded-lg min-h-[70vh]">
                {SALES_STAGES.map(stage => (
                    <KanbanColumn
                        key={stage}
                        stage={stage}
                        deals={deals.filter(d => d.status === stage)}
                        onEditDeal={handleEditDeal}
                        onDropDeal={handleDropDeal}
                    />
                ))}
            </div>
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDeal ? 'Editar Negócio' : 'Adicionar Novo Negócio'}>
                <DealForm deal={editingDeal} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>
            {dealToSetDate && (
                <BillingDateModal 
                    deal={dealToSetDate} 
                    onConfirm={handleConfirmBillingDate} 
                    onCancel={() => setDealToSetDate(null)} 
                />
            )}
        </div>
    );
};

export default SalesCRMPage;
