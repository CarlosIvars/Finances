
import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout?: () => void;
}

export function Layout({ children, activeTab, onTabChange, onLogout }: LayoutProps) {
    return (
        <div className="min-h-screen bg-[#0b1120] text-gray-100 font-sans selection:bg-blue-500/30">
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />
            <main className="ml-64 p-8 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
