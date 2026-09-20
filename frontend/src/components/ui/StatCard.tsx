
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
                    <p className="text-muted-foreground text-xs font-semibold mb-1 tracking-wider uppercase">{title}</p>
                    <h3 className="text-3xl font-heading font-bold text-foreground tracking-tight">
                        {value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </h3>
                    {trend && (
                        <p className={`text-xs mt-2 font-medium ${style.trendColor} flex items-center gap-1 bg-accent inline-flex px-2 py-0.5 rounded-full border border-border`}>
                            {trend > 0 ? '+' : ''}{trend}% vs mes anterior
                        </p>
                    )}
                </div>
                <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${style.bg} ${style.text}`}>
                    {style.icon}
                </div>
            </div>
        </Card>
    );
}
