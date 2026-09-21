
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { AlertBell } from '../AlertBell';
import { ThemeToggle } from '../ThemeToggle';
import { FloatingSyncButton } from '../FloatingSyncButton';
import { MergeEditorModal, type SyncConflictItem } from '../MergeEditorModal';
import { 
    subscribeSyncConflict, 
    resolveActiveConflict, 
    dismissConflict 
} from '../../services/syncService';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout?: () => void;
}

export function Layout({ children, activeTab, onTabChange, onLogout }: LayoutProps) {
    const [conflict, setConflict] = useState<SyncConflictItem | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeSyncConflict((active) => {
            setConflict(active);
        });
        return unsubscribe;
    }, []);

    const handleResolveConflict = async (choice: 'local' | 'server') => {
        await resolveActiveConflict(choice);
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative overflow-hidden transition-colors duration-300">
            {/* Subtle background ambient gradients */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute -top-40 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 flex min-h-screen">
                <Sidebar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />

                {/* Top bar with sync button, theme toggle & alerts */}
                <div className="fixed top-4 right-8 z-40 flex items-center gap-2 p-1.5 glass-card rounded-2xl shadow-sm">
                    <FloatingSyncButton />
                    <ThemeToggle />
                    <AlertBell />
                </div>

                {/* Merge Editor Modal ante choques de sincronización */}
                {conflict && (
                    <MergeEditorModal
                        conflict={conflict}
                        onResolve={handleResolveConflict}
                        onDismiss={dismissConflict}
                    />
                )}

                <main className="ml-64 p-8 min-h-screen w-full">
                    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
