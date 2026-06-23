
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppContext } from '../context/AppContext';
import { DealStatus, TransactionType, ProposalStatus, ProjectStatus } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { DEAL_ICON, EXPENSE_ICON, REVENUE_ICON, PROPOSAL_ICON, FUTURE_REVENUE_ICON, PROJECT_ICON, PROFIT_LOSS_ICON } from '../constants';

const DashboardPage: React.FC = () => {
    const { contacts, deals, transactions, proposals, projects, systemConfig } = useAppContext();

    // --- Date Filter State ---
    const [filterType, setFilterType] = useState<'month' | 'year' | 'custom'>('year');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);

    // --- Report State ---
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [reportEndDate, setReportEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);

    // --- Calculate Filter Date Range ---
    const { startDate, endDate } = useMemo(() => {
        let start: Date;
        let end: Date;

        if (filterType === 'month') {
            start = new Date(selectedYear, selectedMonth, 1);
            end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
        } else if (filterType === 'year') {
            start = new Date(selectedYear, 0, 1);
            end = new Date(selectedYear, 11, 31, 23, 59, 59);
        } else {
            start = new Date(customStartDate);
            end = new Date(customEndDate);
            end.setHours(23, 59, 59);
        }
        return { startDate: start, endDate: end };
    }, [filterType, selectedMonth, selectedYear, customStartDate, customEndDate]);

    // --- Filtered Data ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        });
    }, [transactions, startDate, endDate]);

    const filteredDeals = useMemo(() => {
        return deals.filter(d => {
            if (!d.predictedBillingDate) return false;
            const bDate = new Date(d.predictedBillingDate);
            return bDate >= startDate && bDate <= endDate;
        });
    }, [deals, startDate, endDate]);


    // --- Statistics Calculations ---
    const stats = useMemo(() => {
        const openDeals = deals.filter(d => d.status !== DealStatus.WON && d.status !== DealStatus.LOST).length;
        const activeProposals = proposals.filter(p => p.status === ProposalStatus.DRAFT || p.status === ProposalStatus.SENT).length;
        const activeProjects = projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length;
        
        // Calculated based on filter (Including INVESTMENTS in Revenue)
        const revenue = filteredTransactions
            .filter(t => t.type === TransactionType.REVENUE || t.type === TransactionType.INVESTMENT)
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = filteredTransactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const netResult = revenue - expenses;

        const futureRevenue = filteredDeals
            .filter(d => d.status === DealStatus.WON)
            .reduce((sum, d) => sum + d.value, 0);

        // Future Expenses (All expenses with date > today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureExpenses = transactions
            .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date) > today)
            .reduce((sum, t) => sum + t.amount, 0);

        return { openDeals, revenue, expenses, netResult, activeProposals, futureRevenue, futureExpenses, activeProjects };
    }, [contacts, deals, proposals, projects, filteredTransactions, filteredDeals, transactions]);

    // --- Chart Data (Aggregated by Month within the selected range) ---
    const chartData = useMemo(() => {
        const groupedData: { [key: string]: { revenue: number, expense: number, dateObj: Date } } = {};
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        filteredTransactions.forEach(t => {
            const date = new Date(t.date);
            // Group by Month-Year
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            
            if (!groupedData[key]) {
                groupedData[key] = { revenue: 0, expense: 0, dateObj: date };
            }

            if (t.type === TransactionType.REVENUE || t.type === TransactionType.INVESTMENT) {
                groupedData[key].revenue += t.amount;
            } else if (t.type === TransactionType.EXPENSE) {
                groupedData[key].expense += t.amount;
            }
        });

        const data = Object.values(groupedData)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(item => ({
                name: `${monthNames[item.dateObj.getMonth()]} ${item.dateObj.getFullYear()}`,
                Receita: item.revenue,
                Despesas: item.expense,
            }));

        // If data is empty (no transactions in range), show empty placeholder or just empty array
        return data;

    }, [filteredTransactions]);

    // --- Helpers for UI ---
    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i); // 2 years back, 2 years forward
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // --- Report Generation Logic ---
    const generateFinancialReport = () => {
        const start = new Date(reportStartDate);
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59);

        // Filter data for report
        const reportData = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalRevenue = reportData
            .filter(t => t.type === TransactionType.REVENUE || t.type === TransactionType.INVESTMENT)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const totalExpense = reportData
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);

        const doc = new jsPDF();

        // 1. Header
        let yPos = 20;
        
        // Logo
        if (systemConfig.logo) {
            try {
                doc.addImage(systemConfig.logo, 'PNG', 15, 10, 25, 25); // Adjust aspect ratio/size as needed
            } catch (e) {
                console.warn("Could not add logo to PDF", e);
            }
        }

        // Company Name
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(systemConfig.name, 50, 20);

        // Report Title
        doc.setFontSize(16);
        doc.setTextColor(100, 100, 100);
        doc.text("Relatório Financeiro de Receitas e Despesas", 50, 28);

        // Period
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Período: ${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`, 15, 45);

        // 2. Table Data Preparation
        const tableBody = reportData.map(t => [
            new Date(t.date).toLocaleDateString('pt-BR'),
            t.type,
            t.description,
            formatCurrency(t.amount)
        ]);

        // 3. Generate Table
        autoTable(doc, {
            startY: 50,
            head: [['Data', 'Tipo', 'Descrição', 'Valor']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [63, 81, 181] }, // Blueish header
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 40, halign: 'right' },
            },
            didParseCell: function(data) {
                // Color code amount column based on type logic if needed, 
                // but jspdf-autotable handles basic text. 
                // Advanced: could make Expenses red.
            }
        });

        // 4. Summary/Footer
        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY + 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Resumo do Período:", 15, finalY);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(22, 163, 74); // Green
        doc.text(`Total Receitas: ${formatCurrency(totalRevenue)}`, 15, finalY + 7);
        
        doc.setTextColor(220, 38, 38); // Red
        doc.text(`Total Despesas: ${formatCurrency(totalExpense)}`, 15, finalY + 14);
        
        const balance = totalRevenue - totalExpense;
        doc.setTextColor(balance >= 0 ? 37 : 220, balance >= 0 ? 99 : 38, balance >= 0 ? 235 : 38); // Blue or Red
        doc.setFont('helvetica', 'bold');
        doc.text(`Saldo Líquido: ${formatCurrency(balance)}`, 15, finalY + 21);

        // Footer Metadata
        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${systemConfig.name}`, 15, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }

        doc.save(`relatorio_financeiro_${start.toISOString().split('T')[0]}.pdf`);
        setIsReportModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Painel</h1>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Relatórios
                    </button>

                    {/* Filter Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="month">Mensal</option>
                            <option value="year">Anual</option>
                            <option value="custom">Personalizado</option>
                        </select>

                        {filterType === 'month' && (
                            <>
                                <select 
                                    value={selectedMonth} 
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                                <select 
                                    value={selectedYear} 
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </>
                        )}

                        {filterType === 'year' && (
                             <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        )}

                        {filterType === 'custom' && (
                            <>
                                <input 
                                    type="date" 
                                    value={customStartDate} 
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="text-gray-500">-</span>
                                <input 
                                    type="date" 
                                    value={customEndDate} 
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card title="Receita (Período)" value={formatCurrency(stats.revenue)} icon={REVENUE_ICON} />
                <Card title="Despesas (Período)" value={formatCurrency(stats.expenses)} icon={EXPENSE_ICON} />
                <div className={`p-6 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="text-sm font-medium text-gray-500 uppercase dark:text-gray-400">Lucro / Prejuízo</h5>
                            <span className={`text-2xl font-bold ${stats.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(stats.netResult)}
                            </span>
                        </div>
                        <div className={`p-3 rounded-full ${stats.netResult >= 0 ? 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300' : 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'}`}>
                            {PROFIT_LOSS_ICON}
                        </div>
                    </div>
                </div>
                <Card title="Receita Futura (Período)" value={formatCurrency(stats.futureRevenue)} icon={FUTURE_REVENUE_ICON} footer="Baseado na data prevista de faturamento dos negócios ganhos." />
                
                {/* Changed: Replaced Total Contacts with Future Expenses */}
                <Card title="Despesas Futuras" value={formatCurrency(stats.futureExpenses)} icon={
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                } footer="Total de despesas lançadas com data futura." />

                <Card title="Negócios em Aberto" value={stats.openDeals} icon={DEAL_ICON} />
                <Card title="Propostas Ativas" value={stats.activeProposals} icon={PROPOSAL_ICON} />
                <Card title="Projetos em Andamento" value={stats.activeProjects} icon={PROJECT_ICON} />
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700">
                 <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Fluxo Financeiro no Período</h2>
                 {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: 400 }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: 'rgba(31, 41, 55, 0.8)',
                                        borderColor: '#4b5563',
                                        color: '#ffffff',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="Receita" fill="#3b82f6" />
                                <Bar dataKey="Despesas" fill="#ef4444" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 ) : (
                     <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                         Nenhuma transação financeira registrada neste período.
                     </div>
                 )}
            </div>

            {/* Report Modal */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Gerar Relatório Financeiro">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Selecione o período para o relatório detalhado de receitas e despesas.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data Inicial</label>
                            <input 
                                type="date" 
                                value={reportStartDate} 
                                onChange={(e) => setReportStartDate(e.target.value)} 
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data Final</label>
                            <input 
                                type="date" 
                                value={reportEndDate} 
                                onChange={(e) => setReportEndDate(e.target.value)} 
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={generateFinancialReport}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Baixar PDF
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default DashboardPage;
