import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Loader2, Sparkles, Save, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { getCategories, getBudgets, saveBudgets, getBudgetComparison, getBudgetAdvice } from '../services/api';
import type { Category, Budget, BudgetComparison } from '../services/api';
import { CategoryBadge } from '../components/CategoryBadge';

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
                    <h2 className="text-3xl font-sans font-bold text-foreground mb-1 tracking-tight">💰 Presupuesto Mensual</h2>
                    <p className="text-muted-foreground font-medium mt-1">Define cuánto planeas gastar en cada categoría</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Month Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMonthPicker(!showMonthPicker)}
                            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl text-foreground hover:bg-secondary transition-all shadow-sm font-medium text-sm"
                        >
                            <span className="capitalize">{formatMonth(selectedMonth)}</span>
                            <ChevronDown size={16} />
                        </button>

                        {showMonthPicker && (
                            <div className="absolute right-0 mt-2 w-48 glass-card border border-border/80 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto overflow-hidden">
                                {availableMonths.map(m => (
                                    <button
                                        key={m.value}
                                        onClick={() => {
                                            setSelectedMonth(m.value);
                                            setShowMonthPicker(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-secondary capitalize text-sm transition-colors ${selectedMonth === m.value ? 'text-primary bg-primary/10 font-medium' : 'text-muted-foreground'
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
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium transition-all shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                        Guardar
                    </button>
                </div>
            </div>

            {saveMessage && (
                <div className="text-center text-sm py-2 font-medium text-income">{saveMessage}</div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <div className="text-center py-4">
                        <p className="text-muted-foreground font-semibold text-xs mb-1 uppercase tracking-wider">Presupuesto Total</p>
                        <p className="text-2xl font-sans font-bold text-foreground tracking-tight">{totalBudgeted.toFixed(2)} €</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center py-4">
                        <p className="text-muted-foreground font-semibold text-xs mb-1 uppercase tracking-wider">Gastado</p>
                        <p className="text-2xl font-sans font-bold text-expense tracking-tight">{totalSpent.toFixed(2)} €</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center py-4">
                        <p className="text-muted-foreground font-semibold text-xs mb-1 uppercase tracking-wider">Diferencia</p>
                        <p className={`text-2xl font-sans font-bold tracking-tight ${totalBudgeted - totalSpent >= 0 ? 'text-income' : 'text-expense'}`}>
                            {(totalBudgeted - totalSpent).toFixed(2)} €
                        </p>
                    </div>
                </Card>
            </div>

            {/* Budget Form */}
            <Card>
                <div className="p-2">
                    <h3 className="text-lg font-sans tracking-tight font-semibold text-foreground mb-4 px-2">Presupuesto por Categoría</h3>

                    <div className="space-y-3">
                        {categories.map(cat => {
                            const comp = getComparisonForCategory(cat.id);
                            const budget = budgets[cat.id] || 0;
                            const spent = comp?.spent || 0;
                            const isOver = budget > 0 && spent > budget;
                            const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

                            return (
                                <div
                                    key={cat.id}
                                    className={`p-4 rounded-2xl border transition-colors ${isOver ? 'border-red-500/30 bg-red-500/5' : 'border-border/80 bg-secondary/30 hover:bg-secondary/50'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Category Icon */}
                                        <CategoryBadge
                                            categoryName={cat.name}
                                            categoryColor={cat.color}
                                            categoryIcon={cat.icon}
                                            variant="icon-only"
                                            size="md"
                                        />

                                        {/* Category name */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground truncate">{cat.name}</p>
                                            {budget > 0 && (
                                                <div className="mt-2">
                                                    <div className="h-1.5 bg-border/80 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${isOver ? 'bg-expense' : 'bg-primary'}`}
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
                                                className="w-24 px-3 py-2 bg-background border border-border rounded-xl text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                            />
                                            <span className="text-muted-foreground font-medium">€</span>
                                        </div>

                                        {/* Spent */}
                                        <div className="w-28 text-right">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Gastado</p>
                                            <p className={`font-semibold tracking-tight ${isOver ? 'text-expense' : 'text-foreground'}`}>
                                                {spent.toFixed(2)} €
                                            </p>
                                        </div>

                                        {/* Status icon */}
                                        <div className="w-8">
                                            {budget > 0 && (
                                                isOver ? (
                                                    <AlertTriangle className="text-red-500" size={20} />
                                                ) : (
                                                    <Check className="text-emerald-500" size={20} />
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
                <div className="p-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-sans tracking-tight font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="text-primary" size={20} />
                            Consejos IA
                        </h3>
                        <button
                            onClick={handleGetAdvice}
                            disabled={gettingAdvice}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
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
                        <div className="p-4 bg-secondary/50 border border-border/80 rounded-2xl">
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{advice}</p>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8 font-medium">
                            Haz clic en "Obtener Consejos" para recibir recomendaciones personalizadas sobre cómo reducir tus gastos.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
