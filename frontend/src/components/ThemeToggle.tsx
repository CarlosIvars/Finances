import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    return (
        <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            title="Cambiar tema"
        >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
    );
}
