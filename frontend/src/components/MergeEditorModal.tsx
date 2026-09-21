import React from 'react';
import { AlertTriangle, Check, ArrowRight, Laptop, Cloud, X } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';

export interface SyncConflictItem {
    id: string | number;
    local: {
        description: string;
        amount: number;
        date: string;
        category_id?: number | null;
        category_name?: string | null;
        type?: 'income' | 'expense';
    };
    server: {
        description: string;
        amount: number;
        date: string;
        category_id?: number | null;
        category_name?: string | null;
        type?: 'income' | 'expense';
    };
}

interface MergeEditorModalProps {
    conflict: SyncConflictItem;
    onResolve: (choice: 'local' | 'server') => void;
    onDismiss: () => void;
}

export const MergeEditorModal: React.FC<MergeEditorModalProps> = ({
    conflict,
    onResolve,
    onDismiss,
}) => {
    const { local, server } = conflict;

    const descDiff = local.description !== server.description;
    const amountDiff = local.amount !== server.amount;
    const dateDiff = local.date !== server.date;
    const catDiff = (local.category_id || local.category_name) !== (server.category_id || server.category_name);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="glass-card border border-border/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-border/60">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/20">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-sans font-bold text-foreground flex items-center gap-2">
                                <span>Conflicto de Sincronización</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                                    Merge Editor
                                </span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Este movimiento tiene datos diferentes en el cliente local y en el servidor. Elige la versión definitiva.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Comparación lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Tarjeta Local */}
                    <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-blue-500/20 mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                    <Laptop className="w-4 h-4" />
                                    Versión Local (Dispositivo)
                                </span>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Descripción:</span>
                                    <span className={`font-semibold ${descDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {local.description || '(Sin descripción)'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Importe:</span>
                                    <span className={`font-semibold tabular-nums ${amountDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {Math.abs(local.amount).toFixed(2)} € ({local.type === 'income' ? 'Ingreso' : 'Gasto'})
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Fecha:</span>
                                    <span className={`font-semibold ${dateDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {local.date}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block mb-1">Categoría:</span>
                                    <CategoryBadge
                                        categoryName={local.category_name}
                                        categoryId={local.category_id}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onResolve('local')}
                            className="mt-5 w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            <span>Conservar Versión Local</span>
                        </button>
                    </div>

                    {/* Tarjeta Servidor */}
                    <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20 mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                    <Cloud className="w-4 h-4" />
                                    Versión Servidor (Nube)
                                </span>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Descripción:</span>
                                    <span className={`font-semibold ${descDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {server.description || '(Sin descripción)'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Importe:</span>
                                    <span className={`font-semibold tabular-nums ${amountDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {Math.abs(server.amount).toFixed(2)} € ({server.type === 'income' ? 'Ingreso' : 'Gasto'})
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Fecha:</span>
                                    <span className={`font-semibold ${dateDiff ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                                        {server.date}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[11px] text-muted-foreground block mb-1">Categoría:</span>
                                    <CategoryBadge
                                        categoryName={server.category_name}
                                        categoryId={server.category_id}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onResolve('server')}
                            className="mt-5 w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            <span>Aceptar Versión Servidor</span>
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span>* Los campos marcados en color ámbar presentan discrepancias.</span>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="hover:text-foreground font-medium"
                    >
                        Omitir por ahora
                    </button>
                </div>
            </div>
        </div>
    );
};

