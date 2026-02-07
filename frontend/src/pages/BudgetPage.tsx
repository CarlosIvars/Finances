import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Loader2, Sparkles, Save, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { getCategories, getBudgets, saveBudgets, getBudgetComparison, getBudgetAdvice } from '../services/api';
import type { Category, Budget, BudgetComparison } from '../services/api';

export function BudgetPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [budgets, setBudgets] = useState<{ [categoryId: number]: number }>({});
    const [comparison, setComparison] = useState<BudgetComparison[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gettingAdvice, setGettingAdvice] = useState(false);
    const [advice, setAdvice] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Generate months for picker (last 6 months + next 3 months)
    const availableMonths = useMemo(() => {
        const months = [];
        const now = new Date();
        for (let i = -3; i <= 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
                label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
            });
        }
        return months;
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catsData, budgetsData, compData] = await Promise.all([
                getCategories(),
                getBudgets(selectedMonth),
                getBudgetComparison(selectedMonth)
            ]);

            // Only expense categories
            const expenseCategories = catsData.filter((c: Category) => !c.is_income);
            setCategories(expenseCategories);

            // Map budgets to object
            const budgetMap: { [id: number]: number } = {};
            budgetsData.forEach((b: Budget) => {
                budgetMap[b.category] = parseFloat(b.amount);
            });
            setBudgets(budgetMap);

            setComparison(compData.comparison);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setLoading(false);
    };

    const handleBudgetChange = (categoryId: number, value: string) => {
        const amount = parseFloat(value) || 0;
        setBudgets(prev => ({ ...prev, [categoryId]: amount }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage('');
        try {
            const budgetsToSave = Object.entries(budgets)
                .filter(([_, amount]) => amount > 0)
                .map(([categoryId, amount]) => ({
                    category_id: parseInt(categoryId),
                    amount
                }));

            await saveBudgets(budgetsToSave, selectedMonth);
            setSaveMessage('✅ Presupuesto guardado correctamente');
            // Refresh comparison data
            const compData = await getBudgetComparison(selectedMonth);
            setComparison(compData.comparison);
        } catch (error) {
            setSaveMessage('❌ Error al guardar');
        }
        setSaving(false);
        setTimeout(() => setSaveMessage(''), 3000);
    };

    const handleGetAdvice = async () => {
        setGettingAdvice(true);
        setAdvice('');
        try {
            const adviceText = await getBudgetAdvice(selectedMonth);
            setAdvice(adviceText);
        } catch (error) {
            setAdvice('❌ Error al obtener consejos');
        }
        setGettingAdvice(false);
    };

    const getComparisonForCategory = (categoryId: number) => {
        return comparison.find(c => c.category_id === categoryId);
    };

    const formatMonth = (monthStr: string) => {
        const date = new Date(monthStr);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const totalBudgeted = Object.values(budgets).reduce((sum, val) => sum + val, 0);
    const totalSpent = comparison.reduce((sum, c) => sum + c.spent, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">💰 Presupuesto Mensual</h2>
                    <p className="text-slate-400">Define cuánto planeas gastar en cada categoría</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Month Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMonthPicker(!showMonthPicker)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white hover:bg-slate-700 transition-all"
                        >
                            <span className="capitalize">{formatMonth(selectedMonth)}</span>
                            <ChevronDown size={16} />
                        </button>

                        {showMonthPicker && (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                                {availableMonths.map(m => (
                                    <button
                                        key={m.value}
                                        onClick={() => {
                                            setSelectedMonth(m.value);
                                            setShowMonthPicker(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 hover:bg-slate-700 capitalize ${selectedMonth === m.value ? 'text-blue-400 bg-slate-700/50' : 'text-slate-300'
                                            }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                        Guardar
                    </button>
                </div>
            </div>

            {saveMessage && (
                <div className="text-center text-sm py-2 text-emerald-400">{saveMessage}</div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <div className="text-center py-4">
                        <p className="text-slate-400 text-sm mb-1">Presupuesto Total</p>
                        <p className="text-2xl font-bold text-white">{totalBudgeted.toFixed(2)} €</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center py-4">
                        <p className="text-slate-400 text-sm mb-1">Gastado</p>
                        <p className="text-2xl font-bold text-rose-400">{totalSpent.toFixed(2)} €</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center py-4">
                        <p className="text-slate-400 text-sm mb-1">Diferencia</p>
                        <p className={`text-2xl font-bold ${totalBudgeted - totalSpent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(totalBudgeted - totalSpent).toFixed(2)} €
                        </p>
                    </div>
                </Card>
            </div>

            {/* Budget Form */}
            <Card>
                <div className="p-2">
                    <h3 className="text-lg font-semibold text-white mb-4 px-2">Presupuesto por Categoría</h3>

                    <div className="space-y-2">
                        {categories.map(cat => {
                            const comp = getComparisonForCategory(cat.id);
                            const budget = budgets[cat.id] || 0;
                            const spent = comp?.spent || 0;
                            const isOver = budget > 0 && spent > budget;
                            const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

                            return (
                                <div
                                    key={cat.id}
                                    className={`p-4 rounded-xl border ${isOver ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Color indicator */}
                                        <div
                                            className="w-3 h-10 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: cat.color }}
                                        />

                                        {/* Category name */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">{cat.name}</p>
                                            {budget > 0 && (
                                                <div className="mt-1">
                                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Budget input */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={budget || ''}
                                                onChange={(e) => handleBudgetChange(cat.id, e.target.value)}
                                                placeholder="0"
                                                className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-slate-400">€</span>
                                        </div>

                                        {/* Spent */}
                                        <div className="w-28 text-right">
                                            <p className="text-sm text-slate-400">Gastado</p>
                                            <p className={`font-medium ${isOver ? 'text-rose-400' : 'text-slate-300'}`}>
                                                {spent.toFixed(2)} €
                                            </p>
                                        </div>

                                        {/* Status icon */}
                                        <div className="w-8">
                                            {budget > 0 && (
                                                isOver ? (
                                                    <AlertTriangle className="text-rose-400" size={20} />
                                                ) : (
                                                    <Check className="text-emerald-400" size={20} />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* AI Advice Section */}
            <Card>
                <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="text-purple-400" size={20} />
                            Consejos IA
                        </h3>
                        <button
                            onClick={handleGetAdvice}
                            disabled={gettingAdvice}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
                        >
                            {gettingAdvice ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles size={16} />
                            )}
                            {gettingAdvice ? 'Analizando...' : 'Obtener Consejos'}
                        </button>
                    </div>

                    {advice ? (
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{advice}</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">
                            Haz clic en "Obtener Consejos" para recibir recomendaciones personalizadas sobre cómo reducir tus gastos.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
