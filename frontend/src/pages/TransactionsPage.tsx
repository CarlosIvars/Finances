import { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Search, Check, X, ChevronUp, ChevronDown, Filter, Calendar, Info, CreditCard } from 'lucide-react';
import { getCategories, updateTransaction } from '../services/api';
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
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [categories, setCategories] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [detailTransaction, setDetailTransaction] = useState<any | null>(null);

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

            return matchesSearch && matchesType && matchesCategory && matchesMonth;
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
    }, [transactions, searchTerm, filterType, filterCategory, filterMonth, sortField, sortOrder]);

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
                                const hasMetadata = t.metadata && Object.keys(t.metadata).length > 0;
                                
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
                                    <td className="px-6 py-4 font-medium text-muted-foreground whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="max-w-sm truncate text-foreground font-medium group-hover:text-primary transition-colors flex items-center gap-2">
                                                <span>{t.description}</span>
                                                {cardTag && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg bg-secondary text-muted-foreground border border-border/70" title={`Tarjeta: ${cardTag}`}>
                                                        <CreditCard size={12} />
                                                        {cardTag.includes('••') ? cardTag.substring(cardTag.indexOf('••')) : cardTag}
                                                    </span>
                                                )}
                                            </div>
                                            {t.metadata?.original_date && (
                                                <span className="text-[11px] text-muted-foreground mt-0.5">
                                                    Op: {t.metadata.original_date}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === t.id ? (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    className="appearance-none bg-background border border-border shadow-sm rounded-xl px-2.5 py-1 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    value={selectedCategory || ''}
                                                    onChange={(e) => setSelectedCategory(Number(e.target.value))}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {categories.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button onClick={() => handleCategoryChange(t.id)} className="text-emerald-500 hover:text-emerald-400 p-1">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => { setEditingId(null); setSelectedCategory(null); }} className="text-red-500 hover:text-red-400 p-1">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <CategoryBadge
                                                categoryName={t.category_name}
                                                parentCategoryName={t.parent_category_name}
                                                categoryColor={t.category_color}
                                                categoryIcon={t.category_icon}
                                                categoryId={t.category}
                                                categories={categories}
                                                onClick={(e) => { 
                                                    e.stopPropagation();
                                                    setEditingId(t.id); 
                                                    setSelectedCategory(t.category); 
                                                }}
                                            />
                                        )}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-semibold tabular-nums ${t.type === 'income' ? 'text-income' : 'text-foreground'}`}>
                                        {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)} €
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailTransaction(t);
                                            }}
                                            className={`p-1.5 rounded-xl transition-colors ${hasMetadata ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-secondary'}`}
                                            title="Ver detalles y metadatos de la notificación"
                                        >
                                            <Info size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                            })}
                            {filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <p className="text-muted-foreground">No se encontraron movimientos con estos filtros.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Transaction Detail Modal */}
            {detailTransaction && (
                <TransactionDetailModal
                    transaction={detailTransaction}
                    categories={categories}
                    onClose={() => setDetailTransaction(null)}
                    onUpdated={() => {
                        if (onTransactionUpdated) onTransactionUpdated();
                    }}
                />
            )}
        </div>
    );
}
