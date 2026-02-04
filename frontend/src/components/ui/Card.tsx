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
        bg-white/5 backdrop-blur-xl 
        border border-white/10 
        rounded-2xl 
        shadow-xl 
        overflow-hidden
        transition-all duration-300
        hover:border-white/20 hover:shadow-2xl
        ${className}
      `}
        >
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
}
