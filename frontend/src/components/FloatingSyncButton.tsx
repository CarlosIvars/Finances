import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { 
    subscribeSyncStatus, 
    performFullBidirectionalSync, 
    type SyncStatus 
} from '../services/syncService';

export const FloatingSyncButton: React.FC = () => {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        lastSyncTime: null,
        error: null,
    });
    const [justSynced, setJustSynced] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeSyncStatus((newStatus) => {
            setStatus(newStatus);
        });
        return unsubscribe;
    }, []);

    const handleSync = async () => {
        if (status.isSyncing) return;
        const res = await performFullBidirectionalSync();
        if (res.success > 0 || res.conflicts > 0 || !res.failed) {
            setJustSynced(true);
            setTimeout(() => setJustSynced(false), 2500);
        }
    };

    const formatLastSync = (iso: string | null) => {
        if (!iso) return 'Pendiente';
        try {
            const date = new Date(iso);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Reciente';
        }
    };

    return (
        <div className="relative group">
            <button
                type="button"
                onClick={handleSync}
                disabled={status.isSyncing}
                className={`relative flex items-center justify-center p-2 rounded-xl border transition-all duration-200 shadow-sm ${
                    status.isSyncing
                        ? 'bg-primary/10 border-primary/30 text-primary cursor-wait'
                        : justSynced
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : status.error
                        ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
                        : 'bg-secondary/80 border-border/80 text-foreground hover:bg-secondary hover:border-primary/40'
                }`}
                title="Sincronización manual bidireccional"
                aria-label="Sincronizar datos"
            >
                <RefreshCw
                    className={`w-4 h-4 transition-transform duration-700 ${
                        status.isSyncing ? 'animate-spin text-primary' : ''
                    }`}
                />

                {/* Badge de elementos pendientes por subir */}
                {status.pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {status.pendingCount}
                    </span>
                )}
            </button>

            {/* Tooltip flotante al hacer hover */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-52 p-2.5 glass-card border border-border/80 rounded-xl shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 pointer-events-none">
                <div className="flex items-center justify-between font-semibold pb-1.5 border-b border-border/60">
                    <span className="text-foreground flex items-center gap-1.5">
                        {status.isSyncing ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                                <span>Sincronizando...</span>
                            </>
                        ) : justSynced ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>¡Sincronizado!</span>
                            </>
                        ) : status.error ? (
                            <>
                                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                                <span>Error de sync</span>
                            </>
                        ) : (
                            <span>Sincronización</span>
                        )}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                        {formatLastSync(status.lastSyncTime)}
                    </span>
                </div>

                <div className="pt-1.5 space-y-1 text-muted-foreground text-[11px]">
                    <p>• Clic para sincronización manual inmediata.</p>
                    <p>• Cron automático: cada 1 hora.</p>
                    {status.pendingCount > 0 && (
                        <p className="text-amber-500 font-medium">
                            • {status.pendingCount} cambio(s) pendiente(s) de subida.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

