import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, AreaChart, ReferenceLine
} from 'recharts';

interface AnalyticsPageProps {
    transactions: any[];
}

type PeriodFilter = 'all' | '1y' | '6m' | '3m' | '1m';

export function AnalyticsPage({ transactions }: AnalyticsPageProps) {
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

    // Filter transactions by period
    const filteredTransactions = useMemo(() => {
        if (periodFilter === 'all') return transactions;

        const now = new Date();
        let cutoffDate = new Date();

        switch (periodFilter) {
            case '1y':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            case '6m':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
            case '3m':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            case '1m':
                cutoffDate.setMonth(now.getMonth() - 1);
                break;
        }

        return transactions.filter(t => new Date(t.date) >= cutoffDate);
    }, [transactions, periodFilter]);

    // Process data for balance evolution chart
    const balanceData = useMemo(() => {
        if (filteredTransactions.length === 0) return [];

        const sorted = [...filteredTransactions].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        let balance = 0;

        // If filtered, calculate starting balance from excluded transactions
        if (periodFilter !== 'all') {
            const now = new Date();
            let cutoffDate = new Date();
            switch (periodFilter) {
                case '1y': cutoffDate.setFullYear(now.getFullYear() - 1); break;
                case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
                case '3m': cutoffDate.setMonth(now.getMonth() - 3); break;
                case '1m': cutoffDate.setMonth(now.getMonth() - 1); break;
            }
            transactions
                .filter(t => new Date(t.date) < cutoffDate)
                .forEach(t => { balance += parseFloat(t.amount); });
        }

        const dailyBalances: Record<string, number> = {};
        sorted.forEach(t => {
            const date = t.date;
            const amount = parseFloat(t.amount);
            balance += amount;
            dailyBalances[date] = balance;
        });

        return Object.entries(dailyBalances).map(([date, value]) => ({
            date,
            balance: Math.round(value * 100) / 100,
            displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        }));
    }, [filteredTransactions, transactions, periodFilter]);

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

    const periodLabels: Record<PeriodFilter, string> = {
        'all': 'MAX',
        '1y': '1 Año',
        '6m': '6 Meses',
        '3m': '3 Meses',
        '1m': '1 Mes'
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Análisis Financiero</h2>
                <p className="text-slate-400">Evolución de tu economía a lo largo del tiempo</p>
            </div>

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
                            {isPositive ? <ArrowUpRight className="text-emerald-400" size={20} /> : <ArrowDownRight className="text-rose-400" size={20} />}
                            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{metrics.change.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <p className="text-slate-400 text-sm mb-1">Variación %</p>
                        <div className="flex items-center gap-2">
                            {isPositive ? <TrendingUp className="text-emerald-400" size={20} /> : <TrendingDown className="text-rose-400" size={20} />}
                            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{metrics.changePercent.toFixed(2)}%
                            </p>
                        </div>
                    </Card>
                </div>
            )}

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg text-white">Evolución del Balance</h3>

                    {/* Period Filter Buttons */}
                    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                        {(['all', '1y', '6m', '3m', '1m'] as PeriodFilter[]).map((period) => (
                            <button
                                key={period}
                                onClick={() => setPeriodFilter(period)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${periodFilter === period
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                            >
                                {periodLabels[period]}
                            </button>
                        ))}
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
                                <XAxis dataKey="displayDate" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={{ stroke: '#334155' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    formatter={(value) => value !== undefined ? [`${Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`, 'Balance'] : ['', '']}
                                />
                                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="balance" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth={2} fill="url(#balanceGradient)" />
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

            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="font-semibold text-white mb-4">Balance Máximo ({periodLabels[periodFilter]})</h3>
                        <p className="text-3xl font-bold text-emerald-400">{metrics.max.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </Card>
                    <Card>
                        <h3 className="font-semibold text-white mb-4">Balance Mínimo ({periodLabels[periodFilter]})</h3>
                        <p className="text-3xl font-bold text-rose-400">{metrics.min.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </Card>
                </div>
            )}
        </div>
    );
}
