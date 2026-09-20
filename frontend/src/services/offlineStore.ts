import { openDB } from 'idb';

interface PendingTransaction {
    id: string;
    description: string;
    amount: number;
    category_id: number | null;
    category_name?: string;
    date: string;
    type: 'income' | 'expense';
    created_at: string;
    synced: boolean;
}

interface CachedCategory {
    id: number;
    name: string;
    color: string;
    is_income: boolean;
}

interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete';
    data: unknown;
    timestamp: string;
}

const DB_NAME = 'finanzas-offline';
const DB_VERSION = 1;

function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Pending transactions store
            if (!db.objectStoreNames.contains('pendingTransactions')) {
                const txStore = db.createObjectStore('pendingTransactions', { keyPath: 'id' });
                txStore.createIndex('by-synced', 'synced');
            }

            // Cached categories store
            if (!db.objectStoreNames.contains('cachedCategories')) {
                db.createObjectStore('cachedCategories', { keyPath: 'id' });
            }

            // Sync queue store
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id' });
            }
        },
    });
}

// Generate unique ID for offline transactions
function generateId(): string {
    return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ======== TRANSACTIONS ========

export async function addPendingTransaction(tx: Omit<PendingTransaction, 'id' | 'created_at' | 'synced'>): Promise<PendingTransaction> {
    const db = await getDB();
    const transaction: PendingTransaction = {
        ...tx,
        id: generateId(),
        created_at: new Date().toISOString(),
        synced: false,
    };
    await db.put('pendingTransactions', transaction);

    // Also add to sync queue
    await db.put('syncQueue', {
        id: generateId(),
        action: 'create',
        data: transaction,
        timestamp: new Date().toISOString(),
    } as SyncQueueItem);

    return transaction;
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
    const db = await getDB();
    return db.getAll('pendingTransactions') as Promise<PendingTransaction[]>;
}

export async function getUnsyncedTransactions(): Promise<PendingTransaction[]> {
    const db = await getDB();
    const index = db.transaction('pendingTransactions').store.index('by-synced');
    return index.getAll(IDBKeyRange.only(false)) as Promise<PendingTransaction[]>;
}

export async function markTransactionSynced(id: string): Promise<void> {
    const db = await getDB();
    const tx = await db.get('pendingTransactions', id) as PendingTransaction | undefined;
    if (tx) {
        tx.synced = true;
        await db.put('pendingTransactions', tx);
    }
}

export async function deletePendingTransaction(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingTransactions', id);
}

export async function clearSyncedTransactions(): Promise<void> {
    const db = await getDB();
    const index = db.transaction('pendingTransactions').store.index('by-synced');
    const synced = await index.getAll(IDBKeyRange.only(true)) as PendingTransaction[];
    const tx = db.transaction('pendingTransactions', 'readwrite');
    for (const item of synced) {
        await tx.store.delete(item.id);
    }
    await tx.done;
}

// ======== CATEGORIES ========

export async function cacheCategories(categories: CachedCategory[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('cachedCategories', 'readwrite');
    await tx.store.clear();
    for (const cat of categories) {
        await tx.store.put(cat);
    }
    await tx.done;
}

export async function getCachedCategories(): Promise<CachedCategory[]> {
    const db = await getDB();
    return db.getAll('cachedCategories') as Promise<CachedCategory[]>;
}

// ======== SYNC QUEUE ========

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await getDB();
    return db.getAll('syncQueue') as Promise<SyncQueueItem[]>;
}

export async function clearSyncQueue(): Promise<void> {
    const db = await getDB();
    await db.clear('syncQueue');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('syncQueue', id);
}

// ======== CONNECTIVITY ========

export function isOnline(): boolean {
    return navigator.onLine;
}

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}
