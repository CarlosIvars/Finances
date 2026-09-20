import { useState, useEffect } from 'react';
import { isOnline, onConnectivityChange } from '../services/offlineStore';
import { subscribeSyncStatus, updatePendingCount } from '../services/syncService';
import type { SyncStatus } from '../services/syncService';

export function useOnlineStatus() {
    const [online, setOnline] = useState(isOnline());

    useEffect(() => {
        const unsubscribe = onConnectivityChange(setOnline);
        return unsubscribe;
    }, []);

    return online;
}

export function useSyncStatus() {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        lastSyncTime: null,
        error: null,
    });

    useEffect(() => {
        updatePendingCount();
        const unsubscribe = subscribeSyncStatus(setStatus);
        return unsubscribe;
    }, []);

    return status;
}
