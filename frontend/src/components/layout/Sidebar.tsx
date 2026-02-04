
import { LayoutDashboard, Receipt, PieChart, Import, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout?: () => void;
}

export function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'transactions', label: 'Transacciones', icon: <Receipt size={20} /> },
        { id: 'analytics', label: 'Análisis', icon: <PieChart size={20} /> },
        { id: 'import', label: 'Importar', icon: <Import size={20} /> },
    ];

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0f172a] border-r border-white/10 flex flex-col z-50">
            <div className="p-6 border-b border-white/5">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                    <PieChart className="text-blue-500" />
                    FinancIAs
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              font-medium text-sm
              ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
            `}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2">
                <a
                    href="http://localhost:8000/admin/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
                >
                    <Settings size={20} />
                    Admin
                </a>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium"
                >
                    <LogOut size={20} />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
