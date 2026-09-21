import React from 'react';
import { CategoriesTreeView } from '../components/CategoriesTreeView';
import { FolderTree } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-sans font-bold text-foreground tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <FolderTree className="text-primary w-6 h-6" />
                        </div>
                        Árbol Jerárquico de Categorías
                    </h2>
                    <p className="text-muted-foreground font-medium mt-1">
                        Organiza tus gastos e ingresos en categorías principales y subcategorías anidadas.
                    </p>
                </div>
            </div>

            <CategoriesTreeView />
        </div>
    );
};

