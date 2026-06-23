
import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageOrientation } from 'docx';
import saveAs from 'file-saver';
import { useAppContext } from '../context/AppContext';
import { Proposal, ProposalItem, ProposalStatus, ContactType, Product, Contact } from '../types';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const ProposalForm: React.FC<{ proposal?: Proposal; onSave: (proposal: Omit<Proposal, 'id'> | Proposal) => void; onCancel: () => void; }> = ({ proposal, onSave, onCancel }) => {
    const { contacts, products, systemConfig, proposalStatuses } = useAppContext();
    const { showToast } = useToast();
    const [clientId, setClientId] = useState(proposal?.clientId || '');
    const [items, setItems] = useState<ProposalItem[]>(proposal?.items || []);
    const [generatedText, setGeneratedText] = useState(proposal?.generatedText || '');
    const [status, setStatus] = useState<string>(proposal?.status || ProposalStatus.DRAFT);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState('');

    const clientContacts = useMemo(() => contacts.filter(c => c.type === ContactType.CLIENT), [contacts]);
    
    const total = useMemo(() => {
        return items.reduce((acc, item) => {
            return acc + (item.unitPrice * item.quantity);
        }, 0);
    }, [items]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    
    const handleAddItem = () => {
        const firstProduct = products[0];
        if (firstProduct) {
             setItems([...items, { productId: '', quantity: 1, unitPrice: 0, dueDate: undefined }]);
        } else {
            showToast('Cadastre um produto antes de adicionar itens à proposta.', 'info');
        }
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: 'productId' | 'quantity' | 'unitPrice' | 'dueDate', value: string | number) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };
        
        if (field === 'productId') {
            currentItem.productId = value as string;
            const product = products.find(p => p.id === value);
            currentItem.unitPrice = product ? product.price : 0;
        } else if (field === 'quantity') {
            currentItem.quantity = Number(value) > 0 ? Number(value) : 1;
        } else if (field === 'unitPrice') {
            currentItem.unitPrice = Number(value) >= 0 ? Number(value) : 0;
        } else if (field === 'dueDate') {
            currentItem.dueDate = value ? new Date(value as string).toISOString() : undefined;
        }
        
        newItems[index] = currentItem;
        setItems(newItems);
    };
    
    const handleGenerateAI = async () => {
        const client = contacts.find(c => c.id === clientId);
        if (!client || items.length === 0 || items.some(i => !i.productId)) {
            setAiError("Por favor, selecione um cliente e adicione pelo menos um produto válido.");
            return;
        }

        if (!systemConfig.geminiApiKey) {
            setAiError("Chave de API do Gemini não configurada. Entre em contato com o administrador.");
            return;
        }

        setIsLoadingAI(true);
        setAiError('');
        setGeneratedText('');
        
        const itemsDetails = items.map(item => {
            const product = products.find(p => p.id === item.productId);
            const dueDateText = item.dueDate ? `\n- Vencimento: ${new Date(item.dueDate).toLocaleDateString('pt-BR')}` : '';
            return `- Produto/Serviço: ${product?.name}\n- Descrição: ${product?.description}\n- Quantidade: ${item.quantity}\n- Preço Unitário: ${formatCurrency(item.unitPrice)}${dueDateText}`;
        }).join('\n\n');

        const prompt = `
            Você é um especialista em vendas e redação de propostas comerciais. Sua tarefa é criar uma proposta comercial formal, profissional e persuasiva.

            **Informações do Cliente:**
            - Nome: ${client.name}

            **Nossa Empresa:**
            - Nome: ${systemConfig.name}

            **Itens da Proposta:**
            ${itemsDetails}

            **Valor Total da Proposta:** ${formatCurrency(total)}

            **Instruções:**
            1. Crie um título claro e atraente para a proposta.
            2. Escreva uma breve introdução personalizada para o cliente ${client.name}, agradecendo a oportunidade.
            3. Detalhe o escopo dos produtos/serviços oferecidos de forma clara e profissional. Destaque os benefícios e o valor que eles trarão para o cliente. Se houver datas de vencimento, mencione-as.
            4. Apresente a seção de investimento (preços) de forma transparente.
            5. Inclua uma seção sobre os próximos passos e um call-to-action claro (ex: "Para aprovar esta proposta...").
            6. Termine com uma conclusão profissional, colocando-se à disposição para esclarecimentos.
            7. ESTRUTURE A RESPOSTA USANDO AS SEGUINTES TAGS DE SEÇÃO. CADA TAG DEVE ESTAR EM SUA PRÓPRIA LINHA:
            [TÍTULO]
            [INTRODUÇÃO]
            [ESCOPO DOS SERVIÇOS]
            [INVESTIMENTO]
            [PRÓXIMOS PASSOS]
            [CONCLUSÃO]

            Para listas dentro de uma seção (como em [ESCOPO DOS SERVIÇOS]), inicie cada linha da lista com um hífen (-).
            NÃO use formatação markdown como '##' ou '**'. Apenas use texto simples e as tags fornecidas.
        `;

        try {
            const ai = new GoogleGenAI({ apiKey: systemConfig.geminiApiKey });
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });
            setGeneratedText(response.text);
        } catch (error) {
            console.error("Error generating proposal:", error);
            setAiError("Ocorreu um erro ao gerar a proposta. Por favor, verifique a chave de API.");
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: proposal?.id, clientId, items, total, generatedText, status, date: proposal?.date || new Date().toISOString() } as Proposal);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="client" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cliente</label>
                <select id="client" value={clientId} onChange={e => setClientId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required>
                    <option value="">Selecione um cliente</option>
                    {clientContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            
            <div>
                 <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Itens da Proposta</h4>
                <div className="hidden md:grid grid-cols-12 gap-2 mb-1 px-1">
                    <label className="md:col-span-4 text-xs font-medium text-gray-500 dark:text-gray-400">Produto/Serviço</label>
                    <label className="md:col-span-1 text-xs font-medium text-gray-500 dark:text-gray-400">Qtd</label>
                    <label className="md:col-span-2 text-xs font-medium text-gray-500 dark:text-gray-400">Preço Unit.</label>
                    <label className="md:col-span-2 text-xs font-medium text-gray-500 dark:text-gray-400">Vencimento</label>
                    <label className="md:col-span-2 text-xs font-medium text-gray-500 dark:text-gray-400">Subtotal</label>
                </div>
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                            <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="md:col-span-4 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Selecione um produto</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="md:col-span-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" placeholder="Qtd" />
                            <div className="relative md:col-span-2">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    value={item.unitPrice} 
                                    onChange={e => handleItemChange(index, 'unitPrice', e.target.value)} 
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 pl-9 dark:bg-gray-700 dark:border-gray-600" 
                                    placeholder="Preço Unit." 
                                />
                            </div>
                            <input
                                type="date"
                                value={item.dueDate?.split('T')[0] || ''}
                                onChange={e => handleItemChange(index, 'dueDate', e.target.value)}
                                className="md:col-span-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <div className="relative md:col-span-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={formatCurrency(item.quantity * item.unitPrice)}
                                    className="bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 cursor-not-allowed text-right"
                                    aria-label="Subtotal do item"
                                />
                            </div>
                            <button type="button" onClick={() => handleRemoveItem(index)} className="md:col-span-1 p-2 text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400 flex justify-center items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddItem} className="mt-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-500">Adicionar Item</button>
            </div>

            <div className="p-2 text-right font-bold text-gray-800 dark:text-gray-200">Total: {formatCurrency(total)}</div>

            <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Texto da Proposta</label>
                <button type="button" onClick={handleGenerateAI} disabled={isLoadingAI || !clientId || items.length === 0} className="flex items-center justify-center w-full px-4 py-2 mb-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingAI ? <Spinner size="sm" /> : "Gerar Proposta com IA"}
                </button>
                {aiError && <p className="text-sm text-red-500">{aiError}</p>}
                <textarea value={generatedText} onChange={e => setGeneratedText(e.target.value)} rows={15} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" placeholder="Clique no botão acima para gerar uma proposta ou escreva a sua aqui..."></textarea>
            </div>
             <div>
                <label htmlFor="status" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Status</label>
                <select id="status" value={status} onChange={e => setStatus(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    {proposalStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300">Salvar Proposta</button>
            </div>
        </form>
    );
}

const ProposalViewer: React.FC<{ proposal: Proposal; contacts: Contact[]; products: Product[] }> = ({ proposal, contacts, products }) => {
    const { systemConfig } = useAppContext();
    const client = contacts.find(c => c.id === proposal.clientId);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const renderTextToHtml = (text: string) => {
        const elements: React.ReactNode[] = [];
        let currentListItems: React.ReactNode[] = [];

        const flushList = () => {
            if (currentListItems.length > 0) {
                elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-6 my-2 space-y-1">{currentListItems}</ul>);
                currentListItems = [];
            }
        };

        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach((line, index) => {
            if (line.startsWith('[TÍTULO]')) {
                flushList();
                elements.push(<h1 key={index} className="text-3xl font-bold mb-8 text-gray-800">{line.replace('[TÍTULO]', '').trim()}</h1>);
            } else if (line.match(/^\[(INTRODUÇÃO|ESCOPO DOS SERVIÇOS|INVESTIMENTO|PRÓXIMOS PASSOS|CONCLUSÃO)\]/)) {
                flushList();
                const title = line.replace(/\[|\]/g, '').trim();
                elements.push(<h2 key={index} className="text-xl font-semibold mt-6 mb-3 text-gray-700 border-b pb-2">{title}</h2>);
            } else if (line.trim().startsWith('- ')) {
                currentListItems.push(<li key={index} className="text-gray-600">{line.trim().substring(2)}</li>);
            } else {
                flushList();
                elements.push(<p key={index} className="text-gray-600 mb-4 leading-relaxed">{line.trim()}</p>);
            }
        });

        flushList();
        return elements;
    };

    return (
        <div className="bg-white shadow-lg p-12" id={`proposal-html-${proposal.id}`}>
            {/* Header */}
            <header className="flex justify-between items-start mb-12">
                <div>
                    <h2 className="text-2xl font-bold text-primary-700">{systemConfig.name}</h2>
                    <p className="text-gray-500">Sua solução em CRM</p>
                </div>
                <div className="text-right">
                    <h1 className="text-4xl font-light text-gray-700 uppercase">Proposta</h1>
                    <p className="text-gray-500 mt-2">Data: {new Date(proposal.date).toLocaleDateString('pt-BR')}</p>
                </div>
            </header>

            {/* Client Info */}
            <div className="mb-12">
                <h3 className="text-sm uppercase text-gray-500 font-semibold mb-2">Para:</h3>
                <p className="font-bold text-gray-800">{client?.name}</p>
                <p className="text-gray-600">{client?.email}</p>
            </div>
            
            {/* Body */}
            <div>{renderTextToHtml(proposal.generatedText)}</div>

            {/* Items Table */}
            <div className="mt-12">
                 <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-700 border-b pb-2">Detalhamento dos Itens</h2>
                <table className="w-full text-left mt-4">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 text-sm">
                            <th className="p-3 font-semibold">Produto/Serviço</th>
                            <th className="p-3 font-semibold text-center">Qtd.</th>
                            <th className="p-3 font-semibold text-right">Preço Unit.</th>
                            <th className="p-3 font-semibold text-center">Vencimento</th>
                            <th className="p-3 font-semibold text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proposal.items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <tr key={index} className="border-b">
                                    <td className="p-3">{product?.name || 'N/A'}</td>
                                    <td className="p-3 text-center">{item.quantity}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="p-3 text-center">{item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : 'N/A'}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-8">
                <div className="w-1/3">
                    <div className="flex justify-between p-3 bg-gray-100 rounded-lg">
                        <span className="font-semibold text-gray-700 text-lg">Total:</span>
                        <span className="font-bold text-primary-700 text-lg">{formatCurrency(proposal.total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ProposalsPage: React.FC = () => {
    const { proposals, contacts, products, addProposal, updateProposal, deleteProposal } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | undefined>(undefined);
    const [proposalToExport, setProposalToExport] = useState<Proposal | null>(null);
    const [proposalToView, setProposalToView] = useState<Proposal | null>(null);

    const handleSave = (proposalData: Omit<Proposal, 'id'> | Proposal) => {
        if ('id' in proposalData && proposalData.id) {
            updateProposal(proposalData as Proposal);
        } else {
            addProposal(proposalData);
        }
        setIsModalOpen(false);
        setEditingProposal(undefined);
    };
    
    const getStatusColor = (status: string) => {
        switch(status) {
            case ProposalStatus.DRAFT: return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            case ProposalStatus.SENT: return 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case ProposalStatus.ACCEPTED: return 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300';
            case ProposalStatus.REJECTED: return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-200 text-gray-800';
        }
    }

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getSoonestDueDate = (proposal: Proposal) => {
        const dueDates = proposal.items
            .map(item => item.dueDate ? new Date(item.dueDate).getTime() : Infinity)
            .filter(date => date !== Infinity);

        if (dueDates.length === 0) return null;
        
        const soonest = new Date(Math.min(...dueDates));
        return soonest.toLocaleDateString('pt-BR');
    };

    const generatePdf = (proposal: Proposal) => {
        const client = contacts.find(c => c.id === proposal.clientId);
        if (!client) return;

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        let y = margin;

        const checkAndAddPage = (spaceNeeded = 10) => {
            if (y + spaceNeeded > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        };

        const lines = proposal.generatedText.split('\n').filter(line => line.trim() !== '');

        lines.forEach(line => {
            checkAndAddPage();
            if (line.startsWith('[TÍTULO]')) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(22);
                doc.text(line.replace('[TÍTULO]', '').trim(), margin, y);
                y += 15;
            } else if (line.match(/^\[(INTRODUÇÃO|ESCOPO DOS SERVIÇOS|INVESTIMENTO|PRÓXIMOS PASSOS|CONCLUSÃO)\]/)) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                y += 10;
                doc.text(line.replace(/\[|\]/g, '').trim(), margin, y);
                y += 8;
                doc.setDrawColor(200);
                doc.line(margin, y - 2, doc.internal.pageSize.width - margin, y - 2);
            } else if (line.trim().startsWith('- ')) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                const text = `• ${line.trim().substring(2)}`;
                const splitText = doc.splitTextToSize(text, doc.internal.pageSize.width - margin * 2 - 5);
                doc.text(splitText, margin + 5, y);
                y += splitText.length * 5;
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                const splitText = doc.splitTextToSize(line.trim(), doc.internal.pageSize.width - margin * 2);
                doc.text(splitText, margin, y);
                y += splitText.length * 5;
            }
        });

        checkAndAddPage(proposal.items.length * 8 + 30);
        y += 10;
        
        const tableBody = proposal.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return [
                product?.name || 'N/A',
                item.quantity,
                formatCurrency(item.unitPrice),
                item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : 'N/A',
                formatCurrency(item.quantity * item.unitPrice)
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [['Produto/Serviço', 'Qtd.', 'Preço Unitário', 'Vencimento', 'Subtotal']],
            body: tableBody,
            foot: [['Total', '', '', '', formatCurrency(proposal.total)]],
            theme: 'striped',
            headStyles: { fillColor: [29, 78, 216] },
        });

        doc.save(`proposta_${client.name.replace(/\s/g, '_')}_${proposal.id}.pdf`);
        setProposalToExport(null);
    };
    
    const generateDocx = (proposal: Proposal) => {
        const client = contacts.find(c => c.id === proposal.clientId);
        if (!client) return;

        const parseTextForDocx = (text: string): Paragraph[] => {
            const elements: Paragraph[] = [];
            const lines = text.split('\n').filter(line => line.trim() !== '');

            lines.forEach(line => {
                 if (line.startsWith('[TÍTULO]')) {
                    elements.push(new Paragraph({ text: line.replace('[TÍTULO]', '').trim(), heading: HeadingLevel.TITLE, spacing: { after: 400 } }));
                } else if (line.match(/^\[(INTRODUÇÃO|ESCOPO DOS SERVIÇOS|INVESTIMENTO|PRÓXIMOS PASSOS|CONCLUSÃO)\]/)) {
                    elements.push(new Paragraph({ text: line.replace(/\[|\]/g, '').trim(), heading: HeadingLevel.HEADING_2, spacing: { after: 200, before: 300 } }));
                } else if (line.trim().startsWith('- ')) {
                    elements.push(new Paragraph({ text: line.trim().substring(2), bullet: { level: 0 } }));
                } else {
                    elements.push(new Paragraph({ text: line.trim(), spacing: { after: 150 } }));
                }
            });
            return elements;
        };

        const tableHeader = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Produto/Serviço", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qtd.", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Preço Unitário", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Vencimento", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Subtotal", bold: true })] })] }),
            ],
        });

        const tableBody = proposal.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(product?.name || 'N/A')] }),
                    new TableCell({ children: [new Paragraph(String(item.quantity))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.unitPrice))] }),
                    new TableCell({ children: [new Paragraph(item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : 'N/A')] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.quantity * item.unitPrice))] }),
                ],
            });
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: 11906,
                            height: 16838,
                            orientation: PageOrientation.PORTRAIT,
                        },
                    },
                },
                children: [
                    ...parseTextForDocx(proposal.generatedText),
                    new Table({ rows: [tableHeader, ...tableBody], width: { size: 100, type: WidthType.PERCENTAGE } }),
                    new Paragraph({
                        children: [new TextRun({ text: `Total: ${formatCurrency(proposal.total)}`, bold: true })],
                        alignment: AlignmentType.RIGHT,
                        spacing: { before: 200 }
                    }),
                ]
            }]
        });

        Packer.toBlob(doc).then(blob => {
            saveAs(blob, `proposta_${client.name.replace(/\s/g, '_')}_${proposal.id}.docx`);
        });
        setProposalToExport(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Propostas</h1>
                <button onClick={() => { setEditingProposal(undefined); setIsModalOpen(true); }} className="mt-4 md:mt-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300">Criar Nova Proposta</button>
            </div>

            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Cliente</th>
                            <th scope="col" className="px-6 py-3">Data</th>
                            <th scope="col" className="px-6 py-3">Vencimento</th>
                            <th scope="col" className="px-6 py-3">Valor Total</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {proposals.map(p => {
                            const client = contacts.find(c => c.id === p.clientId);
                            const soonestDueDate = getSoonestDueDate(p);
                            return (
                                <tr key={p.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{client?.name || 'Cliente não encontrado'}</th>
                                    <td className="px-6 py-4">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{soonestDueDate || 'N/A'}</td>
                                    <td className="px-6 py-4">{formatCurrency(p.total)}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(p.status)}`}>{p.status}</span></td>
                                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                        <button onClick={() => setProposalToView(p)} className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Visualizar</button>
                                        <button onClick={() => setProposalToExport(p)} className="font-medium text-gray-600 dark:text-gray-400 hover:underline">Exportar</button>
                                        <button onClick={() => { setEditingProposal(p); setIsModalOpen(true); }} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Editar</button>
                                        <button onClick={() => deleteProposal(p.id)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Deletar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {proposals.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">Nenhuma proposta encontrada.</div>
                )}
            </div>

            <Modal className="max-w-5xl" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProposal ? 'Editar Proposta' : 'Criar Nova Proposta'}>
                <ProposalForm proposal={editingProposal} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            {proposalToExport && (
                <Modal 
                    isOpen={!!proposalToExport} 
                    onClose={() => setProposalToExport(null)} 
                    title={`Exportar Proposta para ${contacts.find(c => c.id === proposalToExport.clientId)?.name || ''}`}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Selecione o formato para baixar a proposta.</p>
                        <div className="flex justify-center space-x-4">
                            <button 
                                onClick={() => generatePdf(proposalToExport)} 
                                className="flex-1 px-4 py-2 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300"
                            >
                                Gerar PDF
                            </button>
                            <button 
                                onClick={() => generateDocx(proposalToExport)} 
                                className="flex-1 px-4 py-2 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300"
                            >
                                Gerar DOCX
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {proposalToView && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={() => setProposalToView(null)}>
                    <div className="relative w-full max-w-5xl h-[90vh] bg-gray-200 dark:bg-gray-900 rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Visualizar Proposta</h3>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center w-8 h-8 ml-auto text-sm text-gray-400 bg-transparent rounded-lg hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
                                onClick={() => setProposalToView(null)}
                                aria-label="Close modal"
                            >
                                <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                                </svg>
                            </button>
                        </div>
                        <div className="p-2 md:p-6 overflow-y-auto flex-grow">
                            <ProposalViewer proposal={proposalToView} contacts={contacts} products={products} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProposalsPage;
