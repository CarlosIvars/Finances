import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
    glass?: boolean;
}

export function Card({ children, className = '', noPadding = false, glass = true }: CardProps) {
    return (
        <div
            className={`
        ${glass ? 'glass-card' : 'bg-card'} 
        text-card-foreground
        border border-border/80 dark:border-white/[0.08]
        rounded-2xl 
        shadow-sm 
        overflow-hidden
        transition-all duration-300
        hover:shadow-md hover:border-primary/20 dark:hover:border-white/[0.16]
        ${className}
      `}
        >
            <div className={noPadding ? '' : 'p-6 relative z-10'}>
                {children}
            </div>
        </div>
    );
}
