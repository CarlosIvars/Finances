import React, { useState, useEffect } from 'react';
import {
    Landmark,
    Plus,
    RefreshCw,
    Trash2,
    ShieldCheck,
    Lock,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Building2,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    getBankInstitutions,
    getBankConnections,
    connectBank,
    disconnectBank,
    syncBankConnection,
    type BankInstitution,
    type BankConnectionItem,
    type BankAccountItem,
} from '../services/api';

export function BankingPage() {
    const [institutions, setInstitutions] = useState<BankInstitution[]>([]);
    const [connections, setConnections] = useState<BankConnectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [syncingId, setSyncingId] = useState<number | null>(null);
    const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedInstitution, setSelectedInstitution] = useState<BankInstitution | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [expandedAccount, setExpandedAccount] = useState<number | null>(null);

    // Cargar instituciones y conexiones
    const loadData = async () => {
        try {
            setLoading(true);
            const [instList, connList] = await Promise.all([
                getBankInstitutions(),
                getBankConnections(),
            ]);
            setInstitutions(instList);
            setConnections(connList);
        } catch (err: any) {
            console.error('Error cargando datos bancarios:', err);
            setMessage({ type: 'error', text: 'No se pudieron cargar las conexiones bancarias.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Verificar si volvemos de un callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('status') === 'success') {
            setMessage({ type: 'success', text: '¡Cuenta bancaria conectada y sincronizada correctamente!' });
            // Limpiar la URL sin recargar
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleConnect = async (institution: BankInstitution) => {
        try {
            setConnecting(true);
            setSelectedInstitution(institution);
            const callbackUrl = window.location.origin + '/api/banking/callback/';
            const result = await connectBank(institution.id, callbackUrl);

            // En modo Mock o Sandbox, si se recibe authorization_url:
            if (result.authorization_url) {
                // En el MockProvider simulamos la autorización llamando al callback directamente
                // o redirigiendo según corresponda
                if (result.provider_connection_id && result.authorization_url.includes('mock-bank.local')) {
                    // Simular retorno exitoso del banco de forma inmediata
                    window.location.href = `/api/banking/callback/?state=${result.provider_connection_id}&status=success`;
                } else {
                    window.location.href = result.authorization_url;
                }
            } else {
                setMessage({ type: 'success', text: 'Solicitud de conexión enviada.' });
                setShowModal(false);
                loadData();
            }
        } catch (err: any) {
            console.error('Error iniciando conexión bancaria:', err);
            setMessage({ type: 'error', text: err.response?.data?.error || 'Error al conectar con la entidad bancaria.' });
            setConnecting(false);
        }
    };

    const handleSync = async (connectionId: number) => {
        try {
            setSyncingId(connectionId);
            await syncBankConnection(connectionId);
            setMessage({ type: 'success', text: 'Movimientos actualizados con éxito.' });
            await loadData();
        } catch (err: any) {
            console.error('Error sincronizando banco:', err);
            setMessage({ type: 'error', text: 'No se pudo sincronizar la cuenta bancaria.' });
        } finally {
            setSyncingId(null);
        }
    };

    const handleDisconnect = async (connectionId: number) => {
        if (!window.confirm('¿Seguro que deseas desconectar esta entidad bancaria? No se borrarán los movimientos ya guardados.')) {
            return;
        }
        try {
            setDisconnectingId(connectionId);
            await disconnectBank(connectionId);
            setMessage({ type: 'success', text: 'Entidad bancaria desconectada y consentimiento revocado.' });
            await loadData();
        } catch (err: any) {
            console.error('Error desconectando banco:', err);
            setMessage({ type: 'error', text: 'Error al revocar la conexión bancaria.' });
        } finally {
            setDisconnectingId(null);
        }
    };

    const formatCurrency = (amount: string | number, currency: string = 'EUR') => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: currency || 'EUR',
        }).format(num);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2.5 text-foreground tracking-tight">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Landmark className="text-primary w-6 h-6" />
                        </div>
                        Open Banking & Cuentas Bancarias
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Conecta tus entidades financieras de forma oficial, segura y automatizada.
                    </p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 shadow-sm font-semibold"
                >
                    <Plus size={18} />
                    Añadir banco
                </Button>
            </div>

            {/* Banner de Seguridad Garantizada */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-emerald-900 dark:text-emerald-300">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0 mt-0.5 md:mt-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-xs sm:text-sm space-y-0.5">
                        <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                            Tus credenciales están 100% protegidas bajo normativa europea PSD2
                        </p>
                        <p className="text-emerald-800 dark:text-emerald-400">
                            Nunca te pediremos contraseñas bancarias ni PINs. La autorización se realiza directamente en la web de tu banco con acceso de sólo lectura y cifrado AES-256.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    <Lock size={13} />
                    Sólo Lectura (AIS)
                </div>
            </div>

            {/* Mensajes de estado */}
            {message && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm ${
                        message.type === 'success'
                            ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 border border-emerald-500/30'
                            : 'bg-destructive/15 text-destructive border border-destructive/30'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {message.type === 'success' ? (
                            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        ) : (
                            <AlertCircle size={18} className="text-destructive shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                    <button
                        onClick={() => setMessage(null)}
                        className="text-xs font-bold hover:underline opacity-80"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Conexiones existentes */}
            {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                    Cargando conexiones bancarias...
                </div>
            ) : connections.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                        No tienes ninguna cuenta bancaria conectada
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                        Conecta Banco Sabadell u otra entidad bancaria para importar tus cuentas y transacciones de forma automática.
                    </p>
                    <Button onClick={() => setShowModal(true)} className="gap-2">
                        <Plus size={18} />
                        Conectar primera cuenta
                    </Button>
                </Card>
            ) : (
                <div className="space-y-6">
                    {connections.map((conn) => (
                        <Card key={conn.id} className="overflow-hidden border border-border shadow-sm">
                            {/* Cabecera de la entidad */}
                            <div className="p-5 bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                                        <Landmark className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-foreground">
                                                {conn.institution_name}
                                            </h2>
                                            <span
                                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                                    conn.status === 'active'
                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                }`}
                                            >
                                                {conn.status === 'active' ? 'Conectado' : conn.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {conn.last_synced_at
                                                ? `Última sincronización: ${new Date(conn.last_synced_at).toLocaleString('es-ES')}`
                                                : 'Pendiente de sincronizar'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleSync(conn.id)}
                                        disabled={syncingId === conn.id}
                                        className="gap-1.5 text-xs"
                                    >
                                        <RefreshCw size={14} className={syncingId === conn.id ? 'animate-spin' : ''} />
                                        {syncingId === conn.id ? 'Sincronizando...' : 'Sincronizar'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleDisconnect(conn.id)}
                                        disabled={disconnectingId === conn.id}
                                        className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 size={14} />
                                        Desconectar
                                    </Button>
                                </div>
                            </div>

                            {/* Cuentas de esta conexión */}
                            <div className="p-5 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Cuentas asociadas ({(conn.accounts || []).length})
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(conn.accounts || []).map((account) => {
                                        const isExpanded = expandedAccount === account.id;
                                        const txList = account.recent_transactions || [];
                                        return (
                                            <div
                                                key={account.id}
                                                className="bg-accent/40 rounded-xl p-4 border border-border/80 flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div>
                                                            <h4 className="font-semibold text-sm text-foreground">
                                                                {account.name}
                                                            </h4>
                                                            <p className="text-xs text-muted-foreground font-mono">
                                                                {account.iban || account.external_account_id}
                                                            </p>
                                                        </div>
                                                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-background rounded border border-border text-muted-foreground">
                                                            {account.account_type || 'Cuenta'}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 mb-2">
                                                        <div className="text-xs text-muted-foreground">Saldo disponible</div>
                                                        <div
                                                            className={`text-xl font-bold font-mono ${
                                                                parseFloat(account.balance || '0') >= 0
                                                                    ? 'text-foreground'
                                                                    : 'text-destructive'
                                                            }`}
                                                        >
                                                            {formatCurrency(account.balance || '0', account.currency)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setExpandedAccount(isExpanded ? null : account.id)}
                                                    className="mt-3 pt-3 border-t border-border/60 text-xs font-semibold text-primary flex items-center justify-between w-full hover:underline"
                                                >
                                                    <span>
                                                        {isExpanded ? 'Ocultar movimientos' : 'Ver movimientos recientes'}
                                                    </span>
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>

                                                {/* Desplegable de movimientos */}
                                                {isExpanded && (
                                                    <div className="mt-3 pt-3 border-t border-border space-y-2 max-h-64 overflow-y-auto pr-1">
                                                        {txList.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic py-2">
                                                                Sin movimientos recientes registrados.
                                                            </p>
                                                        ) : (
                                                            txList.map((tx) => {
                                                                const isPositive = parseFloat(tx.amount || '0') > 0;
                                                                return (
                                                                    <div
                                                                        key={tx.id}
                                                                        className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/40 last:border-0"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="font-medium text-foreground truncate">
                                                                                {tx.description}
                                                                            </p>
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                {formatDate(tx.booking_date)}
                                                                                {tx.merchant_name && ` • ${tx.merchant_name}`}
                                                                            </p>
                                                                        </div>
                                                                        <div
                                                                            className={`font-mono font-semibold shrink-0 flex items-center gap-0.5 ${
                                                                                isPositive ? 'text-emerald-600' : 'text-foreground'
                                                                            }`}
                                                                        >
                                                                            {isPositive ? (
                                                                                <ArrowUpRight size={12} />
                                                                            ) : (
                                                                                <ArrowDownRight size={12} className="text-muted-foreground" />
                                                                            )}
                                                                            {formatCurrency(tx.amount || '0', tx.currency)}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal: Seleccionar entidad bancaria */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-5 p-6">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Conectar cuenta bancaria</h3>
                                <p className="text-xs text-muted-foreground">
                                    Selecciona tu entidad para iniciar la autorización segura
                                </p>
                            </div>
                            <button
                                onClick={() => !connecting && setShowModal(false)}
                                disabled={connecting}
                                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-accent"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Lista de bancos */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                            {institutions.map((inst) => (
                                <button
                                    key={inst.id}
                                    onClick={() => handleConnect(inst)}
                                    disabled={connecting}
                                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-center flex flex-col items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center font-bold text-primary group-hover:scale-105 transition-transform">
                                        <Landmark className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {inst.name}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {connecting && (
                            <div className="flex items-center justify-center gap-2 py-2 text-sm text-primary font-medium animate-pulse">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Redirigiendo a {selectedInstitution?.name || 'la entidad'}...
                            </div>
                        )}

                        <div className="bg-muted/50 rounded-xl p-3.5 border border-border/80 text-[11px] text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                Proceso oficial regulado (PSD2)
                            </p>
                            <p>
                                Serás redirigido a la pasarela bancaria oficial. Solo autorizarás lectura de cuentas y saldos.
                            </p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowModal(false)}
                                disabled={connecting}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

