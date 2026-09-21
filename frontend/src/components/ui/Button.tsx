import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    className = '',
    disabled,
    ...props
}: ButtonProps) {

    const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

    const variants = {
        primary: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow focus:ring-primary border border-transparent",
        secondary: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border",
        ghost: "bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground",
        danger: "bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20",
        outline: "bg-background hover:bg-accent text-foreground border border-border shadow-sm",
        glass: "glass-card hover:bg-card/90 text-foreground border border-border/80 shadow-sm",
    };

    const sizes = {
        sm: "text-xs px-3 py-1.5 gap-1.5",
        md: "text-sm px-4 py-2 gap-2",
        lg: "text-base px-5 py-2.5 gap-2.5",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 className="animate-spin" size={size === 'lg' ? 20 : 16} />}
            {!loading && icon}
            {children}
        </button>
    );
}
