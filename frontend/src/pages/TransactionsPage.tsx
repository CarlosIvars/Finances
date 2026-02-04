import { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Search, Check, X, ChevronUp, ChevronDown, Filter, Calendar } from 'lucide-react';
import { getCategories, updateTransaction } from '../services/api';

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
                    <h2 className="text-3xl font-bold text-white">Movimientos</h2>
                    <p className="text-slate-400">{filteredAndSorted.length} de {transactions.length} transacciones</p>
                </div>
            </div>

            {/* Filters Row */}
            <Card>
                <div className="flex flex-wrap gap-4 items-center">
                    <Filter size={18} className="text-slate-400" />

                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar concepto..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Month Filter */}
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
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
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="income">Ingresos</option>
                        <option value="expense">Gastos</option>
                    </select>

                    {/* Category Filter */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
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
                        <thead className="bg-slate-900/50 text-xs font-semibold tracking-wider text-slate-500 border-b border-white/5">
                            <tr>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1">
                                        FECHA <SortIcon field="date" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('description')}
                                >
                                    <div className="flex items-center gap-1">
                                        CONCEPTO <SortIcon field="description" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('category')}
                                >
                                    <div className="flex items-center gap-1">
                                        CATEGORÍA <SortIcon field="category" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        IMPORTE <SortIcon field="amount" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredAndSorted.map((t) => (
                                <tr key={t.id} className="hover:bg-white/5 transition duration-150 group">
                                    <td className="px-6 py-4 font-medium text-slate-300 whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-sm truncate text-white group-hover:text-blue-300 transition-colors">
                                            {t.description}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === t.id ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                                                    value={selectedCategory || ''}
                                                    onChange={(e) => setSelectedCategory(Number(e.target.value))}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {categories.map((c) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => handleCategoryChange(t.id)} className="text-emerald-400 hover:text-emerald-300">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => { setEditingId(null); setSelectedCategory(null); }} className="text-red-400 hover:text-red-300">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingId(t.id); setSelectedCategory(t.category); }}
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-blue-500/50 ${t.category_name
                                                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                                        : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                                    }`}
                                            >
                                                {t.category_name || 'Asignar'}
                                            </button>
                                        )}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-medium tabular-nums ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                            {filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <p className="text-slate-500">No se encontraron movimientos con estos filtros.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
