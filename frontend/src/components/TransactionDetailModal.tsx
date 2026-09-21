import React, { useState } from 'react';
import { X, CreditCard, Tag, Calendar, Building2, Smartphone, FileText, Check, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { Category } from '../services/api';
import { updateTransaction } from '../services/api';

interface TransactionDetailModalProps {
    transaction: any;
    categories: Category[];
    onClose: () => void;
    onUpdated?: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
    transaction,
    categories,
    onClose,
    onUpdated
}) => {
    const [selectedCategory, setSelectedCategory] = useState<number | ''>(transaction.category || '');
    const [saving, setSaving] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);

    if (!transaction) return null;

    const metadata = transaction.metadata || {};
    const rawData = transaction.raw_data || {};

    // Determine card / payment method
    const card = metadata.card || metadata.card_masked || metadata.card_last4 || null;
    const merchant = metadata.merchant || metadata.clean_merchant || transaction.description;
    const sourceApp = metadata.source || metadata.package || rawData.package || null;
    const originalDate = metadata.original_date || metadata.operation_time || null;
    const rawText = metadata.raw_text || rawData.raw_text || rawData.text || null;
    const rawTitle = metadata.raw_title || rawData.raw_title || rawData.title || null;

    const handleSaveCategory = async () => {
        setSaving(true);
        try {
            await updateTransaction(transaction.id, { 
                category: selectedCategory === '' ? null as any : Number(selectedCategory) 
            });
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            console.error('Error al actualizar la categoría:', err);
            alert('Error al actualizar la categoría');
        } finally {
            setSaving(false);
        }
    };

    const formatAppSource = (pkg: string | null) => {
        if (!pkg) return null;
        if (pkg.includes('wallet')) return 'Google Wallet';
        if (pkg.includes('bancosabadell') || pkg.includes('sabadell') || pkg.includes('inverline')) return 'Banco Sabadell';
        if (pkg.includes('bbva')) return 'BBVA';
        if (pkg.includes('santander')) return 'Banco Santander';
        if (pkg.includes('caixabank') || pkg.includes('imagin')) return 'CaixaBank / Imagin';
        if (pkg.includes('revolut')) return 'Revolut';
        if (pkg.includes('n26')) return 'N26';
        return pkg;
    };

    const isIncome = transaction.type === 'income';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-heading font-bold text-foreground line-clamp-1">
                                {transaction.description}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                ID de Transacción: #{transaction.id} • {new Date(transaction.date).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Amount & Classification Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Importe</span>
                            <div className={`text-3xl font-extrabold tabular-nums ${isIncome ? 'text-emerald-500' : 'text-foreground'}`}>
                                {isIncome ? '+' : '-'}{Math.abs(parseFloat(transaction.amount)).toFixed(2)} €
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Movimiento</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isIncome ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-primary/15 text-primary border border-primary/30'}`}>
                                {isIncome ? 'Ingreso' : 'Gasto'}
                            </span>
                        </div>
                    </div>

                    {/* Categorization Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Tag size={16} className="text-primary" />
                            Categoría y Clasificación
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                            >
                                <option value="">⚠️ Sin categoría asignada</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={handleSaveCategory}
                                disabled={saving}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Check size={16} />
                                {saving ? 'Guardando...' : 'Actualizar Categoría'}
                            </button>
                        </div>
                        {transaction.parent_category_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Layers size={14} className="text-muted-foreground" />
                                <span>Categoría principal: <strong className="text-foreground">{transaction.parent_category_name}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Notification & Bank Metadata Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                            <Smartphone size={16} className="text-primary" />
                            Metadatos de Notificación / Banco
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-muted-foreground block font-medium">Aplicación emisora:</span>
                                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                    <Building2 size={15} className="text-muted-foreground" />
                                    {formatAppSource(sourceApp) || 'Registro manual / Open Banking'}
                                </span>
                            </div>

                            {card && (
                                <div>
                                    <span className="text-xs text-muted-foreground block font-medium">Tarjeta utilizada:</span>
                                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                        <CreditCard size={15} className="text-muted-foreground" />
                                        {card}
                                    </span>
                                </div>
                            )}

                            {originalDate && (
                                <div>
                                    <span className="text-xs text-muted-foreground block font-medium">Hora de operación bancaria:</span>
                                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                        <Calendar size={15} className="text-muted-foreground" />
                                        {originalDate}
                                    </span>
                                </div>
                            )}

                            {merchant && merchant !== transaction.description && (
                                <div>
                                    <span className="text-xs text-muted-foreground block font-medium">Establecimiento extraído:</span>
                                    <span className="text-sm font-semibold text-foreground mt-0.5">
                                        {merchant}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Raw Notification text preview */}
                        {(rawText || rawTitle) && (
                            <div className="mt-3 pt-3 border-t border-border">
                                <span className="text-xs text-muted-foreground block font-medium mb-1.5 flex items-center gap-1">
                                    <FileText size={14} /> Texto original de la notificación recibida:
                                </span>
                                <div className="p-3 bg-muted/40 rounded-lg text-xs font-mono text-foreground/90 border border-border/80 break-words">
                                    {rawTitle && <div className="font-bold text-foreground mb-1">Título: {rawTitle}</div>}
                                    {rawText && <div>Cuerpo: {rawText}</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Toggle Raw JSON */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowRawJson(!showRawJson)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors"
                        >
                            {showRawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {showRawJson ? 'Ocultar JSON de metadatos' : 'Ver datos crudos completos (JSON)'}
                        </button>

                        {showRawJson && (
                            <pre className="mt-2 p-3 bg-slate-950 text-slate-200 text-xs rounded-xl overflow-x-auto border border-border/60 max-h-48 font-mono">
                                {JSON.stringify({ metadata: transaction.metadata, raw_data: transaction.raw_data }, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-foreground bg-accent hover:bg-accent/80 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

