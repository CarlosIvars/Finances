import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import {
    getDocuments, confirmDocumentMatch, rejectDocumentSuggestion,
    linkDocument, unlinkDocument, uploadDocument, deleteDocument,
    getGmailAuthUrl, getGmailStatus, syncGmail, disconnectGmail,
    getTransactions
} from '../services/api';
import type { DocumentItem, GmailStatusResponse } from '../services/api';
import {
    FileText, Mail, RefreshCw, Check, X, Link, Unlink, Trash2,
    Upload, Search, ExternalLink, Eye, AlertTriangle, ShieldCheck,
    Loader2, CheckCircle2, ArrowRight, Sparkles, FileCheck, Layers
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [gmailStatus, setGmailStatus] = useState<GmailStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncingGmail, setSyncingGmail] = useState(false);
    const [activeTab, setActiveTab] = useState<'suggestions' | 'all' | 'upload'>('all');

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modal visor
    const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

    // Modal vinculación manual
    const [linkingDoc, setLinkingDoc] = useState<DocumentItem | null>(null);
    const [availableTransactions, setAvailableTransactions] = useState<any[]>([]);
    const [txSearchTerm, setTxSearchTerm] = useState('');
    const [linkingLoading, setLinkingLoading] = useState(false);

    // Subida manual
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [docsData, statusData] = await Promise.all([
                getDocuments(),
                getGmailStatus()
            ]);
            setDocuments(docsData);
            setGmailStatus(statusData);

            // Si hay sugerencias pendientes, predeterminar esa pestaña
            const suggestionsCount = docsData.filter(d => d.status === 'suggested').length;
            if (suggestionsCount > 0 && activeTab === 'all') {
                setActiveTab('suggestions');
            }
        } catch (err) {
            console.error('Error cargando documentos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleConnectGmail = async () => {
        try {
            const authUrl = await getGmailAuthUrl();
            window.location.href = authUrl;
        } catch (err) {
            console.error('Error obteniendo URL de Gmail:', err);
            alert('Error al iniciar conexión con Gmail. Verifica las credenciales en el backend.');
        }
    };

    const handleSyncGmail = async () => {
        setSyncingGmail(true);
        try {
            const res = await syncGmail();
            alert(`Sincronización completada. Se han procesado ${res.synced_count} facturas/adjuntos.`);
            await loadData();
        } catch (err) {
            console.error('Error sincronizando Gmail:', err);
            alert('Error al sincronizar con Gmail');
        } finally {
            setSyncingGmail(false);
        }
    };

    const handleDisconnectGmail = async () => {
        if (!confirm('¿Deseas desconectar tu cuenta de Gmail?')) return;
        try {
            await disconnectGmail();
            await loadData();
        } catch (err) {
            console.error('Error desconectando Gmail:', err);
        }
    };

    const handleConfirmMatch = async (docId: number) => {
        try {
            await confirmDocumentMatch(docId);
            setDocuments(documents.map(d => d.id === docId ? { ...d, status: 'confirmed' } : d));
            await loadData();
        } catch (err) {
            console.error('Error confirmando sugerencia:', err);
        }
    };

    const handleRejectSuggestion = async (docId: number) => {
        try {
            await rejectDocumentSuggestion(docId);
            setDocuments(documents.map(d => d.id === docId ? { ...d, status: 'unmatched', suggested_transaction: null } : d));
            await loadData();
        } catch (err) {
            console.error('Error rechazando sugerencia:', err);
        }
    };

    const handleUnlink = async (docId: number) => {
        if (!confirm('¿Deseas desvincular esta factura de la transacción?')) return;
        try {
            await unlinkDocument(docId);
            await loadData();
        } catch (err) {
            console.error('Error desvinculando documento:', err);
        }
    };

    const handleDeleteDoc = async (docId: number) => {
        if (!confirm('¿Deseas eliminar permanentemente este documento?')) return;
        try {
            await deleteDocument(docId);
            setDocuments(documents.filter(d => d.id !== docId));
        } catch (err) {
            console.error('Error eliminando documento:', err);
        }
    };

    const openLinkModal = async (doc: DocumentItem) => {
        setLinkingDoc(doc);
        setLinkingLoading(true);
        try {
            const txs = await getTransactions();
            setAvailableTransactions(txs);
        } catch (err) {
            console.error('Error cargando transacciones:', err);
        } finally {
            setLinkingLoading(false);
        }
    };

    const handleLinkTransaction = async (txId: number) => {
        if (!linkingDoc) return;
        try {
            await linkDocument(linkingDoc.id, txId);
            setLinkingDoc(null);
            await loadData();
        } catch (err) {
            console.error('Error vinculando documento a transacción:', err);
            alert('Error al vincular el documento');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadSuccess(false);
        try {
            await uploadDocument(file);
            setUploadSuccess(true);
            await loadData();
            setTimeout(() => setUploadSuccess(false), 4000);
        } catch (err) {
            console.error('Error subiendo archivo:', err);
            alert('Error al subir el archivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const pendingSuggestions = documents.filter(d => d.status === 'suggested');

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.email_subject && doc.email_subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (doc.email_sender && doc.email_sender.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (doc.transaction_description && doc.transaction_description.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === 'matched') {
            return doc.status === 'auto_matched' || doc.status === 'confirmed';
        } else if (statusFilter === 'unmatched') {
            return doc.status === 'unmatched';
        } else if (statusFilter === 'suggested') {
            return doc.status === 'suggested';
        }
        return true;
    });

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-border/60">
                <div>
                    <h1 className="text-3xl font-sans font-bold text-foreground tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
                            <FileText size={26} />
                        </div>
                        Facturas y Gestor Documental
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Integración con Gmail, almacenamiento seguro de facturas y vinculación automática con movimientos bancarios.
                    </p>
                </div>
            </div>

            {/* Banner de Conexión con Gmail */}
            <div className="glass-card border border-border/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
                            gmailStatus?.is_connected
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                : 'bg-primary/10 border-primary/20 text-primary'
                        }`}>
                            <Mail size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-foreground">
                                    {gmailStatus?.is_connected ? 'Gmail Conectado' : 'Conectar Cuenta de Gmail'}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    gmailStatus?.is_connected
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    {gmailStatus?.is_connected ? 'Activo' : 'Sin conectar'}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {gmailStatus?.is_connected
                                    ? `Cuenta: ${gmailStatus.email} • Último escaneo: ${gmailStatus.last_sync_at ? new Date(gmailStatus.last_sync_at).toLocaleString('es-ES') : 'Nunca'}`
                                    : 'Permite a FinancIAs escanear tus correos para descargar adjuntos PDF/imágenes y vincular facturas automáticamente.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                        {gmailStatus?.is_connected ? (
                            <>
                                <button
                                    onClick={handleSyncGmail}
                                    disabled={syncingGmail}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                                >
                                    <RefreshCw size={15} className={syncingGmail ? 'animate-spin' : ''} />
                                    <span>{syncingGmail ? 'Escaneando Gmail...' : 'Buscar Facturas en Gmail'}</span>
                                </button>
                                <button
                                    onClick={handleDisconnectGmail}
                                    className="px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-medium rounded-xl transition-all border border-destructive/20"
                                >
                                    Desconectar
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConnectGmail}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md"
                            >
                                <Mail size={16} />
                                <span>Conectar con Google Gmail</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div className="flex border-b border-border/80 gap-2">
                <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'suggestions'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Sparkles size={16} />
                    <span>Sugerencias Pendientes</span>
                    {pendingSuggestions.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                            {pendingSuggestions.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'all'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Layers size={16} />
                    <span>Todas las Facturas ({documents.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('upload')}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'upload'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Upload size={16} />
                    <span>Subir Manualmente</span>
                </button>
            </div>

            {/* Contenido según pestaña */}
            {loading ? (
                <div className="h-64 flex items-center justify-center text-primary">
                    <Loader2 className="animate-spin w-10 h-10" />
                </div>
            ) : (
                <>
                    {/* PESTAÑA 1: Sugerencias Pendientes */}
                    {activeTab === 'suggestions' && (
                        <div className="space-y-4">
                            {pendingSuggestions.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                                    <CheckCircle2 size={40} className="mx-auto text-emerald-500/80 mb-3" />
                                    <h3 className="text-base font-bold text-foreground">¡Todo al día!</h3>
                                    <p className="text-sm mt-1">No hay sugerencias de facturas pendientes de confirmar.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {pendingSuggestions.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="glass-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                {/* Documento */}
                                                <div className="flex items-start gap-3 flex-1">
                                                    <div className="p-3 bg-primary/10 text-primary rounded-xl flex-shrink-0">
                                                        <FileText size={22} />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-sm text-foreground block">
                                                            {doc.file_name}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {doc.email_subject || 'Sin asunto'} • De: {doc.email_sender || 'Desconocido'}
                                                        </p>
                                                        {doc.amount_hint && (
                                                            <span className="inline-block mt-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                                                Importe detectado: {doc.amount_hint} €
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <ArrowRight size={20} className="hidden md:block text-muted-foreground flex-shrink-0" />

                                                {/* Transacción sugerida */}
                                                <div className="flex-1 p-3 bg-secondary/60 rounded-xl border border-border/60">
                                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                                        Transacción Propuesta
                                                    </span>
                                                    <span className="font-bold text-sm text-foreground block mt-0.5">
                                                        {doc.suggested_transaction_description || 'Movimiento bancario'}
                                                    </span>
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                                        <span>{doc.suggested_transaction_date}</span>
                                                        <span className="font-bold text-foreground">
                                                            {doc.suggested_transaction_amount} €
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Botones de acción */}
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="p-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl transition-all"
                                                        title="Ver documento"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleConfirmMatch(doc.id)}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition-all shadow-sm"
                                                    >
                                                        <Check size={14} />
                                                        <span>Confirmar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectSuggestion(doc.id)}
                                                        className="p-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl transition-all"
                                                        title="Descartar sugerencia"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PESTAÑA 2: Todas las facturas */}
                    {activeTab === 'all' && (
                        <div className="space-y-4">
                            {/* Filtros */}
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="relative flex-1 min-w-[240px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por archivo, emisor, concepto o transacción..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="bg-card border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer"
                                    >
                                        <option value="all">Todos los estados</option>
                                        <option value="matched">Vinculadas</option>
                                        <option value="suggested">Sugerencias</option>
                                        <option value="unmatched">Sin vincular</option>
                                    </select>
                                </div>
                            </div>

                            {/* Listado de Documentos */}
                            {filteredDocs.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                                    <FileText size={40} className="mx-auto text-muted-foreground/60 mb-2" />
                                    <p className="text-sm">No se encontraron facturas o documentos con los filtros seleccionados.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocs.map((doc) => {
                                        const isMatched = doc.status === 'auto_matched' || doc.status === 'confirmed';
                                        return (
                                            <div
                                                key={doc.id}
                                                className="glass-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-3 flex flex-col justify-between hover:border-primary/50 transition-all"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="p-2 bg-primary/10 text-primary rounded-xl flex-shrink-0">
                                                                <FileText size={18} />
                                                            </div>
                                                            <span className="font-bold text-sm text-foreground line-clamp-1 break-all" title={doc.file_name}>
                                                                {doc.file_name}
                                                            </span>
                                                        </div>

                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                                                            isMatched
                                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                                : doc.status === 'suggested'
                                                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                                : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {isMatched ? 'Vinculado' : doc.status === 'suggested' ? 'Sugerencia' : 'Sin vincular'}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {doc.email_subject || 'Documento sin asunto registrado'}
                                                    </p>

                                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                                                        <span>{formatBytes(doc.file_size)}</span>
                                                        <span>{doc.email_date ? new Date(doc.email_date).toLocaleDateString('es-ES') : new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
                                                    </div>

                                                    {/* Transacción Vinculada */}
                                                    {doc.transaction ? (
                                                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-0.5">
                                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                                                Vinculado a:
                                                            </span>
                                                            <span className="font-bold text-foreground line-clamp-1 block">
                                                                {doc.transaction_description}
                                                            </span>
                                                            <span className="text-muted-foreground block text-[11px]">
                                                                {doc.transaction_date} • {doc.transaction_amount} €
                                                            </span>
                                                        </div>
                                                    ) : doc.suggested_transaction ? (
                                                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-0.5">
                                                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                                                                Sugerencia:
                                                            </span>
                                                            <span className="font-bold text-foreground line-clamp-1 block">
                                                                {doc.suggested_transaction_description}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {/* Botones de acción */}
                                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => setPreviewDoc(doc)}
                                                            className="p-1.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium flex items-center gap-1"
                                                            title="Ver documento"
                                                        >
                                                            <Eye size={14} />
                                                            <span>Ver</span>
                                                        </button>

                                                        {doc.gmail_web_link && (
                                                            <a
                                                                href={doc.gmail_web_link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium flex items-center gap-1"
                                                                title="Abrir correo original en Gmail"
                                                            >
                                                                <ExternalLink size={14} />
                                                                <span>Gmail</span>
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {doc.transaction ? (
                                                            <button
                                                                onClick={() => handleUnlink(doc.id)}
                                                                className="p-1.5 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-lg transition-all"
                                                                title="Desvincular factura"
                                                            >
                                                                <Unlink size={14} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => openLinkModal(doc)}
                                                                className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium flex items-center gap-1"
                                                                title="Vincular a movimiento"
                                                            >
                                                                <Link size={14} />
                                                                <span>Vincular</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleDeleteDoc(doc.id)}
                                                            className="p-1.5 hover:bg-destructive/15 text-destructive rounded-lg transition-all"
                                                            title="Eliminar archivo"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PESTAÑA 3: Subida manual */}
                    {activeTab === 'upload' && (
                        <Card title="Subida Manual de Facturas y Recibos">
                            <div className="max-w-xl mx-auto space-y-6 text-center py-8">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-border hover:border-primary rounded-2xl p-10 cursor-pointer transition-all bg-card hover:bg-muted/20 space-y-3"
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        className="hidden"
                                    />
                                    <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                                        {uploading ? <Loader2 size={30} className="animate-spin" /> : <Upload size={30} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground text-base">
                                            {uploading ? 'Subiendo archivo...' : 'Haz clic para seleccionar o arrastra una factura'}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Formatos admitidos: PDF, PNG, JPG, JPEG (Máx 25 MB)
                                        </p>
                                    </div>
                                </div>

                                {uploadSuccess && (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center justify-center gap-2">
                                        <CheckCircle2 size={18} />
                                        <span>Factura subida y procesada correctamente.</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* Modal Visor de Documento */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="glass-card border border-border/80 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <FileText size={20} className="text-primary flex-shrink-0" />
                                <h3 className="font-bold text-foreground text-sm line-clamp-1">
                                    {previewDoc.file_name}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                                    title="Abrir en pestaña nueva"
                                >
                                    <ExternalLink size={18} />
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-2 bg-muted/10 overflow-hidden flex items-center justify-center">
                            {previewDoc.mime_type.includes('image') ? (
                                <img
                                    src={previewDoc.url}
                                    alt={previewDoc.file_name}
                                    className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                                />
                            ) : (
                                <iframe
                                    src={previewDoc.url}
                                    title={previewDoc.file_name}
                                    className="w-full h-full rounded-lg border border-border bg-white"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Vincular a Transacción */}
            {linkingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card border border-border/80 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Vincular Factura a Movimiento</h3>
                                <p className="text-xs text-muted-foreground line-clamp-1">{linkingDoc.file_name}</p>
                            </div>
                            <button onClick={() => setLinkingDoc(null)} className="text-muted-foreground hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                            <input
                                type="text"
                                placeholder="Filtrar movimientos..."
                                value={txSearchTerm}
                                onChange={(e) => setTxSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-border/40">
                            {linkingLoading ? (
                                <div className="py-8 text-center text-primary">
                                    <Loader2 className="animate-spin w-8 h-8 mx-auto" />
                                </div>
                            ) : (
                                availableTransactions
                                    .filter(t => t.description.toLowerCase().includes(txSearchTerm.toLowerCase()))
                                    .slice(0, 50)
                                    .map((tx) => (
                                        <div
                                            key={tx.id}
                                            onClick={() => handleLinkTransaction(tx.id)}
                                            className="p-3 hover:bg-secondary/60 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3"
                                        >
                                            <div>
                                                <span className="font-bold text-sm text-foreground block">{tx.description}</span>
                                                <span className="text-xs text-muted-foreground">{tx.date} • {tx.category_name || 'Sin categoría'}</span>
                                            </div>
                                            <span className="font-sans font-bold text-sm tabular-nums text-foreground">
                                                {tx.amount} €
                                            </span>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

