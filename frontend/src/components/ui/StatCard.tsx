
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
            icon: <DollarSign className="w-5 h-5 text-blue-500" />,
            bg: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20",
            text: "text-blue-500",
            trendColor: "text-blue-500"
        },
        income: {
            icon: <ArrowUpRight className="w-5 h-5 text-emerald-500" />,
            bg: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
            text: "text-emerald-500",
            trendColor: "text-emerald-500"
        },
        expense: {
            icon: <ArrowDownRight className="w-5 h-5 text-red-500" />,
            bg: "bg-red-500/10 dark:bg-red-500/15 border-red-500/20",
            text: "text-red-500",
            trendColor: "text-red-500"
        }
    };

    const style = config[type];

    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-muted-foreground text-xs font-semibold mb-1.5 tracking-wider uppercase">{title}</p>
                    <h3 className="text-3xl font-sans font-bold text-foreground tracking-tight">
                        {value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </h3>
                    {trend !== undefined && (
                        <p className={`text-xs mt-2 font-medium ${style.trendColor} flex items-center gap-1 bg-secondary/80 inline-flex px-2.5 py-0.5 rounded-full border border-border/60`}>
                            {trend > 0 ? '+' : ''}{trend}% vs mes anterior
                        </p>
                    )}
                </div>
                <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center border ${style.bg}`}>
                    {style.icon}
                </div>
            </div>
        </Card>
    );
}
