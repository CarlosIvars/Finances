import { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import {
    Search, Check, X, ChevronUp, ChevronDown, Filter, Calendar,
    FileText, Calculator, SlidersHorizontal, BookmarkPlus
} from 'lucide-react';
import { getCategories, updateTransaction, createTaxPreset } from '../services/api';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { CategoryBadge } from '../components/CategoryBadge';

interface TransactionsPageProps {
    transactions: any[];
    onTransactionUpdated?: () => void;
}

type SortField = 'date' | 'amount' | 'description' | 'category';
type SortOrder = 'asc' | 'desc';

export function TransactionsPage({ transactions, onTransactionUpdated }: TransactionsPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');

    // Filtros avanzados (Facturas e IRPF)
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterHasDocument, setFilterHasDocument] = useState('all'); // 'all' | 'with_doc' | 'without_doc'
    const [filterTaxDeductible, setFilterTaxDeductible] = useState('all'); // 'all' | 'deductible' | 'non_deductible'
    const [filterTaxYear, setFilterTaxYear] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');

    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [categories, setCategories] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [detailTransaction, setDetailTransaction] = useState<any | null>(null);

    // Modal guardar preset
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [presetAeatBox, setPresetAeatBox] = useState('');

    useEffect(() => {
        getCategories().then(setCategories).catch(console.error);
    }, []);

    // Get available months from transactions
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        transactions.forEach(t => {
            const d = new Date(t.date);
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        });
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // Available years
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        transactions.forEach(t => {
            const d = new Date(t.date);
            years.add(t.tax_year || d.getFullYear());
        });
        return Array.from(years).sort().reverse();
    }, [transactions]);

    const filteredAndSorted = useMemo(() => {
        let result = transactions.filter(t => {
            // Search filter
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.category_name && t.category_name.toLowerCase().includes(searchTerm.toLowerCase()));

            // Type filter
            const matchesType = filterType === 'all' || t.type === filterType;

            // Category filter
            const matchesCategory = filterCategory === 'all' ||
                (filterCategory === 'pending' && !t.category_name) ||
                t.category_name === filterCategory;

            // Month filter
            let matchesMonth = true;
            if (filterMonth !== 'all') {
                const d = new Date(t.date);
                const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                matchesMonth = txMonth === filterMonth;
            }

            // Factura adjunta filter
            let matchesDoc = true;
            const hasDoc = Boolean(t.has_document || (t.documents_count && t.documents_count > 0));
            if (filterHasDocument === 'with_doc') {
                matchesDoc = hasDoc;
            } else if (filterHasDocument === 'without_doc') {
                matchesDoc = !hasDoc;
            }

            // Deducible IRPF filter
            let matchesDeductible = true;
            if (filterTaxDeductible === 'deductible') {
                matchesDeductible = Boolean(t.is_tax_deductible);
            } else if (filterTaxDeductible === 'non_deductible') {
                matchesDeductible = !t.is_tax_deductible;
            }

            // Tax year filter
            let matchesTaxYear = true;
            if (filterTaxYear !== 'all') {
                const effectiveYear = t.tax_year || new Date(t.date).getFullYear();
                matchesTaxYear = String(effectiveYear) === filterTaxYear;
            }

            // Min & Max amount filter
            let matchesAmount = true;
            const absAmt = Math.abs(parseFloat(t.amount));
            if (minAmount && absAmt < parseFloat(minAmount)) matchesAmount = false;
            if (maxAmount && absAmt > parseFloat(maxAmount)) matchesAmount = false;

            return matchesSearch && matchesType && matchesCategory && matchesMonth &&
                matchesDoc && matchesDeductible && matchesTaxYear && matchesAmount;
        });

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'date':
                    comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                case 'amount':
                    comparison = Math.abs(a.amount) - Math.abs(b.amount);
                    break;
                case 'description':
                    comparison = a.description.localeCompare(b.description);
                    break;
                case 'category':
                    comparison = (a.category_name || 'zzz').localeCompare(b.category_name || 'zzz');
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [
        transactions, searchTerm, filterType, filterCategory, filterMonth,
        filterHasDocument, filterTaxDeductible, filterTaxYear, minAmount, maxAmount,
        sortField, sortOrder
    ]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    const handleCategoryChange = async (transactionId: number) => {
        if (selectedCategory === null) return;
        try {
            await updateTransaction(transactionId, { category: selectedCategory });
            setEditingId(null);
            setSelectedCategory(null);
            if (onTransactionUpdated) onTransactionUpdated();
        } catch (err) {
            console.error("Error updating category", err);
        }
    };

    const handleSaveAsTaxPreset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!presetName.trim()) return;

        try {
            await createTaxPreset({
                name: presetName,
                aeat_box: presetAeatBox,
                filters: {
                    category: filterCategory !== 'all' ? filterCategory : undefined,
                    type: filterType !== 'all' ? filterType : undefined,
                    has_document: filterHasDocument !== 'all' ? filterHasDocument === 'with_doc' : undefined,
                    is_tax_deductible: filterTaxDeductible !== 'all' ? filterTaxDeductible === 'deductible' : undefined,
                    min_amount: minAmount ? parseFloat(minAmount) : undefined,
                    max_amount: maxAmount ? parseFloat(maxAmount) : undefined,
                }
            });
            setShowSavePresetModal(false);
            setPresetName('');
            setPresetAeatBox('');
            alert('¡Filtro guardado exitosamente como preset fiscal!');
        } catch (err) {
            console.error('Error guardando preset:', err);
            alert('Error al guardar el preset');
        }
    };

    // Get unique categories for filter
    const uniqueCategories = useMemo(() => {
        const cats = new Set<string>();
        transactions.forEach(t => {
            if (t.category_name) cats.add(t.category_name);
        });
        return Array.from(cats).sort();
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-sans font-bold text-foreground tracking-tight">Movimientos</h2>
                    <p className="text-muted-foreground font-medium mt-1">{filteredAndSorted.length} de {transactions.length} transacciones</p>
                </div>
            </div>

            {/* Filters Row */}
            <Card>
                <div className="space-y-3.5">
                    <div className="flex flex-wrap gap-3.5 items-center">
                        <Filter size={18} className="text-muted-foreground" />

                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar concepto..."
                                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Month Filter */}
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-muted-foreground" />
                            <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="appearance-none bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-sm shadow-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="all">Todos los meses</option>
                                {availableMonths.map(m => {
                                    const [year, month] = m.split('-');
                                    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
                                    return <option key={m} value={m}>{label}</option>;
                                })}
                            </select>
                        </div>

                        {/* Type Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="appearance-none bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-sm shadow-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            <option value="all">Todos los tipos</option>
                            <option value="income">Ingresos</option>
                            <option value="expense">Gastos</option>
                        </select>

                        {/* Category Filter */}
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="appearance-none bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-sm shadow-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            <option value="all">Todas las categorías</option>
                            <option value="pending">⚠️ Sin categoría</option>
                            {uniqueCategories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {/* Toggle Advanced Filters */}
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
                                showAdvancedFilters
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <SlidersHorizontal size={15} />
                            <span>Filtros IRPF / Facturas</span>
                        </button>
                    </div>

                    {/* Collapsible Advanced Filters Bar */}
                    {showAdvancedFilters && (
                        <div className="pt-3 border-t border-border/60 flex flex-wrap gap-3 items-center justify-between animate-in fade-in duration-200">
                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Factura Filter */}
                                <div className="flex items-center gap-1.5">
                                    <FileText size={15} className="text-primary" />
                                    <select
                                        value={filterHasDocument}
                                        onChange={(e) => setFilterHasDocument(e.target.value)}
                                        className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none"
                                    >
                                        <option value="all">Todas (con/sin factura)</option>
                                        <option value="with_doc">📄 Solo con factura</option>
                                        <option value="without_doc">❌ Sin factura</option>
                                    </select>
                                </div>

                                {/* IRPF Deducible Filter */}
                                <div className="flex items-center gap-1.5">
                                    <Calculator size={15} className="text-emerald-500" />
                                    <select
                                        value={filterTaxDeductible}
                                        onChange={(e) => setFilterTaxDeductible(e.target.value)}
                                        className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none"
                                    >
                                        <option value="all">Todos (IRPF)</option>
                                        <option value="deductible">✅ Solo deducibles IRPF</option>
                                        <option value="non_deductible">No deducibles</option>
                                    </select>
                                </div>

                                {/* Tax Year Filter */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold">Año fiscal:</span>
                                    <select
                                        value={filterTaxYear}
                                        onChange={(e) => setFilterTaxYear(e.target.value)}
                                        className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none"
                                    >
                                        <option value="all">Cualquier año</option>
                                        {availableYears.map(y => (
                                            <option key={y} value={String(y)}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Importe Min - Max */}
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        placeholder="Mín €"
                                        value={minAmount}
                                        onChange={(e) => setMinAmount(e.target.value)}
                                        className="w-20 bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none"
                                    />
                                    <span className="text-xs text-muted-foreground">-</span>
                                    <input
                                        type="number"
                                        placeholder="Máx €"
                                        value={maxAmount}
                                        onChange={(e) => setMaxAmount(e.target.value)}
                                        className="w-20 bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => setShowSavePresetModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium rounded-xl border border-border transition-all"
                                title="Guardar esta combinación de filtros como preset fiscal"
                            >
                                <BookmarkPlus size={14} className="text-primary" />
                                <span>Guardar como Preset Fiscal</span>
                            </button>
                        </div>
                    )}
                </div>
            </Card>

            {/* Table */}
            <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/50 backdrop-blur-sm text-xs font-semibold tracking-wider text-muted-foreground border-b border-border/80">
                            <tr>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1">
                                        FECHA <SortIcon field="date" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort('description')}
                                >
                                    <div className="flex items-center gap-1">
                                        CONCEPTO <SortIcon field="description" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort('category')}
                                >
                                    <div className="flex items-center gap-1">
                                        CATEGORÍA <SortIcon field="category" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        IMPORTE <SortIcon field="amount" />
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-center w-12">
                                    <span className="sr-only">Detalles</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {filteredAndSorted.map((t) => {
                                const cardTag = t.metadata?.card || t.metadata?.card_masked || t.metadata?.card_last4;
                                const hasDoc = Boolean(t.has_document || (t.documents_count && t.documents_count > 0));

                                return (
                                <tr 
                                    key={t.id} 
                                    className="hover:bg-secondary/40 transition duration-150 group cursor-pointer"
                                    onClick={(e) => {
                                        // Don't trigger if clicked on select or button
                                        if ((e.target as HTMLElement).closest('select, button')) return;
                                        setDetailTransaction(t);
                                    }}
                                >
                                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">
                                        {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="font-medium text-foreground text-sm flex items-center gap-2">
                                                <span>{t.description}</span>
                                                {cardTag && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/40">
                                                        {cardTag}
                                                    </span>
                                                )}
                                                {hasDoc && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20" title="Factura adjunta">
                                                        <FileText size={11} /> Factura
                                                    </span>
                                                )}
                                                {t.is_tax_deductible && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Deducible IRPF">
                                                        <Calculator size={11} /> IRPF
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === t.id ? (
                                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={selectedCategory || ''}
                                                    onChange={(e) => setSelectedCategory(Number(e.target.value))}
                                                    className="bg-background border border-primary rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none shadow-sm"
                                                    autoFocus
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleCategoryChange(t.id)}
                                                    className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(null); setSelectedCategory(null); }}
                                                    className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingId(t.id);
                                                    setSelectedCategory(t.category);
                                                }}
                                                className="cursor-pointer inline-block"
                                                title="Haz clic para cambiar categoría"
                                            >
                                                <CategoryBadge
                                                    categoryName={t.category_name}
                                                    parentCategoryName={t.parent_category_name}
                                                    categoryColor={t.category_color}
                                                    categoryIcon={t.category_icon}
                                                    categoryId={t.category}
                                                    categories={categories}
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <span className={`font-sans font-bold tabular-nums text-sm ${
                                            t.type === 'income' 
                                                ? 'text-income' 
                                                : 'text-foreground'
                                        }`}>
                                            {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)} €
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailTransaction(t);
                                            }}
                                            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
                                            title="Ver detalles completos"
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredAndSorted.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <p className="text-sm">No se encontraron movimientos con los filtros seleccionados.</p>
                    </div>
                )}
            </Card>

            {/* Modal Detalle Transacción */}
            {detailTransaction && (
                <TransactionDetailModal
                    transaction={detailTransaction}
                    categories={categories}
                    onClose={() => setDetailTransaction(null)}
                    onUpdated={onTransactionUpdated}
                />
            )}

            {/* Modal Guardar Preset */}
            {showSavePresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card border border-border/80 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <h3 className="text-base font-bold text-foreground">Guardar Filtro como Preset Fiscal</h3>
                            <button onClick={() => setShowSavePresetModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAsTaxPreset} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre del Preset</label>
                                <input
                                    type="text"
                                    required
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="Ej. Cuotas sindicales y colegiales"
                                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">Casilla AEAT (opcional)</label>
                                <input
                                    type="text"
                                    value={presetAeatBox}
                                    onChange={(e) => setPresetAeatBox(e.target.value)}
                                    placeholder="Ej. Casilla 0014: Cuotas a sindicatos"
                                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSavePresetModal(false)}
                                    className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 shadow-sm"
                                >
                                    Guardar Preset
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
