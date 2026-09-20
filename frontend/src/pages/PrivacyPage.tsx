import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Shield, Download, Trash2, ToggleLeft, ToggleRight,
    AlertTriangle, CheckCircle, Loader2, Info
} from 'lucide-react';
import {
    getUserConsents, updateUserConsents, exportUserData,
    deleteUserAccount, getProfilingInfo,
    type ConsentResponse
} from '../services/api';

interface PrivacyPageProps {
    onLogout?: () => void;
}

export function PrivacyPage({ onLogout }: PrivacyPageProps) {
    const [consentData, setConsentData] = useState<ConsentResponse | null>(null);
    const [consents, setConsents] = useState<Record<string, boolean>>({});
    const [profilingInfo, setProfilingInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteText, setDeleteText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [consentRes, profilingRes] = await Promise.all([
                getUserConsents(),
                getProfilingInfo(),
            ]);
            setConsentData(consentRes);
            setConsents(consentRes.consents);
            setProfilingInfo(profilingRes.automated_processing);
        } catch (err) {
            console.error('Error loading privacy data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleConsent = (key: string) => {
        setConsents(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveConsents = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await updateUserConsents(consents);
            setMessage({ type: 'success', text: 'Preferencias de privacidad actualizadas.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al guardar preferencias.' });
        } finally {
            setSaving(false);
        }
    };

    const handleExportData = async () => {
        setExporting(true);
        setMessage(null);
        try {
            const data = await exportUserData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mis-datos-financias-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setMessage({ type: 'success', text: 'Datos exportados correctamente.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al exportar datos.' });
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteText !== 'ELIMINAR') return;
        setDeleting(true);
        try {
            await deleteUserAccount();
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            if (onLogout) onLogout();
            window.location.reload();
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al eliminar la cuenta.' });
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-blue-500">
                <Loader2 className="animate-spin w-10 h-10" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="text-blue-400" size={28} />
                <div>
                    <h1 className="text-2xl font-bold text-white">Privacidad y Datos</h1>
                    <p className="text-slate-400 text-sm">
                        Gestiona tus consentimientos, exporta tus datos o elimina tu cuenta (RGPD)
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {message.text}
                </div>
            )}

            {/* Consent Management */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <ToggleRight className="text-blue-400" size={20} />
                    <h2 className="text-lg font-semibold text-white">Consentimientos</h2>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                    Controla qué procesamiento de datos permites. Las funcionalidades esenciales
                    (almacenamiento y clasificación) son necesarias para usar la app.
                </p>

                <div className="space-y-4">
                    {/* Essential - always on */}
                    <div className="flex items-start justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-white">Funcionalidades esenciales</span>
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Obligatorio</span>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">
                                Almacenamiento y clasificación de transacciones. Necesario para el funcionamiento de la app.
                            </p>
                        </div>
                        <button disabled className="mt-1">
                            <ToggleRight size={28} className="text-blue-500 opacity-50" />
                        </button>
                    </div>

                    {/* Dynamic consent types */}
                    {consentData?.available_types.map(type => (
                        <div key={type.key} className="flex items-start justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                            <div className="flex-1 mr-4">
                                <span className="font-medium text-white">{type.label}</span>
                                <p className="text-slate-400 text-sm mt-1">{type.description}</p>
                            </div>
                            <button onClick={() => handleToggleConsent(type.key)} className="mt-1">
                                {consents[type.key]
                                    ? <ToggleRight size={28} className="text-blue-500" />
                                    : <ToggleLeft size={28} className="text-slate-500" />
                                }
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex justify-end">
                    <Button onClick={handleSaveConsents} loading={saving}>
                        Guardar preferencias
                    </Button>
                </div>
            </Card>

            {/* Profiling Info (Art. 22) */}
            {profilingInfo && (
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="text-blue-400" size={20} />
                        <h2 className="text-lg font-semibold text-white">Procesamiento automatizado</h2>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{profilingInfo.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <h3 className="text-sm font-medium text-emerald-400 mb-2">✅ Datos utilizados</h3>
                            <ul className="text-slate-400 text-sm space-y-1">
                                {profilingInfo.data_used.map((d: string, i: number) => (
                                    <li key={i}>• {d}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                            <h3 className="text-sm font-medium text-red-400 mb-2">🚫 Datos NO utilizados</h3>
                            <ul className="text-slate-400 text-sm space-y-1">
                                {profilingInfo.data_NOT_used.map((d: string, i: number) => (
                                    <li key={i}>• {d}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <p className="text-slate-500 text-xs mt-3 italic">
                        {profilingInfo.impact}
                    </p>
                </Card>
            )}

            {/* Data Export (Art. 15 + Art. 20) */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <Download className="text-blue-400" size={20} />
                    <h2 className="text-lg font-semibold text-white">Exportar mis datos</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                    Descarga una copia completa de todos tus datos personales en formato JSON.
                    Incluye transacciones, categorías, presupuestos y consentimientos.
                </p>
                <Button onClick={handleExportData} loading={exporting} variant="secondary">
                    <Download size={16} />
                    Descargar mis datos
                </Button>
            </Card>

            {/* Account Deletion (Art. 17) */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <Trash2 className="text-red-400" size={20} />
                    <h2 className="text-lg font-semibold text-white">Eliminar mi cuenta</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                    Esto eliminará permanentemente tu cuenta y <strong className="text-red-400">todos tus datos</strong>:
                    transacciones, categorías, presupuestos, archivos subidos e insights generados.
                    Esta acción no se puede deshacer.
                </p>

                {!showDeleteConfirm ? (
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    >
                        <Trash2 size={16} />
                        Quiero eliminar mi cuenta
                    </Button>
                ) : (
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-red-400 font-medium">
                            <AlertTriangle size={16} />
                            ¿Estás seguro? Escribe ELIMINAR para confirmar
                        </div>
                        <input
                            type="text"
                            value={deleteText}
                            onChange={(e) => setDeleteText(e.target.value)}
                            placeholder="Escribe ELIMINAR"
                            className="w-full px-4 py-2 bg-slate-800/50 border border-red-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                        />
                        <div className="flex gap-3">
                            <Button
                                onClick={handleDeleteAccount}
                                loading={deleting}
                                disabled={deleteText !== 'ELIMINAR'}
                                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-30"
                            >
                                Confirmar eliminación
                            </Button>
                            <Button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteText(''); }}
                                variant="secondary"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Legal notice */}
            <div className="text-center text-slate-500 text-xs py-4 space-y-1">
                <p>Tus derechos RGPD: acceso, rectificación, supresión, portabilidad y oposición.</p>
                <p>Para ejercer cualquier derecho, contacta: <span className="text-slate-400">privacidad@financias.app</span></p>
            </div>
        </div>
    );
}
