import { useState, useEffect } from 'react';
import { Plus, X, Save, Loader2, Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';
import { addPendingTransaction, getPendingTransactions } from '../services/offlineStore';
import { getOfflineCategories, syncPendingTransactions } from '../services/syncService';
import { useOnlineStatus, useSyncStatus } from '../hooks/useOnlineStatus';

interface Category {
    id: number;
    name: string;
    color: string;
    is_income: boolean;
}

interface QuickExpenseFormProps {
    onTransactionAdded?: () => void;
}

export function QuickExpenseForm({ onTransactionAdded }: QuickExpenseFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [saving, setSaving] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    const isOnline = useOnlineStatus();
    const syncStatus = useSyncStatus();

    useEffect(() => {
        loadCategories();
        loadPendingCount();
    }, []);

    const loadCategories = async () => {
        const cats = await getOfflineCategories();
        // Filter only expense categories
        setCategories(cats.filter(c => !c.is_income));
    };

    const loadPendingCount = async () => {
        const pending = await getPendingTransactions();
        setPendingCount(pending.filter(t => !t.synced).length);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) return;

        setSaving(true);
        try {
            const selectedCat = categories.find(c => c.id === categoryId);

            await addPendingTransaction({
                description: description || 'Gasto rápido',
                amount: -Math.abs(parseFloat(amount)),
                category_id: categoryId,
                category_name: selectedCat?.name,
                date: new Date().toISOString().split('T')[0],
                type: 'expense',
            });

            // Reset form
            setAmount('');
            setDescription('');
            setCategoryId(null);
            setIsOpen(false);

            // Update pending count
            await loadPendingCount();

            // If online, try to sync immediately
            if (isOnline) {
                await syncPendingTransactions();
                await loadPendingCount();
            }

            onTransactionAdded?.();
        } catch (error) {
            console.error('Error saving transaction:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        if (!isOnline) return;
        setSaving(true);
        await syncPendingTransactions();
        await loadPendingCount();
        setSaving(false);
        onTransactionAdded?.();
    };

    return (
        <>
            {/* Status Bar */}
            <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-auto z-40">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg ${isOnline
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                    {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                    <span>{isOnline ? 'Online' : 'Offline'}</span>

                    {pendingCount > 0 && (
                        <>
                            <span className="mx-1">•</span>
                            {syncStatus.isSyncing ? (
                                <span className="flex items-center gap-1">
                                    <Loader2 size={14} className="animate-spin" />
                                    Sincronizando...
                                </span>
                            ) : (
                                <button
                                    onClick={handleSync}
                                    disabled={!isOnline}
                                    className="flex items-center gap-1 hover:underline disabled:opacity-50"
                                >
                                    {isOnline ? <Cloud size={14} /> : <CloudOff size={14} />}
                                    {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105 z-50"
                aria-label="Añadir gasto"
            >
                <Plus size={28} />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 rounded-t-2xl md:rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">Añadir Gasto</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Amount Input */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Cantidad</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-2xl text-white text-center focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">€</span>
                                </div>
                            </div>

                            {/* Category Grid */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Categoría</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {categories.slice(0, 8).map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategoryId(cat.id)}
                                            className={`p-2 rounded-lg text-xs text-center transition-all ${categoryId === cat.id
                                                    ? 'ring-2 ring-blue-500 bg-slate-700'
                                                    : 'bg-slate-800 hover:bg-slate-700'
                                                }`}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full mx-auto mb-1"
                                                style={{ backgroundColor: cat.color }}
                                            />
                                            <span className="text-slate-300 truncate block">{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Descripción (opcional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ej: Café con amigos"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Offline indicator */}
                            {!isOnline && (
                                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-lg px-3 py-2">
                                    <WifiOff size={16} />
                                    <span>Se guardará localmente y sincronizará al conectar</span>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={saving || !amount || parseFloat(amount) <= 0}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <Save size={20} />
                                )}
                                {saving ? 'Guardando...' : 'Guardar Gasto'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
