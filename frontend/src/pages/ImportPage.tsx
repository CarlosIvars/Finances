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
            <div className="text-center space-y-1.5">
                <h2 className="text-3xl font-sans font-bold text-foreground tracking-tight">Importar Movimientos</h2>
                <p className="text-muted-foreground text-sm font-medium">Sube tus extractos bancarios en formato Excel (.xls, .xlsx) o CSV</p>
            </div>

            <Card className="relative overflow-hidden group">
                <div
                    className={`
            p-12 border-2 border-dashed rounded-2xl text-center transition-all duration-300
            ${dragActive ? 'border-primary bg-primary/10' : 'border-border/80 hover:border-primary/40 bg-secondary/20 hover:bg-secondary/40'}
          `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className={`p-4 rounded-2xl ${loading ? 'bg-primary/20' : 'bg-primary/10 border border-primary/20'} transition-colors`}>
                            {loading ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            ) : (
                                <Upload className="w-8 h-8 text-primary" />
                            )}
                        </div>

                        <div className="space-y-1">
                            <p className="text-lg font-semibold text-foreground tracking-tight">
                                Arrastra y suelta tu archivo aquí
                            </p>
                            <p className="text-sm text-muted-foreground">
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
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-500 shrink-0">
                        <CheckCircle size={22} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">¡Importación Exitosa!</h4>
                        <p className="text-muted-foreground text-sm">Se han procesado {result.transactions_created} transacciones correctamente.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-destructive/20 rounded-xl text-destructive shrink-0">
                        <AlertCircle size={22} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-destructive">Error</h4>
                        <p className="text-muted-foreground text-sm">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
