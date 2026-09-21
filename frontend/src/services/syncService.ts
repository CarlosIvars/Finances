import {
    getUnsyncedTransactions,
    markTransactionSynced,
    getSyncQueue,
    removeSyncQueueItem,
    isOnline,
    onConnectivityChange,
    cacheCategories,
    getCachedCategories
} from './offlineStore';
import { createTransaction, getCategories, getTransactions } from './api';
import type { SyncConflictItem } from '../components/MergeEditorModal';

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];
let conflictListeners: ((conflict: SyncConflictItem | null) => void)[] = [];
let activeConflict: SyncConflictItem | null = null;
let pendingConflictQueue: SyncConflictItem[] = [];

export interface SyncStatus {
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: string | null;
    error: string | null;
}

let currentStatus: SyncStatus = {
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
};

function notifyListeners() {
    syncListeners.forEach(listener => listener(currentStatus));
}

function notifyConflictListeners() {
    conflictListeners.forEach(listener => listener(activeConflict));
}

export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
    syncListeners.push(callback);
    callback(currentStatus);
    return () => {
        syncListeners = syncListeners.filter(l => l !== callback);
    };
}

export function subscribeSyncConflict(callback: (conflict: SyncConflictItem | null) => void): () => void {
    conflictListeners.push(callback);
    callback(activeConflict);
    return () => {
        conflictListeners = conflictListeners.filter(l => l !== callback);
    };
}

export function getSyncStatus(): SyncStatus {
    return currentStatus;
}

export function getActiveConflict(): SyncConflictItem | null {
    return activeConflict;
}

// Resolver conflicto desde el Merge Editor
export async function resolveActiveConflict(choice: 'local' | 'server'): Promise<void> {
    if (!activeConflict) return;

    const conflict = activeConflict;
    const localId = String(conflict.id);

    try {
        if (choice === 'local') {
            // Se fuerza la versión local enviándola como nueva o actualizando en el servidor
            await createTransaction({
                description: conflict.local.description,
                amount: conflict.local.amount,
                category: conflict.local.category_id || undefined,
                date: conflict.local.date,
                type: conflict.local.type || 'expense',
                account: 1,
            });
            await markTransactionSynced(localId);
        } else {
            // Se acepta la versión del servidor: se marca la versión local como sincronizada/resuelta
            await markTransactionSynced(localId);
        }
    } catch (err) {
        console.error('Error al resolver conflicto:', err);
    } finally {
        // Pasar al siguiente conflicto si existe en la cola
        if (pendingConflictQueue.length > 0) {
            activeConflict = pendingConflictQueue.shift() || null;
        } else {
            activeConflict = null;
        }
        notifyConflictListeners();
        await updatePendingCount();
    }
}

export function dismissConflict(): void {
    if (pendingConflictQueue.length > 0) {
        activeConflict = pendingConflictQueue.shift() || null;
    } else {
        activeConflict = null;
    }
    notifyConflictListeners();
}

// Sincronización Bidireccional con Detección de Conflictos
export async function performFullBidirectionalSync(): Promise<{ success: number; failed: number; conflicts: number }> {
    if (isSyncing || !isOnline()) {
        return { success: 0, failed: 0, conflicts: 0 };
    }

    isSyncing = true;
    currentStatus = { ...currentStatus, isSyncing: true, error: null };
    notifyListeners();

    let success = 0;
    let failed = 0;
    let conflictsFound = 0;

    try {
        // 1. Sincronizar catálogo de categorías bidireccionalmente
        await syncCategories();

        // 2. Obtener datos del servidor para contrastar
        let serverTxs: any[] = [];
        try {
            serverTxs = await getTransactions();
        } catch (err) {
            console.warn('No se pudieron descargar transacciones del servidor:', err);
        }

        // 3. Revisar transacciones locales pendientes
        const unsyncedTxs = await getUnsyncedTransactions();
        currentStatus.pendingCount = unsyncedTxs.length;
        notifyListeners();

        for (const tx of unsyncedTxs) {
            try {
                // Comprobar si existe un registro coincidente en el servidor
                const serverMatch = serverTxs.find((st: any) => 
                    st.date === tx.date && 
                    Math.abs(Number(st.amount)) === Math.abs(Number(tx.amount))
                );

                // Detección de Colisión (Merge Conflict)
                if (serverMatch) {
                    const descDiffer = (serverMatch.description || '').trim().toLowerCase() !== (tx.description || '').trim().toLowerCase();
                    const catDiffer = serverMatch.category && tx.category_id && serverMatch.category !== tx.category_id;

                    if (descDiffer || catDiffer) {
                        // Conflicto real: datos discordantes en local y servidor
                        const conflictItem: SyncConflictItem = {
                            id: tx.id,
                            local: {
                                description: tx.description,
                                amount: tx.amount,
                                date: tx.date,
                                category_id: tx.category_id,
                                category_name: tx.category_name,
                                type: tx.type,
                            },
                            server: {
                                description: serverMatch.description,
                                amount: serverMatch.amount,
                                date: serverMatch.date,
                                category_id: serverMatch.category,
                                category_name: serverMatch.category_name,
                                type: serverMatch.type,
                            }
                        };

                        conflictsFound++;
                        if (!activeConflict) {
                            activeConflict = conflictItem;
                            notifyConflictListeners();
                        } else {
                            pendingConflictQueue.push(conflictItem);
                        }
                        continue; // No sobrescribir, esperar resolución explícita del Merge Editor
                    }
                }

                // Si no hay colisión, enviar al servidor
                await createTransaction({
                    description: tx.description,
                    amount: tx.amount,
                    category: tx.category_id,
                    date: tx.date,
                    type: tx.type,
                    account: 1,
                });

                // Marcar como sincronizado localmente
                await markTransactionSynced(tx.id);
                success++;

                currentStatus.pendingCount = Math.max(0, currentStatus.pendingCount - 1);
                notifyListeners();
            } catch (error) {
                console.error('Fallo al sincronizar transacción:', tx.id, error);
                failed++;
            }
        }

        // 4. Limpiar cola de operaciones offline adicionales
        const queue = await getSyncQueue();
        for (const item of queue) {
            try {
                await removeSyncQueueItem(item.id);
            } catch (error) {
                console.error('Error al procesar cola de sincronización:', item.id, error);
            }
        }

        currentStatus.lastSyncTime = new Date().toISOString();
        currentStatus.error = null;
    } catch (error) {
        currentStatus.error = error instanceof Error ? error.message : 'Error en sincronización';
        console.error('Sync error:', error);
    } finally {
        isSyncing = false;
        currentStatus.isSyncing = false;
        notifyListeners();
    }

    return { success, failed, conflicts: conflictsFound };
}

// Alias de retrocompatibilidad
export const syncPendingTransactions = performFullBidirectionalSync;

// Cachear categorías para uso offline
export async function syncCategories(): Promise<void> {
    if (!isOnline()) return;

    try {
        const categories = await getCategories();
        await cacheCategories(categories.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            is_income: c.is_income,
        })));
    } catch (error) {
        console.error('Failed to cache categories:', error);
    }
}

// Obtener categorías (servidor o caché offline)
export async function getOfflineCategories() {
    if (isOnline()) {
        try {
            const categories = await getCategories();
            await cacheCategories(categories.map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                is_income: c.is_income,
            })));
            return categories;
        } catch {
            return getCachedCategories();
        }
    }
    return getCachedCategories();
}

// Auto-sync al volver online + Cron horario (cada 1 hora)
let unsubscribeConnectivity: (() => void) | null = null;
let hourlyCronInterval: ReturnType<typeof setInterval> | null = null;
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hora

export function startAutoSync(): void {
    // Sincronización inicial si hay conexión
    if (isOnline()) {
        performFullBidirectionalSync();
    }

    // Programar Cron de sincronización horaria
    if (!hourlyCronInterval) {
        hourlyCronInterval = setInterval(() => {
            console.log('⏰ [Cron 1h Web] Ejecutando sincronización horaria bidireccional...');
            performFullBidirectionalSync();
        }, ONE_HOUR_MS);
    }

    // Escucha de conectividad
    if (!unsubscribeConnectivity) {
        unsubscribeConnectivity = onConnectivityChange(async (online) => {
            if (online) {
                console.log('📶 Online - Ejecutando sincronización bidireccional...');
                const result = await performFullBidirectionalSync();
                if (result.success > 0) {
                    console.log(`✅ Sincronizadas ${result.success} transacciones`);
                }
            } else {
                console.log('📴 Modo Offline activado');
            }
        });
    }
}

export function stopAutoSync(): void {
    if (unsubscribeConnectivity) {
        unsubscribeConnectivity();
        unsubscribeConnectivity = null;
    }
    if (hourlyCronInterval) {
        clearInterval(hourlyCronInterval);
        hourlyCronInterval = null;
    }
}

// Actualizar conteo de pendientes para estado visual
export async function updatePendingCount(): Promise<void> {
    const unsynced = await getUnsyncedTransactions();
    currentStatus.pendingCount = unsynced.length;
    notifyListeners();
}
