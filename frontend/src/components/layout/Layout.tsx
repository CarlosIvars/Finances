
import React from 'react';
import { Sidebar } from './Sidebar';
import { AlertBell } from '../AlertBell';
import { ThemeToggle } from '../ThemeToggle';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout?: () => void;
}

export function Layout({ children, activeTab, onTabChange, onLogout }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative overflow-hidden transition-colors duration-300">
            <div className="relative z-10 flex min-h-screen">
                <Sidebar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />

                {/* Top bar with theme toggle & alerts */}
                <div className="fixed top-4 right-8 z-40 flex items-center gap-4">
                    <ThemeToggle />
                    <AlertBell />
                </div>

                <main className="ml-64 p-8 min-h-screen w-full">
                    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
