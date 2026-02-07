import { useState, useMemo, useEffect } from 'react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Calendar, ChevronDown, Sparkles, Loader2, Wallet } from 'lucide-react';
import { generateInsights, getBudgetComparison } from '../services/api';
import type { BudgetComparison } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardProps {
    stats: { income: number; expense: number; balance: number };
    transactions: any[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function Dashboard({ transactions }: DashboardProps) {
    const [selectedPeriod, setSelectedPeriod] = useState('current'); // current, all, or specific month
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState('');
    const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
    const [loadingBudget, setLoadingBudget] = useState(true);

    // Fetch budget comparison data
    useEffect(() => {
        const fetchBudgetData = async () => {
            setLoadingBudget(true);
            try {
                const now = new Date();
                const month = selectedPeriod === 'current' || selectedPeriod === 'all'
                    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                    : `${selectedPeriod}-01`;
                const data = await getBudgetComparison(month);
                setBudgetComparison(data.comparison);
            } catch (error) {
                console.error('Error fetching budget data:', error);
                setBudgetComparison([]);
            }
            setLoadingBudget(false);
        };
        fetchBudgetData();
    }, [selectedPeriod]);

    const handleGenerateInsights = async () => {
        setIsGenerating(true);
        setAiMessage('');
        try {
            const result = await generateInsights();
            setAiMessage(`✅ ${result.alerts_created} insights generados. ¡Revisa la campana!`);
            // Trigger AlertBell to refresh
            window.dispatchEvent(new Event('alertsUpdated'));
        } catch (error) {
            setAiMessage('❌ Error al generar insights');
        }
        setIsGenerating(false);
        setTimeout(() => setAiMessage(''), 5000);
    };

    // Get available months from transactions
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        transactions.forEach(t => {
            const d = new Date(t.date);
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        });
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // Filter transactions by period
    const filteredTransactions = useMemo(() => {
        if (selectedPeriod === 'all') return transactions;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const targetMonth = selectedPeriod === 'current' ? currentMonth : selectedPeriod;

        return transactions.filter(t => {
            const d = new Date(t.date);
            const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return txMonth === targetMonth;
        });
    }, [transactions, selectedPeriod]);

    // Calculate stats from filtered transactions
    const stats = useMemo(() => {
        let income = 0, expense = 0;
        filteredTransactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (t.type === 'income') income += amt;
            else expense += Math.abs(amt);
        });
        return { income, expense, balance: income - expense };
    }, [filteredTransactions]);

    const monthlyData = processMonthlyData(transactions);
    const categoryData = processCategoryData(filteredTransactions);

    // Format budget data for chart
    const budgetChartData = budgetComparison.map(b => ({
        name: b.category_name.length > 12 ? b.category_name.substring(0, 12) + '...' : b.category_name,
        fullName: b.category_name,
        presupuesto: b.budgeted,
        gastado: b.spent,
        color: b.category_color,
        difference: b.difference,
        percentage: b.percentage
    }));

    const totalBudgeted = budgetComparison.reduce((sum, b) => sum + b.budgeted, 0);
    const totalSpent = budgetComparison.reduce((sum, b) => sum + b.spent, 0);

    const getPeriodLabel = () => {
        if (selectedPeriod === 'current') return 'Este mes';
        if (selectedPeriod === 'all') return 'Histórico completo';
        const [year, month] = selectedPeriod.split('-');
        return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-8">
            {/* Header with Month Selector and AI Button */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Resumen Financiero</h2>
                    <p className="text-slate-400 flex items-center gap-2">
                        <Calendar size={16} />
                        {getPeriodLabel()}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* AI Analysis Button */}
                    <button
                        onClick={handleGenerateInsights}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-medium transition-all shadow-lg hover:shadow-purple-500/25 disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Analizando...' : 'Análisis IA'}
                    </button>

                    {/* Period Selector */}
                    <div className="relative">
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-white cursor-pointer hover:border-slate-600 focus:outline-none focus:border-blue-500"
                        >
                            <option value="current">Este mes</option>
                            <option value="all">Histórico completo</option>
                            <optgroup label="Meses anteriores">
                                {availableMonths.map(m => {
                                    const [year, month] = m.split('-');
                                    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                    return <option key={m} value={m}>{label}</option>;
                                })}
                            </optgroup>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {/* AI Message Toast */}
            {aiMessage && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 animate-in slide-in-from-top-2 duration-200">
                    {aiMessage}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Balance" value={stats.balance} type="balance" />
                <StatCard title="Ingresos" value={stats.income} type="income" />
                <StatCard title="Gastos" value={stats.expense} type="expense" />
            </div>

            {/* Budget vs Spending Chart */}
            {budgetChartData.length > 0 && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                            <Wallet size={20} className="text-blue-400" />
                            Presupuesto vs Gasto Real
                        </h3>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                                <span className="text-slate-400">Presupuesto</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-rose-500" />
                                <span className="text-slate-400">Gastado</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary bar */}
                    <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm">Total del mes</span>
                            <span className={`font-semibold ${totalBudgeted - totalSpent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalBudgeted - totalSpent >= 0 ? '✅' : '⚠️'} {Math.abs(totalBudgeted - totalSpent).toFixed(0)}€ {totalBudgeted - totalSpent >= 0 ? 'bajo presupuesto' : 'excedido'}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${totalSpent > totalBudgeted ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>Gastado: {totalSpent.toFixed(0)}€</span>
                            <span>Presupuesto: {totalBudgeted.toFixed(0)}€</span>
                        </div>
                    </div>

                    <div className="h-72">
                        {loadingBudget ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={budgetChartData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                    <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickFormatter={(v) => `${v}€`} />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} width={80} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                        formatter={(value, name) => [`${Number(value).toFixed(2)} €`, name === 'presupuesto' ? 'Presupuesto' : 'Gastado']}
                                        labelFormatter={(label) => {
                                            const item = budgetChartData.find(d => d.name === label);
                                            return item?.fullName || label;
                                        }}
                                    />
                                    <Bar dataKey="presupuesto" name="Presupuesto" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                                    <Bar dataKey="gastado" name="Gastado" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card>
                    <h3 className="font-semibold text-lg text-white mb-4">Ingresos vs Gastos (Mensual)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickFormatter={(v) => `${v}€`} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                                <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Pie Chart */}
                <Card>
                    <h3 className="font-semibold text-lg text-white mb-4">Distribución de Gastos ({getPeriodLabel()})</h3>
                    <div className="h-72">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        innerRadius={40}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name"
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                        formatter={(value, name) => [`${Number(value).toFixed(2)} €`, name]}
                                    />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">
                                No hay datos para este período
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-white">Movimientos Recientes</h3>
                </div>
                <div className="divide-y divide-white/10">
                    {filteredTransactions.slice(0, 8).map((t, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <div>
                                    <p className="text-sm font-medium text-white truncate max-w-xs">{t.description}</p>
                                    <p className="text-xs text-slate-500">{t.date} • {t.category_name || 'Sin categoría'}</p>
                                </div>
                            </div>
                            <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)} €
                            </span>
                        </div>
                    ))}
                    {filteredTransactions.length === 0 && (
                        <p className="text-center py-8 text-slate-500">No hay movimientos en este período</p>
                    )}
                </div>
            </Card>
        </div>
    );
}

function processMonthlyData(transactions: any[]) {
    const grouped: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
        const date = new Date(t.date);
        const key = date.toLocaleDateString('es-ES', { month: 'short' });
        if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
        const amt = Math.abs(parseFloat(t.amount));
        if (t.type === 'income') grouped[key].income += amt;
        else grouped[key].expense += amt;
    });
    return Object.entries(grouped).map(([month, data]) => ({
        month, income: Math.round(data.income), expense: Math.round(data.expense),
    })).slice(-6);
}

function processCategoryData(transactions: any[]) {
    const grouped: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.category_name || 'Sin categorizar';
        grouped[cat] = (grouped[cat] || 0) + Math.abs(parseFloat(t.amount));
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
}

