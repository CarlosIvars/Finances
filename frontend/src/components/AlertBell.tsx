import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { getAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead, dismissAlert } from '../services/api';
import type { Alert } from '../services/api';

export function AlertBell() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch alerts
    const fetchAlerts = async () => {
        try {
            const [alertsData, count] = await Promise.all([
                getAlerts(),
                getUnreadAlertCount()
            ]);
            setAlerts(alertsData);
            setUnreadCount(count);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        }
    };

    useEffect(() => {
        fetchAlerts();
        // Refresh every 30 seconds (shorter interval)
        const interval = setInterval(fetchAlerts, 30 * 1000);

        // Listen for custom event from Dashboard when insights are generated
        const handleRefresh = () => fetchAlerts();
        window.addEventListener('alertsUpdated', handleRefresh);

        return () => {
            clearInterval(interval);
            window.removeEventListener('alertsUpdated', handleRefresh);
        };
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkRead = async (id: number) => {
        await markAlertRead(id);
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllRead = async () => {
        await markAllAlertsRead();
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
        setUnreadCount(0);
    };

    const handleDismiss = async (id: number) => {
        await dismissAlert(id);
        setAlerts(prev => prev.filter(a => a.id !== id));
    };


    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Hace un momento';
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        return date.toLocaleDateString('es-ES');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-background/80 hover:bg-secondary transition-all border border-border/70 shadow-sm"
                aria-label="Notificaciones"
            >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-96 glass-card border border-border/80 rounded-2xl shadow-xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-border/60">
                        <h3 className="font-sans font-semibold text-foreground tracking-tight">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-xl text-secondary-foreground transition-all"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Leer todo
                            </button>
                        )}
                    </div>

                    {/* Alert List */}
                    <div className="max-h-96 overflow-y-auto">
                        {alerts.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="font-medium">No hay notificaciones</p>
                                <p className="mt-2 text-xs">Pulsa "Análisis IA" en el Dashboard</p>
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={`p-4 border-b border-border hover:bg-muted/50 transition-all ${!alert.is_read ? 'bg-primary/5' : ''
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <span className="text-2xl">{alert.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className={`font-medium truncate ${!alert.is_read ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                                    {alert.title}
                                                </h4>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    {!alert.is_read && (
                                                        <button
                                                            onClick={() => handleMarkRead(alert.id)}
                                                            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                                                            title="Marcar como leída"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDismiss(alert.id)}
                                                        className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive transition-colors"
                                                        title="Descartar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                                                {alert.message}
                                            </p>
                                            <span className="text-xs font-medium text-muted-foreground mt-2 block">
                                                {formatDate(alert.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
