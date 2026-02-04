import { useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, AreaChart, ReferenceLine
} from 'recharts';

interface AnalyticsPageProps {
    transactions: any[];
}

export function AnalyticsPage({ transactions }: AnalyticsPageProps) {
    // Process data for balance evolution chart
    const balanceData = useMemo(() => {
        if (transactions.length === 0) return [];

        // Sort by date
        const sorted = [...transactions].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Calculate running balance
        let balance = 0;
        const dailyBalances: Record<string, number> = {};

        sorted.forEach(t => {
            const date = t.date;
            const amount = parseFloat(t.amount);
            balance += amount;
            dailyBalances[date] = balance;
        });

        // Convert to array for chart
        return Object.entries(dailyBalances).map(([date, value]) => ({
            date,
            balance: Math.round(value * 100) / 100,
            displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        }));
    }, [transactions]);

    // Calculate key metrics
    const metrics = useMemo(() => {
        if (balanceData.length === 0) return null;

        const first = balanceData[0]?.balance || 0;
        const last = balanceData[balanceData.length - 1]?.balance || 0;
        const change = last - first;
        const changePercent = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
        const max = Math.max(...balanceData.map(d => d.balance));
        const min = Math.min(...balanceData.map(d => d.balance));

        return { first, last, change, changePercent, max, min };
    }, [balanceData]);

    const isPositive = (metrics?.change || 0) >= 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Análisis Financiero</h2>
                <p className="text-slate-400">Evolución de tu economía a lo largo del tiempo</p>
            </div>

            {/* Key Metrics */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <p className="text-slate-400 text-sm mb-1">Balance Inicial</p>
                        <p className="text-2xl font-bold text-white">{metrics.first.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </Card>
                    <Card>
                        <p className="text-slate-400 text-sm mb-1">Balance Actual</p>
                        <p className="text-2xl font-bold text-white">{metrics.last.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </Card>
                    <Card>
                        <p className="text-slate-400 text-sm mb-1">Variación</p>
                        <div className="flex items-center gap-2">
                            {isPositive ? (
                                <ArrowUpRight className="text-emerald-400" size={20} />
                            ) : (
                                <ArrowDownRight className="text-rose-400" size={20} />
                            )}
                            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{metrics.change.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <p className="text-slate-400 text-sm mb-1">Variación %</p>
                        <div className="flex items-center gap-2">
                            {isPositive ? (
                                <TrendingUp className="text-emerald-400" size={20} />
                            ) : (
                                <TrendingDown className="text-rose-400" size={20} />
                            )}
                            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{metrics.changePercent.toFixed(2)}%
                            </p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Main Chart - Stock Style */}
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg text-white">Evolución del Balance</h3>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                            Histórico Completo
                        </span>
                    </div>
                </div>

                <div className="h-96">
                    {balanceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={balanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#64748b"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    axisLine={{ stroke: '#334155' }}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                    axisLine={{ stroke: '#334155' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '12px',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                                    }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    formatter={(value: number) => [
                                        `${value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
                                        'Balance'
                                    ]}
                                />
                                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                <Area
                                    type="monotone"
                                    dataKey="balance"
                                    stroke={isPositive ? "#22c55e" : "#ef4444"}
                                    strokeWidth={2}
                                    fill="url(#balanceGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Sin datos disponibles</p>
                            <p className="text-sm">Importa transacciones para ver la evolución</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Stats Row */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="font-semibold text-white mb-4">Balance Máximo Alcanzado</h3>
                        <p className="text-3xl font-bold text-emerald-400">
                            {metrics.max.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </Card>
                    <Card>
                        <h3 className="font-semibold text-white mb-4">Balance Mínimo Alcanzado</h3>
                        <p className="text-3xl font-bold text-rose-400">
                            {metrics.min.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </Card>
                </div>
            )}
        </div>
    );
}
