import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadFile } from '../services/api';

export function ImportPage() {
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ status: string, transactions_created: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await processFile(e.target.files[0]);
        }
    };

    const processFile = async (file: File) => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await uploadFile(file);
            setResult(res);
        } catch (err: any) {
            setError("Error al procesar el archivo. Asegúrate de que es un Excel válido.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Importar Movimientos</h2>
                <p className="text-slate-400">Sube tus extractos bancarios en formato Excel (.xls, .xlsx)</p>
            </div>

            <Card className="relative overflow-hidden group">
                <div
                    className={`
            p-12 border-2 border-dashed rounded-xl text-center transition-all duration-300
            ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}
          `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className={`p-4 rounded-full ${loading ? 'bg-blue-500/20' : 'bg-slate-800'} transition-colors`}>
                            {loading ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            ) : (
                                <Upload className="w-8 h-8 text-blue-400" />
                            )}
                        </div>

                        <div className="space-y-1">
                            <p className="text-lg font-medium text-white">
                                Arrastra y suelta tu archivo aquí
                            </p>
                            <p className="text-sm text-slate-400">
                                o haz clic para seleccionar
                            </p>
                        </div>

                        <Button disabled={loading}>
                            <label className="cursor-pointer absolute inset-0 w-full h-full flex items-center justify-center opacity-0">
                                <input type="file" accept=".xls,.xlsx,.csv" onChange={handleChange} className="hidden" />
                            </label>
                            Seleccionar Archivo
                        </Button>
                    </div>
                </div>
            </Card>

            {result && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-emerald-400">¡Importación Exitosa!</h4>
                        <p className="text-slate-400 text-sm">Se han procesado {result.transactions_created} transacciones correctamente.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-red-500/20 rounded-full text-red-400">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-400">Error</h4>
                        <p className="text-slate-400 text-sm">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
