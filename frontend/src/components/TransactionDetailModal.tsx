import React, { useState, useEffect, useRef } from 'react';
import {
    X, CreditCard, Tag, Calendar, Building2, Smartphone, FileText,
    Check, ChevronDown, ChevronRight, Layers, Calculator, Upload,
    ExternalLink, Eye, Unlink, Loader2, ShieldCheck, CheckCircle2
} from 'lucide-react';
import type { Category, DocumentItem } from '../services/api';
import {
    updateTransaction, getDocuments, uploadDocument, unlinkDocument
} from '../services/api';
import { CategoryBadge } from './CategoryBadge';

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
    const [isTaxDeductible, setIsTaxDeductible] = useState<boolean>(Boolean(transaction.is_tax_deductible));
    const [taxYear, setTaxYear] = useState<number | ''>(transaction.tax_year || '');
    const [saving, setSaving] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);

    // Documentos adjuntos
    const [attachedDocs, setAttachedDocs] = useState<DocumentItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadAttachedDocs = async () => {
        setLoadingDocs(true);
        try {
            const docs = await getDocuments({ transaction_id: transaction.id });
            setAttachedDocs(docs);
        } catch (err) {
            console.error('Error cargando documentos adjuntos:', err);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        if (transaction?.id) {
            loadAttachedDocs();
        }
    }, [transaction?.id]);

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

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            await updateTransaction(transaction.id, {
                category: selectedCategory === '' ? null as any : Number(selectedCategory),
                is_tax_deductible: isTaxDeductible,
                tax_year: taxYear === '' ? null : Number(taxYear)
            });
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            console.error('Error al actualizar la transacción:', err);
            alert('Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDoc(true);
        try {
            await uploadDocument(file, transaction.id);
            await loadAttachedDocs();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Error subiendo factura:', err);
            alert('Error al adjuntar la factura');
        } finally {
            setUploadingDoc(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUnlinkDoc = async (docId: number) => {
        if (!confirm('¿Deseas desvincular este documento de la transacción?')) return;
        try {
            await unlinkDocument(docId);
            await loadAttachedDocs();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Error desvinculando documento:', err);
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
            <div className="glass-card border border-border/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border/60 flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-3">
                        <CategoryBadge
                            categoryName={transaction.category_name}
                            parentCategoryName={transaction.parent_category_name}
                            categoryColor={transaction.category_color}
                            categoryIcon={transaction.category_icon}
                            categoryId={transaction.category}
                            categories={categories}
                            variant="icon-only"
                            size="lg"
                        />
                        <div>
                            <h2 className="text-xl font-sans font-bold text-foreground line-clamp-1">
                                {transaction.description}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                ID de Transacción: #{transaction.id} • {new Date(transaction.date).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Amount & Classification Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/40 border border-border/80">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Importe</span>
                            <div className={`text-3xl font-sans font-bold tabular-nums ${isIncome ? 'text-income' : 'text-foreground'}`}>
                                {isIncome ? '+' : '-'}{Math.abs(parseFloat(transaction.amount)).toFixed(2)} €
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Movimiento</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isIncome ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-primary/15 text-primary border border-primary/30'}`}>
                                {isIncome ? 'Ingreso' : 'Gasto'}
                            </span>
                        </div>
                    </div>

                    {/* Categorization Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Tag size={16} className="text-primary" />
                                Categoría y Clasificación
                            </label>
                            <CategoryBadge
                                categoryName={transaction.category_name}
                                parentCategoryName={transaction.parent_category_name}
                                categoryColor={transaction.category_color}
                                categoryIcon={transaction.category_icon}
                                categoryId={transaction.category}
                                categories={categories}
                                size="sm"
                            />
                        </div>
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
                                onClick={handleSaveChanges}
                                disabled={saving}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Check size={16} />
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                        {transaction.parent_category_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Layers size={14} className="text-muted-foreground" />
                                <span>Categoría principal: <strong className="text-foreground">{transaction.parent_category_name}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN FACTURA / GESTOR DOCUMENTAL */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <FileText size={16} className="text-primary" />
                                Justificante / Factura Adjunta
                            </h3>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingDoc}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-xl border border-primary/20 transition-all disabled:opacity-50"
                            >
                                {uploadingDoc ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                <span>Adjuntar Factura</span>
                            </button>
                        </div>

                        {loadingDocs ? (
                            <div className="py-4 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Buscando facturas adjuntas...</span>
                            </div>
                        ) : attachedDocs.length === 0 ? (
                            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/80 rounded-xl">
                                <span>Sin factura adjunta a este movimiento. Puedes adjuntar un PDF o escanear desde Gmail.</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attachedDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="p-3 bg-secondary/40 border border-border/80 rounded-xl flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <FileText size={18} className="text-primary flex-shrink-0" />
                                            <div className="min-w-0">
                                                <span className="font-bold text-xs text-foreground line-clamp-1">
                                                    {doc.file_name}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground block">
                                                    {doc.email_sender ? `De: ${doc.email_sender}` : 'Subida manual'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewDoc(doc)}
                                                className="p-1.5 bg-background hover:bg-secondary text-foreground rounded-lg text-xs font-medium flex items-center gap-1 border border-border"
                                                title="Ver documento"
                                            >
                                                <Eye size={13} />
                                                <span>Ver</span>
                                            </button>

                                            {doc.gmail_web_link && (
                                                <a
                                                    href={doc.gmail_web_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-background hover:bg-secondary text-foreground rounded-lg text-xs font-medium flex items-center gap-1 border border-border"
                                                    title="Abrir en Gmail"
                                                >
                                                    <ExternalLink size={13} />
                                                    <span>Gmail</span>
                                                </a>
                                            )}

                                            <button
                                                onClick={() => handleUnlinkDoc(doc.id)}
                                                className="p-1.5 hover:bg-destructive/15 text-destructive rounded-lg transition-all"
                                                title="Desvincular factura"
                                            >
                                                <Unlink size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN IRPF / DECLARACIÓN DE LA RENTA */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                            <Calculator size={16} className="text-primary" />
                            Ajustes Fiscales (IRPF)
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <label className="flex items-center gap-2.5 text-xs font-medium text-foreground cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isTaxDeductible}
                                    onChange={(e) => setIsTaxDeductible(e.target.checked)}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                                />
                                <span>Marcar como deducible en IRPF</span>
                            </label>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Ejercicio Fiscal:</span>
                                <input
                                    type="number"
                                    placeholder={String(new Date(transaction.date).getFullYear())}
                                    value={taxYear}
                                    onChange={(e) => setTaxYear(e.target.value ? Number(e.target.value) : '')}
                                    className="w-24 bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
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
                    <button
                        onClick={handleSaveChanges}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar y Cerrar'}
                    </button>
                </div>
            </div>

            {/* Modal Visor Embebido */}
            {previewDoc && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                    <div className="glass-card border border-border/80 w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                            <h3 className="font-bold text-foreground text-sm line-clamp-1">{previewDoc.file_name}</h3>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                                >
                                    <ExternalLink size={16} />
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-2 bg-muted/10 overflow-hidden flex items-center justify-center">
                            {previewDoc.mime_type.includes('image') ? (
                                <img src={previewDoc.url} alt={previewDoc.file_name} className="max-h-full max-w-full object-contain rounded-lg" />
                            ) : (
                                <iframe src={previewDoc.url} title={previewDoc.file_name} className="w-full h-full rounded-lg bg-white" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
