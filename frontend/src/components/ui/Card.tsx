import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
    return (
        <div
            className={`
        bg-card text-card-foreground
        border border-border 
        rounded-xl 
        shadow-sm 
        overflow-hidden
        transition-all duration-300
        hover:shadow-md hover:border-muted-foreground/30
        ${className}
      `}
        >
            <div className={noPadding ? '' : 'p-6 relative z-10'}>
                {children}
            </div>
        </div>
    );
}
