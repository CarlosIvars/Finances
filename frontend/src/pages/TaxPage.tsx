import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import {
    getTaxSummary, getTaxPresets, createTaxPreset, deleteTaxPreset,
    exportTaxReport, updateTransaction
} from '../services/api';
import type { TaxSummaryResponse, TaxPreset } from '../services/api';
import {
    Calculator, FileSpreadsheet, Download, Heart, Home, Briefcase,
    ShieldCheck, AlertCircle, CheckCircle2, Plus, Trash2, ExternalLink,
    FileText, Tag, Loader2, RefreshCw, X, Eye
} from 'lucide-react';

export const TaxPage: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        const now = new Date();
        return now.getMonth() < 6 ? currentYear - 1 : currentYear;
    });

    const [summary, setSummary] = useState<TaxSummaryResponse | null>(null);
    const [presets, setPresets] = useState<TaxPreset[]>([]);
    const [activePreset, setActivePreset] = useState<TaxPreset | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Modal nuevo preset
    const [showNewPresetModal, setShowNewPresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetAeatBox, setNewPresetAeatBox] = useState('');

    // Modal visor documento
    const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
    const [previewDocTitle, setPreviewDocTitle] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryData, presetsData] = await Promise.all([
                getTaxSummary(selectedYear),
                getTaxPresets()
            ]);
            setSummary(summaryData);
            setPresets(presetsData);
        } catch (err) {
            console.error('Error cargando datos fiscales:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await exportTaxReport(selectedYear, 'xlsx');
        } catch (err) {
            console.error('Error exportando Excel:', err);
            alert('Error al generar el archivo Excel');
        } finally {
            setExporting(false);
        }
    };

    const handleExportCsv = async () => {
        try {
            await exportTaxReport(selectedYear, 'csv');
        } catch (err) {
            console.error('Error exportando CSV:', err);
            alert('Error al exportar CSV');
        }
    };

    const handleCreatePreset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPresetName.trim()) return;

        try {
            await createTaxPreset({
                name: newPresetName,
                aeat_box: newPresetAeatBox,
                filters: { is_tax_deductible: true }
            });
            setShowNewPresetModal(false);
            setNewPresetName('');
            setNewPresetAeatBox('');
            const updated = await getTaxPresets();
            setPresets(updated);
        } catch (err) {
            console.error('Error creando preset:', err);
            alert('Error al guardar el preset');
        }
    };

    const handleDeletePreset = async (presetId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('¿Deseas eliminar este preset personalizado?')) return;
        try {
            await deleteTaxPreset(presetId);
            setPresets(presets.filter(p => p.id !== presetId));
            if (activePreset?.id === presetId) setActivePreset(null);
        } catch (err) {
            console.error('Error eliminando preset:', err);
        }
    };

    const metrics = summary?.metrics;
    const coverage = metrics?.document_coverage_percentage ?? 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-border/60">
                <div>
                    <h1 className="text-3xl font-sans font-bold text-foreground tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
                            <Calculator size={26} />
                        </div>
                        Declaración de la Renta (IRPF)
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Optimización fiscal para particulares con casillas oficiales de la AEAT y control de justificantes.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Selector de Ejercicio */}
                    <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ejercicio:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-foreground font-bold text-sm focus:outline-none cursor-pointer"
                        >
                            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                                <option key={y} value={y} className="bg-card text-foreground">{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botones de Exportación */}
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
                        title="Descargar informe completo por casillas AEAT en Excel"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        <span>Exportar Excel (.xlsx)</span>
                    </button>

                    <button
                        onClick={handleExportCsv}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm rounded-xl transition-all border border-border"
                        title="Exportar archivo CSV estructurado"
                    >
                        <Download size={15} />
                        <span>CSV</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-primary">
                    <Loader2 className="animate-spin w-10 h-10" />
                </div>
            ) : metrics ? (
                <>
                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Rendimientos del Trabajo"
                            value={`${metrics.work_income.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                            description="Nóminas y retribuciones dinerarias"
                            icon={<Briefcase size={22} className="text-blue-500" />}
                        />

                        <div className="glass-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Donativos y ONG</span>
                                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                                    <Heart size={20} />
                                </div>
                            </div>
                            <div className="text-2xl font-sans font-bold text-foreground">
                                {metrics.donations_base.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                                <span className="text-muted-foreground">Desgravación estimada:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                    +{metrics.donations_deduction.toFixed(2)} €
                                </span>
                            </div>
                        </div>

                        <div className="glass-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hipoteca (pre-2013)</span>
                                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                    <Home size={20} />
                                </div>
                            </div>
                            <div className="text-2xl font-sans font-bold text-foreground">
                                {metrics.mortgage_base.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                                <span className="text-muted-foreground">Deducción 15%:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                    +{metrics.mortgage_deduction.toFixed(2)} €
                                </span>
                            </div>
                        </div>

                        {/* Semáforo Cobertura Documental */}
                        <div className="glass-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cobertura Justificantes</span>
                                <div className={`p-2 rounded-xl ${coverage >= 80 ? 'bg-emerald-500/10 text-emerald-500' : coverage >= 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    <ShieldCheck size={20} />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-sans font-bold ${coverage >= 80 ? 'text-emerald-500' : coverage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {coverage}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    ({metrics.total_with_document} de {metrics.total_transactions})
                                </span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${coverage >= 80 ? 'bg-emerald-500' : coverage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${coverage}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Presets de Casillas AEAT */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Tag size={18} className="text-primary" />
                                    Casillas Oficiales AEAT y Presets de Renta
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Selecciona una casilla para filtrar y revisar los movimientos asociados del ejercicio {selectedYear}.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowNewPresetModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-medium border border-primary/20 transition-all"
                            >
                                <Plus size={14} />
                                <span>Nuevo Preset</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            <button
                                onClick={() => setActivePreset(null)}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                    activePreset === null
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-card border-border hover:border-primary/50 text-foreground'
                                }`}
                            >
                                <span className="text-xs font-semibold uppercase tracking-wider block opacity-75">Vista Global</span>
                                <span className="font-bold text-sm block mt-1">Todos los movimientos del año</span>
                                <span className="text-xs mt-2 block opacity-80">{metrics.total_transactions} movimientos analizados</span>
                            </button>

                            {presets.map((preset) => {
                                const isSelected = activePreset?.id === preset.id;
                                return (
                                    <div
                                        key={preset.id}
                                        onClick={() => setActivePreset(isSelected ? null : preset)}
                                        className={`p-4 rounded-2xl border text-left cursor-pointer relative group transition-all ${
                                            isSelected
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                : 'bg-card border-border hover:border-primary/50 text-foreground'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className={`text-[11px] font-semibold uppercase tracking-wider block line-clamp-1 ${isSelected ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                                {preset.aeat_box || 'Personalizado'}
                                            </span>
                                            {!preset.is_system_preset && (
                                                <button
                                                    onClick={(e) => handleDeletePreset(preset.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 text-destructive rounded-lg transition-all"
                                                    title="Eliminar preset"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="font-bold text-sm block mt-1 line-clamp-1">{preset.name}</span>
                                        <div className="flex items-center gap-1.5 mt-2 text-xs opacity-75">
                                            <span>{preset.is_system_preset ? 'Oficial AEAT' : 'Usuario'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desglose por Categorías / Casillas */}
                    <Card title="Desglose por Categorías Fiscales">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border/60 text-muted-foreground text-xs uppercase tracking-wider">
                                        <th className="pb-3 font-semibold">Categoría</th>
                                        <th className="pb-3 font-semibold">Código AEAT</th>
                                        <th className="pb-3 font-semibold text-center">Tipo</th>
                                        <th className="pb-3 font-semibold text-center">¿Deducible IRPF?</th>
                                        <th className="pb-3 font-semibold text-right">Importe Total</th>
                                        <th className="pb-3 font-semibold text-center">Movimientos</th>
                                        <th className="pb-3 font-semibold text-center">Facturas Adjuntas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {summary.categories_breakdown.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 font-medium text-foreground flex items-center gap-2">
                                                <span
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: cat.category_color }}
                                                />
                                                <span>{cat.category_name}</span>
                                            </td>
                                            <td className="py-3 font-mono text-xs text-muted-foreground">
                                                {cat.aeat_code ? (
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">
                                                        {cat.aeat_code}
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    cat.is_income
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-primary/10 text-primary'
                                                }`}>
                                                    {cat.is_income ? 'Ingreso' : 'Gasto'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-center">
                                                {cat.is_deductible ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                                        <CheckCircle2 size={14} /> Sí
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">No</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right font-sans font-bold tabular-nums text-foreground">
                                                {cat.total_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                            </td>
                                            <td className="py-3 text-center text-muted-foreground">
                                                {cat.count}
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    cat.with_document_count === cat.count && cat.count > 0
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                        : cat.with_document_count > 0
                                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {cat.with_document_count} / {cat.count}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : null}

            {/* Modal Nuevo Preset */}
            {showNewPresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card border border-border/80 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <h3 className="text-lg font-bold text-foreground">Nuevo Preset Fiscal</h3>
                            <button
                                onClick={() => setShowNewPresetModal(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePreset} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre del Preset</label>
                                <input
                                    type="text"
                                    required
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder="Ej. Gastos de guardería deducibles"
                                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">Casilla AEAT o Referencia</label>
                                <input
                                    type="text"
                                    value={newPresetAeatBox}
                                    onChange={(e) => setNewPresetAeatBox(e.target.value)}
                                    placeholder="Ej. Casilla 0118: Gastos de custodia"
                                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNewPresetModal(false)}
                                    className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 shadow-sm"
                                >
                                    Guardar Preset
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

