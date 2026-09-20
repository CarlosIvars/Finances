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
import { createTransaction, getCategories } from './api';

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

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

export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
    syncListeners.push(callback);
    callback(currentStatus); // Immediately send current status
    return () => {
        syncListeners = syncListeners.filter(l => l !== callback);
    };
}

export function getSyncStatus(): SyncStatus {
    return currentStatus;
}

// Sync unsynced transactions to server
export async function syncPendingTransactions(): Promise<{ success: number; failed: number }> {
    if (isSyncing || !isOnline()) {
        return { success: 0, failed: 0 };
    }

    isSyncing = true;
    currentStatus = { ...currentStatus, isSyncing: true, error: null };
    notifyListeners();

    let success = 0;
    let failed = 0;

    try {
        const unsyncedTxs = await getUnsyncedTransactions();
        currentStatus.pendingCount = unsyncedTxs.length;
        notifyListeners();

        for (const tx of unsyncedTxs) {
            try {
                // Send to server
                await createTransaction({
                    description: tx.description,
                    amount: tx.amount,
                    category: tx.category_id,
                    date: tx.date,
                    type: tx.type,
                    account: 1, // Default account
                });

                // Mark as synced locally
                await markTransactionSynced(tx.id);
                success++;

                currentStatus.pendingCount--;
                notifyListeners();
            } catch (error) {
                console.error('Failed to sync transaction:', tx.id, error);
                failed++;
            }
        }

        // Also process sync queue for any other operations
        const queue = await getSyncQueue();
        for (const item of queue) {
            try {
                // For now, only handle create actions (already processed above via unsyncedTxs)
                await removeSyncQueueItem(item.id);
            } catch (error) {
                console.error('Failed to process sync queue item:', item.id, error);
            }
        }

        currentStatus.lastSyncTime = new Date().toISOString();
        currentStatus.error = null;
    } catch (error) {
        currentStatus.error = error instanceof Error ? error.message : 'Sync failed';
        console.error('Sync error:', error);
    } finally {
        isSyncing = false;
        currentStatus.isSyncing = false;
        notifyListeners();
    }

    return { success, failed };
}

// Cache categories for offline use
export async function syncCategories(): Promise<void> {
    if (!isOnline()) {
        return;
    }

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

// Get categories (from server if online, from cache if offline)
export async function getOfflineCategories() {
    if (isOnline()) {
        try {
            const categories = await getCategories();
            // Cache for offline use
            await cacheCategories(categories.map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                is_income: c.is_income,
            })));
            return categories;
        } catch {
            // Fall back to cache
            return getCachedCategories();
        }
    }
    return getCachedCategories();
}

// Auto-sync when coming online
let unsubscribeConnectivity: (() => void) | null = null;

export function startAutoSync(): void {
    if (unsubscribeConnectivity) return;

    // Initial sync
    if (isOnline()) {
        syncPendingTransactions();
        syncCategories();
    }

    // Listen for connectivity changes
    unsubscribeConnectivity = onConnectivityChange(async (online) => {
        if (online) {
            console.log('📶 Online - starting sync...');
            await syncCategories();
            const result = await syncPendingTransactions();
            if (result.success > 0) {
                console.log(`✅ Synced ${result.success} transactions`);
            }
        } else {
            console.log('📴 Offline - transactions will be queued');
        }
    });
}

export function stopAutoSync(): void {
    if (unsubscribeConnectivity) {
        unsubscribeConnectivity();
        unsubscribeConnectivity = null;
    }
}

// Update pending count for status display
export async function updatePendingCount(): Promise<void> {
    const unsynced = await getUnsyncedTransactions();
    currentStatus.pendingCount = unsynced.length;
    notifyListeners();
}
