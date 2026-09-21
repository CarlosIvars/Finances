
import { LayoutDashboard, Receipt, PieChart, Import, Settings, LogOut, Sparkles, Wallet, Shield, Landmark, FolderTree } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout?: () => void;
}

export function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'banking', label: 'Bancos (Open Banking)', icon: <Landmark size={20} /> },
        { id: 'transactions', label: 'Transacciones', icon: <Receipt size={20} /> },
        { id: 'categories', label: 'Categorías (Árbol)', icon: <FolderTree size={20} /> },
        { id: 'analytics', label: 'Análisis', icon: <PieChart size={20} /> },
        { id: 'budget', label: 'Presupuesto', icon: <Wallet size={20} /> },
        { id: 'insights', label: 'Insights IA', icon: <Sparkles size={20} /> },
        { id: 'import', label: 'Importar', icon: <Import size={20} /> },
        { id: 'privacy', label: 'Privacidad', icon: <Shield size={20} /> },
    ];

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-card/90 dark:bg-card/75 backdrop-blur-xl border-r border-border/80 dark:border-white/[0.08] flex flex-col z-50 transition-colors duration-300 shadow-sm">
            <div className="p-6 border-b border-border/60">
                <h1 className="text-2xl font-sans font-bold flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-9 h-9 p-1 bg-primary/10 dark:bg-primary/15 border border-primary/20 rounded-xl flex items-center justify-center overflow-hidden">
                        <img src="/logo.png" alt="FinancIAs Logo" className="w-full h-full object-contain" />
                    </div>
                    <span>FinancIAs</span>
                </h1>
            </div>

            <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`
              w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200
              font-medium text-sm
              ${activeTab === item.id
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                            }
            `}
                    >
                        <span className={activeTab === item.id ? 'text-primary-foreground' : 'text-muted-foreground'}>
                            {item.icon}
                        </span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="p-3.5 border-t border-border/60 space-y-1">
                <a
                    href="http://localhost:8000/admin/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all text-sm font-medium"
                >
                    <Settings size={18} />
                    Admin
                </a>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
                >
                    <LogOut size={18} />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
