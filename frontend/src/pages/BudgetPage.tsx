import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Loader2, Sparkles, Save, ChevronDown, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { getCategories, getBudgets, saveBudgets, getBudgetComparison, getBudgetAdvice } from '../services/api';
import type { Category, Budget, BudgetComparison, BudgetComparisonResponse } from '../services/api';
import { CategoryBadge } from '../components/CategoryBadge';

export function BudgetPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [budgets, setBudgets] = useState<{ [categoryId: number]: number }>({});
    const [comparison, setComparison] = useState<BudgetComparison[]>([]);
    const [compResponse, setCompResponse] = useState<BudgetComparisonResponse | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<{ [id: number]: boolean }>({});
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

            setCompResponse(compData);
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

    const toggleExpand = (categoryId: number) => {
        setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
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
            setCompResponse(compData);
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

    // Separar categorías raíz y subcategorías
    const { rootCategories, subcategoriesByParent } = useMemo(() => {
        const roots: Category[] = [];
        const subMap: { [parentId: number]: Category[] } = {};

        categories.forEach(cat => {
            if (cat.parent) {
                if (!subMap[cat.parent]) subMap[cat.parent] = [];
                subMap[cat.parent].push(cat);
            } else {
                roots.push(cat);
            }
        });

        return { rootCategories: roots, subcategoriesByParent: subMap };
    }, [categories]);

    // Resumen Global: si compResponse está disponible se usan sus totales sin duplicidad
    const totalBudgeted = compResponse ? compResponse.total_budgeted : rootCategories.reduce((sum, root) => {
        const subs = subcategoriesByParent[root.id] || [];
        const rootBudget = budgets[root.id] || 0;
        const subsBudget = subs.reduce((s, sub) => s + (budgets[sub.id] || 0), 0);
        return sum + (rootBudget > 0 ? rootBudget : subsBudget);
    }, 0);

    const totalSpent = compResponse ? compResponse.total_spent : comparison.reduce((sum, c) => sum + c.spent, 0);

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
                    <p className="text-muted-foreground font-medium mt-1">Define cuánto planeas gastar en cada categoría con desglose en árbol</p>
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

            {/* Budget Form - Árbol de categorías */}
            <Card>
                <div className="p-2">
                    <h3 className="text-lg font-sans tracking-tight font-semibold text-foreground mb-4 px-2">Presupuesto por Categoría (Árbol y Rollup)</h3>

                    <div className="space-y-4">
                        {rootCategories.map(root => {
                            const subs = subcategoriesByParent[root.id] || [];
                            const hasSubs = subs.length > 0;
                            const isExpanded = !!expandedCategories[root.id];

                            const comp = getComparisonForCategory(root.id);
                            const directBudget = budgets[root.id] || 0;
                            const childrenBudgetSum = subs.reduce((sum, s) => sum + (budgets[s.id] || 0), 0);
                            const effectiveBudget = directBudget > 0 ? directBudget : childrenBudgetSum;

                            // Gasto consolidado que incluye subcategorías
                            const spent = comp?.spent || 0;
                            const isOver = effectiveBudget > 0 && spent > effectiveBudget;
                            const percentage = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0;

                            return (
                                <div
                                    key={root.id}
                                    className={`rounded-2xl border transition-all ${isOver ? 'border-red-500/30 bg-red-500/5' : 'border-border/80 bg-secondary/20'}`}
                                >
                                    {/* Fila Padre */}
                                    <div className="p-4 flex items-center gap-4">
                                        {/* Category Icon */}
                                        <CategoryBadge
                                            categoryName={root.name}
                                            categoryColor={root.color}
                                            categoryIcon={root.icon}
                                            variant="icon-only"
                                            size="md"
                                        />

                                        {/* Category info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-foreground truncate">{root.name}</p>
                                                {hasSubs && (
                                                    <button
                                                        onClick={() => toggleExpand(root.id)}
                                                        className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1 hover:bg-primary/20 transition-colors"
                                                    >
                                                        <span>{subs.length} subcategorías</span>
                                                        <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                    </button>
                                                )}
                                            </div>
                                            {effectiveBudget > 0 && (
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

                                        {/* Budget input (Padre) */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={directBudget || ''}
                                                onChange={(e) => handleBudgetChange(root.id, e.target.value)}
                                                placeholder={childrenBudgetSum > 0 ? `${childrenBudgetSum}` : '0'}
                                                className="w-24 px-3 py-2 bg-background border border-border rounded-xl text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm text-sm"
                                            />
                                            <span className="text-muted-foreground font-medium">€</span>
                                        </div>

                                        {/* Spent Total */}
                                        <div className="w-28 text-right">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                                {hasSubs ? 'Total Consolidado' : 'Gastado'}
                                            </p>
                                            <p className={`font-semibold tracking-tight ${isOver ? 'text-expense' : 'text-foreground'}`}>
                                                {spent.toFixed(2)} €
                                            </p>
                                        </div>

                                        {/* Status icon */}
                                        <div className="w-8">
                                            {effectiveBudget > 0 && (
                                                isOver ? (
                                                    <AlertTriangle className="text-red-500" size={20} />
                                                ) : (
                                                    <Check className="text-emerald-500" size={20} />
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Subcategorías Anidadas (Árbol) */}
                                    {hasSubs && isExpanded && (
                                        <div className="px-4 pb-4 pt-1 border-t border-border/40 bg-secondary/30 rounded-b-2xl space-y-2">
                                            <div className="pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Desglose de Subcategorías
                                            </div>

                                            {subs.map(sub => {
                                                const subComp = getComparisonForCategory(sub.id) ||
                                                    comp?.subcategories?.find(s => s.category_id === sub.id);
                                                const subBudget = budgets[sub.id] || 0;
                                                const subSpent = subComp?.spent || 0;
                                                const subPctOfParent = spent > 0 ? (subSpent / spent) * 100 : 0;
                                                const subIsOver = subBudget > 0 && subSpent > subBudget;

                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className="flex items-center gap-4 py-2 px-3 rounded-xl bg-background/80 border border-border/50 hover:bg-background transition-colors"
                                                    >
                                                        <span className="text-muted-foreground font-mono pl-2">└</span>

                                                        <CategoryBadge
                                                            categoryName={sub.name}
                                                            categoryColor={sub.color}
                                                            categoryIcon={sub.icon}
                                                            variant="icon-only"
                                                            size="sm"
                                                        />

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium text-foreground truncate">{sub.name}</p>
                                                                <span className="text-xs text-muted-foreground font-normal">
                                                                    ({subPctOfParent.toFixed(0)}% del total)
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Subcategory budget input */}
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={subBudget || ''}
                                                                onChange={(e) => handleBudgetChange(sub.id, e.target.value)}
                                                                placeholder="0"
                                                                className="w-20 px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm text-xs"
                                                            />
                                                            <span className="text-muted-foreground text-xs font-medium">€</span>
                                                        </div>

                                                        {/* Subcategory spent */}
                                                        <div className="w-28 text-right">
                                                            <p className={`text-sm font-medium tracking-tight ${subIsOver ? 'text-expense' : 'text-foreground'}`}>
                                                                {subSpent.toFixed(2)} €
                                                            </p>
                                                        </div>

                                                        <div className="w-8">
                                                            {subBudget > 0 && (
                                                                subIsOver ? (
                                                                    <AlertTriangle className="text-red-500" size={16} />
                                                                ) : (
                                                                    <Check className="text-emerald-500" size={16} />
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
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
