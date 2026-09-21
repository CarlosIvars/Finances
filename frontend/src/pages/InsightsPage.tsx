import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Sparkles, Loader2, ChevronDown, ChevronUp, ExternalLink, Trash2 } from 'lucide-react';
import { getAlerts, generateInsights, markAlertRead, dismissAlert, getTransactions } from '../services/api';
import type { Alert } from '../services/api';
import { CategoryBadge } from '../components/CategoryBadge';

interface InsightsPageProps {
    onNavigateToTransactions?: (filter: { categoryId?: number; transactionIds?: number[] }) => void;
}

// Simple markdown-like formatting for messages
function formatMessage(text: string) {
    // Convert **text** to bold
    let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>');
    // Convert *text* to italic (but not inside bold)
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\.\s+/gm, '<span class="text-primary font-medium">$1.</span> ');
    // Convert emoji bullet points
    formatted = formatted.replace(/^(📈|📉|💰|🔄|⚠️|✅|❌|🎯|💡|🤖)\s+/gm, '<span class="text-xl mr-2">$1</span>');
    return formatted;
}

export function InsightsPage({ onNavigateToTransactions }: InsightsPageProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [alertsData, txData] = await Promise.all([
                getAlerts(),
                getTransactions()
            ]);
            setAlerts(alertsData);
            setTransactions(txData);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setLoading(false);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await generateInsights();
            await fetchData();
            window.dispatchEvent(new Event('alertsUpdated'));
        } catch (error) {
            console.error('Error generating:', error);
        }
        setIsGenerating(false);
    };

    const handleExpand = async (alert: Alert) => {
        if (expandedId === alert.id) {
            setExpandedId(null);
        } else {
            setExpandedId(alert.id);
            if (!alert.is_read) {
                await markAlertRead(alert.id);
                setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: true } : a));
                window.dispatchEvent(new Event('alertsUpdated'));
            }
        }
    };

    const handleDismiss = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        await dismissAlert(id);
        setAlerts(prev => prev.filter(a => a.id !== id));
        window.dispatchEvent(new Event('alertsUpdated'));
    };

    const getRelatedTransactions = (alert: Alert) => {
        if (!alert.related_data) return [];

        const { transaction_ids, category_id, category_ids } = alert.related_data;

        if (transaction_ids && transaction_ids.length > 0) {
            return transactions.filter(t => transaction_ids.includes(t.id));
        }

        if (category_id) {
            return transactions.filter(t => t.category === category_id).slice(0, 10);
        }

        if (category_ids && category_ids.length > 0) {
            return transactions.filter(t => category_ids.includes(t.category)).slice(0, 15);
        }

        return [];
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatAmount = (amount: number) => {
        return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    };

    const getAlertTypeColor = (type: string) => {
        switch (type) {
            case 'anomaly': return 'border-l-rose-500 bg-rose-500/5';
            case 'insight': return 'border-l-blue-500 bg-blue-500/5';
            case 'reminder': return 'border-l-amber-500 bg-amber-500/5';
            case 'goal': return 'border-l-emerald-500 bg-emerald-500/5';
            default: return 'border-l-slate-500';
        }
    };

    const isLongMessage = (msg: string) => msg.length > 200;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-sans font-bold text-foreground mb-1 tracking-tight">🧠 Insights IA</h2>
                    <p className="text-muted-foreground font-medium mt-1">Análisis inteligente de tus finanzas</p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground font-medium transition-all shadow-sm disabled:opacity-50"
                >
                    {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Sparkles className="w-5 h-5" />
                    )}
                    {isGenerating ? 'Analizando...' : 'Generar Análisis'}
                </button>
            </div>

            {/* Alerts List */}
            {alerts.length === 0 ? (
                <Card>
                    <div className="py-16 text-center">
                        <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">No hay insights todavía</h3>
                        <p className="text-muted-foreground mb-6">Haz clic en "Generar Análisis" para obtener recomendaciones personalizadas</p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground font-medium transition-all shadow-sm"
                        >
                            Generar mi primer análisis
                        </button>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {alerts.map(alert => {
                        const isExpanded = expandedId === alert.id;
                        const relatedTx = getRelatedTransactions(alert);
                        const longMessage = isLongMessage(alert.message);

                        return (
                            <div
                                key={alert.id}
                                className={`rounded-2xl border-l-4 ${getAlertTypeColor(alert.type)} border border-border/80 glass-card overflow-hidden transition-all ${!alert.is_read ? 'ring-1 ring-primary/30 shadow-sm' : ''
                                    }`}
                            >
                                {/* Header - clickable to expand */}
                                <div
                                    onClick={() => handleExpand(alert)}
                                    className="p-5 cursor-pointer hover:bg-accent/50 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-3xl flex-shrink-0">{alert.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-semibold text-lg ${!alert.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {alert.title}
                                                </h3>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        {formatDate(alert.created_at)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDismiss(alert.id, e)}
                                                        className="p-1.5 hover:bg-accent rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Message - truncated when collapsed, full when expanded */}
                                            <div
                                                className={`text-muted-foreground mt-3 whitespace-pre-wrap leading-relaxed ${!isExpanded && longMessage ? 'line-clamp-4' : ''}`}
                                                dangerouslySetInnerHTML={{ __html: formatMessage(alert.message) }}
                                            />

                                            {/* Expand/collapse button */}
                                            <button className="flex items-center gap-1 mt-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                {isExpanded ? 'Contraer' : (longMessage ? 'Ver mensaje completo' : 'Expandir')}
                                                {relatedTx.length > 0 && !isExpanded && ` + ${relatedTx.length} transacciones`}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-accent/30">
                                        {/* Related Transactions */}
                                        {relatedTx.length > 0 && (
                                            <div className="p-4">
                                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                    📊 Transacciones relacionadas ({relatedTx.length})
                                                </h4>
                                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                                    {relatedTx.map(tx => (
                                                        <div
                                                            key={tx.id}
                                                            className="flex items-center justify-between p-3 bg-background border border-border shadow-sm rounded-xl hover:bg-accent transition-all gap-3"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <CategoryBadge
                                                                    categoryName={tx.category_name}
                                                                    parentCategoryName={tx.parent_category_name}
                                                                    categoryColor={tx.category_color}
                                                                    categoryIcon={tx.category_icon}
                                                                    categoryId={tx.category}
                                                                    variant="icon-only"
                                                                    size="sm"
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-foreground truncate">
                                                                        {tx.description}
                                                                    </p>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                                                                        <span className="text-xs text-muted-foreground">•</span>
                                                                        <CategoryBadge
                                                                            categoryName={tx.category_name}
                                                                            parentCategoryName={tx.parent_category_name}
                                                                            categoryColor={tx.category_color}
                                                                            categoryIcon={tx.category_icon}
                                                                            categoryId={tx.category}
                                                                            size="xs"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className={`font-semibold ml-3 whitespace-nowrap ${tx.amount < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                                                                {formatAmount(parseFloat(tx.amount))}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {onNavigateToTransactions && alert.related_data && (
                                                    <button
                                                        onClick={() => onNavigateToTransactions({
                                                            categoryId: alert.related_data?.category_id,
                                                            transactionIds: alert.related_data?.transaction_ids
                                                        })}
                                                        className="flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        <ExternalLink size={14} />
                                                        Ver todas en Transacciones
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
