
import { Card } from '../ui/Card';
import { ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: number;
    type: 'balance' | 'income' | 'expense';
    trend?: number;
}

export function StatCard({ title, value, type, trend }: StatCardProps) {
    const config = {
        balance: {
            icon: <DollarSign className="w-6 h-6 text-blue-400" />,
            bg: "bg-blue-500/10",
            text: "text-blue-400",
            trendColor: "text-blue-400"
        },
        income: {
            icon: <ArrowUpRight className="w-6 h-6 text-emerald-400" />,
            bg: "bg-emerald-500/10",
            text: "text-emerald-400",
            trendColor: "text-emerald-400"
        },
        expense: {
            icon: <ArrowDownRight className="w-6 h-6 text-rose-400" />,
            bg: "bg-rose-500/10",
            text: "text-rose-400",
            trendColor: "text-rose-400"
        }
    };

    const style = config[type];

    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                        {value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </h3>
                    {trend && (
                        <p className={`text-xs mt-2 font-medium ${style.trendColor} flex items-center gap-1`}>
                            {trend > 0 ? '+' : ''}{trend}% vs mes anterior
                        </p>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${style.bg} backdrop-blur-sm border border-white/5 shadow-inner`}>
                    {style.icon}
                </div>
            </div>
        </Card>
    );
}
