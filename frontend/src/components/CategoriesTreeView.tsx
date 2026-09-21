import React, { useState, useEffect } from 'react';
import { 
    ChevronRight, 
    ChevronDown, 
    Plus, 
    Trash2, 
    Pencil,
    Folder, 
    FolderOpen, 
    Tag, 
    ArrowUpRight, 
    ArrowDownLeft, 
    RefreshCw, 
    X, 
    Check,
    Car, 
    ShoppingCart, 
    ShoppingBag,
    House, 
    Utensils,
    HeartPulse, 
    CreditCard, 
    BriefcaseBusiness, 
    GraduationCap,
    Gamepad2,
    Tv,
    PiggyBank,
    Plane,
    Coffee,
    Receipt,
    PawPrint
} from 'lucide-react';
import type { Category } from '../services/api';
import { getCategoriesTree, createCategory, updateCategory, deleteCategory } from '../services/api';
import { syncCategories } from '../services/syncService';

export const CATEGORY_ICONS_LIST: Array<{ value: string; icon: React.ElementType; label: string }> = [
    { value: 'credit_card', icon: CreditCard, label: 'General / Tarjeta' },
    { value: 'directions_car', icon: Car, label: 'Transporte / Coche' },
    { value: 'shopping_cart', icon: ShoppingCart, label: 'Supermercado' },
    { value: 'shopping_bag', icon: ShoppingBag, label: 'Compras / Ropa' },
    { value: 'home', icon: House, label: 'Hogar / Vivienda' },
    { value: 'restaurant', icon: Utensils, label: 'Comida / Restaurantes' },
    { value: 'local_hospital', icon: HeartPulse, label: 'Salud / Farmacia' },
    { value: 'work', icon: BriefcaseBusiness, label: 'Trabajo / Nómina' },
    { value: 'school', icon: GraduationCap, label: 'Educación' },
    { value: 'sports_esports', icon: Gamepad2, label: 'Ocio / Juegos' },
    { value: 'subscriptions', icon: Tv, label: 'Suscripciones / TV' },
    { value: 'savings', icon: PiggyBank, label: 'Ahorro / Inversión' },
    { value: 'flight', icon: Plane, label: 'Viajes' },
    { value: 'coffee', icon: Coffee, label: 'Café / Bares' },
    { value: 'receipt', icon: Receipt, label: 'Facturas / Recibos' },
    { value: 'pets', icon: PawPrint, label: 'Mascotas' },
];

export const getCategoryIconComponent = (iconName?: string | null): React.ElementType => {
    if (!iconName) return CreditCard;
    const found = CATEGORY_ICONS_LIST.find(i => i.value === iconName);
    return found ? found.icon : CreditCard;
};

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
    const [newIcon, setNewIcon] = useState('credit_card');
    const [newIsIncome, setNewIsIncome] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal para editar categoría existente
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#10B981');
    const [editIcon, setEditIcon] = useState('credit_card');
    const [editIsIncome, setEditIsIncome] = useState(false);

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
        setNewIcon(parent?.icon || 'credit_card');
        setNewIsIncome(parent ? parent.is_income : false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (cat: Category) => {
        setEditingCategory(cat);
        setEditName(cat.name);
        setEditColor(cat.color || '#10B981');
        setEditIcon(cat.icon || 'credit_card');
        setEditIsIncome(cat.is_income);
        setIsEditModalOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await createCategory({
                name: newName.trim(),
                color: newColor,
                icon: newIcon,
                is_income: newIsIncome,
                parent: targetParent ? targetParent.id : null,
            });
            await syncCategories();
            setIsModalOpen(false);
            await loadTree();
        } catch (err: any) {
            alert('Error al crear categoría: ' + (err.response?.data?.parent?.[0] || err.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory || !editName.trim()) return;

        setIsSubmitting(true);
        try {
            await updateCategory(editingCategory.id, {
                name: editName.trim(),
                color: editColor,
                icon: editIcon,
                is_income: editIsIncome,
            });
            await syncCategories();
            setIsEditModalOpen(false);
            setEditingCategory(null);
            await loadTree();
        } catch (err: any) {
            alert('Error al actualizar categoría: ' + (err.response?.data?.message || err.message));
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
            await syncCategories();
            await loadTree();
        } catch (err: any) {
            alert('Error al eliminar categoría: ' + err.message);
        }
    };

    const renderNode = (node: Category, depth: number = 0) => {
        const hasChildren = Boolean(node.subcategories && node.subcategories.length > 0);
        const isExpanded = expandedIds.has(node.id);
        const NodeIcon = getCategoryIconComponent(node.icon);

        return (
            <div key={node.id} className="select-none">
                <div 
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-150 group border border-transparent hover:border-border/80 ${
                        depth === 0 ? 'bg-secondary/40 my-1.5' : 'bg-secondary/20 my-1 ml-6 border-l-2'
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
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        ) : (
                            <span className="w-6 inline-block text-center text-muted-foreground/50">•</span>
                        )}

                        {/* Icono temático de la categoría */}
                        <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm"
                            style={{ 
                                backgroundColor: `${node.color}25`, 
                                color: node.color,
                                border: `1.5px solid ${node.color}50`
                            }}
                            title={`Icono: ${node.icon || 'credit_card'}`}
                        >
                            <NodeIcon className="w-4 h-4" />
                        </div>

                        {/* Nombre de la categoría */}
                        <span className={`text-sm ${depth === 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                            {node.name}
                        </span>

                        {/* Tipo: Ingreso / Gasto badge */}
                        {node.is_income ? (
                            <span className="flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <ArrowDownLeft className="w-3 h-3" />
                                <span>Ingreso</span>
                            </span>
                        ) : (
                            <span className="flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/20">
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Gasto</span>
                            </span>
                        )}

                        {/* Contador de subcategorías */}
                        {hasChildren && (
                            <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border/60">
                                {node.subcategories!.length} {node.subcategories!.length === 1 ? 'subcategoría' : 'subcategorías'}
                            </span>
                        )}
                    </div>

                    {/* Acciones del nodo */}
                    <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botón editar categoría */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(node);
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors border border-border/60"
                            title={`Editar icono, color y nombre de "${node.name}"`}
                        >
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                            <span>Editar</span>
                        </button>

                        {/* Botón añadir subcategoría hija */}
                        <button
                            type="button"
                            onClick={() => handleOpenAdd(node)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                            title={`Añadir subcategoría a ${node.name}`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Subcategoría</span>
                        </button>

                        {/* Botón eliminar */}
                        <button
                            type="button"
                            onClick={() => handleDelete(node)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Subcategorías anidadas recursivas */}
                {hasChildren && isExpanded && (
                    <div className="border-l border-border/80 ml-4">
                        {node.subcategories!.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="glass-card rounded-2xl p-6 border border-border/80 shadow-sm">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Personaliza los iconos, colores y jerarquía. Sincronización continua e instantánea con la app móvil.
                    </p>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={loadTree}
                        className="p-2 text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors border border-border/60"
                        title="Actualizar árbol"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenAdd(null)}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-xl shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Categoría Raíz</span>
                    </button>
                </div>
            </div>

            {/* Contenido del árbol */}
            <div className="mt-6">
                {loading && tree.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                        Cargando estructura jerárquica de categorías...
                    </div>
                ) : error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-medium">
                        {error}
                    </div>
                ) : tree.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
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
                    <div className="glass-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div>
                                <h3 className="text-lg font-sans font-bold text-foreground">
                                    {targetParent ? `Añadir Subcategoría a "${targetParent.name}"` : 'Nueva Categoría Raíz'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {targetParent ? 'Se añadirá como nodo hijo en la jerarquía' : 'Categoría principal'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-xl"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                    Nombre de la {targetParent ? 'Subcategoría' : 'Categoría'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={targetParent ? "Ej: Supermercados, Restaurantes, Gasolina..." : "Ej: Alimentación, Transporte, Ocio..."}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                        Color distintivo
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={newColor}
                                            onChange={(e) => setNewColor(e.target.value)}
                                            className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border-0"
                                        />
                                        <span className="text-xs font-mono text-muted-foreground uppercase">{newColor}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                        Tipo de flujo
                                    </label>
                                    <div className="flex bg-secondary/80 p-1 rounded-xl border border-border/60">
                                        <button
                                            type="button"
                                            onClick={() => setNewIsIncome(false)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                !newIsIncome ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Gasto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewIsIncome(true)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                newIsIncome ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Ingreso
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                                    Icono Temático
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-secondary/30 rounded-xl border border-border/60">
                                    {CATEGORY_ICONS_LIST.map(({ value, icon: IconComponent, label }) => {
                                        const isSelected = newIcon === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                title={label}
                                                onClick={() => setNewIcon(value)}
                                                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary text-primary-foreground shadow-sm scale-105' 
                                                        : 'bg-background/80 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60'
                                                }`}
                                            >
                                                <IconComponent className="w-5 h-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Seleccionado: <strong className="text-foreground">{CATEGORY_ICONS_LIST.find(i => i.value === newIcon)?.label}</strong>
                                </p>
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border/60 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newName.trim()}
                                    className="flex items-center space-x-2 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-xl shadow-sm"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{targetParent ? 'Crear Subcategoría' : 'Crear Categoría'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Editar Categoría Existente */}
            {isEditModalOpen && editingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div>
                                <h3 className="text-lg font-sans font-bold text-foreground">
                                    Editar Categoría "{editingCategory.name}"
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Personaliza el icono, color o nombre para la web y la app móvil.
                                </p>
                            </div>
                            <button 
                                onClick={() => { setIsEditModalOpen(false); setEditingCategory(null); }}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-xl"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                    Nombre de la Categoría
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                        Color distintivo
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                            className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border-0"
                                        />
                                        <span className="text-xs font-mono text-muted-foreground uppercase">{editColor}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                        Tipo de flujo
                                    </label>
                                    <div className="flex bg-secondary/80 p-1 rounded-xl border border-border/60">
                                        <button
                                            type="button"
                                            onClick={() => setEditIsIncome(false)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                !editIsIncome ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Gasto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditIsIncome(true)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                editIsIncome ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Ingreso
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                                    Icono Temático
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-secondary/30 rounded-xl border border-border/60">
                                    {CATEGORY_ICONS_LIST.map(({ value, icon: IconComponent, label }) => {
                                        const isSelected = editIcon === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                title={label}
                                                onClick={() => setEditIcon(value)}
                                                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary text-primary-foreground shadow-sm scale-105' 
                                                        : 'bg-background/80 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60'
                                                }`}
                                            >
                                                <IconComponent className="w-5 h-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Seleccionado: <strong className="text-foreground">{CATEGORY_ICONS_LIST.find(i => i.value === editIcon)?.label}</strong>
                                </p>
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border/60 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setIsEditModalOpen(false); setEditingCategory(null); }}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !editName.trim()}
                                    className="flex items-center space-x-2 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-xl shadow-sm"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Guardar Cambios</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
