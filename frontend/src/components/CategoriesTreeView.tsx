import React, { useState, useEffect } from 'react';
import { 
    ChevronRight, 
    ChevronDown, 
    Plus, 
    Trash2, 
    Folder, 
    FolderOpen, 
    Tag, 
    ArrowUpRight, 
    ArrowDownLeft, 
    RefreshCw,
    X,
    Check
} from 'lucide-react';
import type { Category } from '../services/api';
import { getCategoriesTree, createCategory, deleteCategory } from '../services/api';

interface CategoriesTreeViewProps {
    onCategorySelected?: (category: Category) => void;
}

export const CategoriesTreeView: React.FC<CategoriesTreeViewProps> = ({ onCategorySelected }) => {
    const [tree, setTree] = useState<Category[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal para nueva categoría / subcategoría
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetParent, setTargetParent] = useState<Category | null>(null);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#10B981');
    const [newIsIncome, setNewIsIncome] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadTree = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getCategoriesTree();
            setTree(data);
            // Expandir por defecto las categorías raíz
            setExpandedIds(new Set(data.map(c => c.id)));
        } catch (err: any) {
            setError(err.message || 'Error al cargar el árbol de categorías.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTree();
    }, []);

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleOpenAdd = (parent: Category | null = null) => {
        setTargetParent(parent);
        setNewName('');
        setNewColor(parent ? parent.color : '#10B981');
        setNewIsIncome(parent ? parent.is_income : false);
        setIsModalOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await createCategory({
                name: newName.trim(),
                color: newColor,
                is_income: newIsIncome,
                parent: targetParent ? targetParent.id : null,
            });
            setIsModalOpen(false);
            await loadTree();
        } catch (err: any) {
            alert('Error al crear categoría: ' + (err.response?.data?.parent?.[0] || err.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (cat: Category) => {
        const hasChildren = cat.subcategories && cat.subcategories.length > 0;
        const msg = hasChildren 
            ? `¿Eliminar "${cat.name}" y sus ${cat.subcategories!.length} subcategorías?`
            : `¿Eliminar la categoría "${cat.name}"?`;

        if (!window.confirm(msg)) return;

        try {
            await deleteCategory(cat.id);
            await loadTree();
        } catch (err: any) {
            alert('Error al eliminar categoría: ' + err.message);
        }
    };

    const renderNode = (node: Category, depth: number = 0) => {
        const hasChildren = Boolean(node.subcategories && node.subcategories.length > 0);
        const isExpanded = expandedIds.has(node.id);

        return (
            <div key={node.id} className="select-none">
                <div 
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-150 group border border-transparent hover:border-slate-800 ${
                        depth === 0 ? 'bg-slate-900/60 my-1.5' : 'bg-slate-950/40 my-1 ml-6 border-l-2'
                    }`}
                    style={{ borderLeftColor: depth > 0 ? node.color : undefined }}
                >
                    <div 
                        className="flex items-center space-x-3 flex-1 cursor-pointer"
                        onClick={() => {
                            if (hasChildren) toggleExpand(node.id);
                            onCategorySelected?.(node);
                        }}
                    >
                        {/* Botón expandir/colapsar */}
                        {hasChildren ? (
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(node.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        ) : (
                            <span className="w-6 inline-block text-center text-slate-600">•</span>
                        )}

                        {/* Indicador de color y badge */}
                        <div 
                            className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                            style={{ backgroundColor: node.color }}
                        />

                        {/* Icono de carpeta si tiene hijos o tag si es hoja */}
                        {depth === 0 ? (
                            isExpanded ? (
                                <FolderOpen className="w-4 h-4 text-emerald-400/80" />
                            ) : (
                                <Folder className="w-4 h-4 text-slate-400" />
                            )
                        ) : (
                            <Tag className="w-3.5 h-3.5 text-slate-500" />
                        )}

                        {/* Nombre de la categoría */}
                        <span className={`text-sm ${depth === 0 ? 'font-semibold text-slate-200' : 'font-medium text-slate-300'}`}>
                            {node.name}
                        </span>

                        {/* Tipo: Ingreso / Gasto badge */}
                        {node.is_income ? (
                            <span className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                                <ArrowDownLeft className="w-3 h-3" />
                                <span>Ingreso</span>
                            </span>
                        ) : (
                            <span className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-400">
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Gasto</span>
                            </span>
                        )}

                        {/* Contador de subcategorías */}
                        {hasChildren && (
                            <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
                                {node.subcategories!.length} {node.subcategories!.length === 1 ? 'subcategoría' : 'subcategorías'}
                            </span>
                        )}
                    </div>

                    {/* Acciones del nodo */}
                    <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botón añadir subcategoría hija */}
                        <button
                            type="button"
                            onClick={() => handleOpenAdd(node)}
                            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                            title={`Añadir subcategoría a ${node.name}`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Subcategoría</span>
                        </button>

                        {/* Botón eliminar */}
                        <button
                            type="button"
                            onClick={() => handleDelete(node)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Subcategorías anidadas recursivas */}
                {hasChildren && isExpanded && (
                    <div className="border-l border-slate-800 ml-4">
                        {node.subcategories!.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-xl">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                        <span>🌳 Árbol Jerárquico de Categorías</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Estructura padre e hijo sincronizada entre la web y la app móvil.
                    </p>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={loadTree}
                        className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
                        title="Actualizar árbol"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenAdd(null)}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Categoría Raíz</span>
                    </button>
                </div>
            </div>

            {/* Contenido del árbol */}
            <div className="mt-6">
                {loading && tree.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
                        Cargando estructura jerárquica de categorías...
                    </div>
                ) : error ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                        {error}
                    </div>
                ) : tree.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                        No hay categorías creadas. Pulsa en "Nueva Categoría Raíz" para comenzar.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {tree.map(rootNode => renderNode(rootNode, 0))}
                    </div>
                )}
            </div>

            {/* Modal para Crear Categoría o Subcategoría */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">
                                    {targetParent ? `Añadir Subcategoría a "${targetParent.name}"` : 'Nueva Categoría Raíz'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {targetParent ? 'Se añadirá como nodo hijo en la jerarquía' : 'Categoría principal'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nombre de la {targetParent ? 'Subcategoría' : 'Categoría'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={targetParent ? "Ej: Supermercados, Restaurantes, Gasolina..." : "Ej: Alimentación, Transporte, Ocio..."}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Color distintivo
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={newColor}
                                            onChange={(e) => setNewColor(e.target.value)}
                                            className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                                        />
                                        <span className="text-xs font-mono text-slate-400 uppercase">{newColor}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Tipo de flujo
                                    </label>
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setNewIsIncome(false)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                !newIsIncome ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            Gasto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewIsIncome(true)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                newIsIncome ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            Ingreso
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newName.trim()}
                                    className="flex items-center space-x-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{targetParent ? 'Crear Subcategoría' : 'Crear Categoría'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

