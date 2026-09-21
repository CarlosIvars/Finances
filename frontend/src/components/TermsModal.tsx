import { useRef, useEffect } from 'react';
import { Shield, X, CheckCircle, Scale } from 'lucide-react';
import { Button } from './ui/Button';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                ref={modalRef}
                className="glass-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/60 bg-card/90 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <Scale size={22} />
                        </div>
                        <h2 id="modal-title" className="text-xl font-semibold text-foreground">
                            Términos y Condiciones / Política de Privacidad
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label="Cerrar modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 text-foreground/90 text-sm leading-relaxed">
                    
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-3">
                        <Shield className="text-primary shrink-0 mt-0.5" size={20} />
                        <p className="text-foreground text-sm">
                            En cumplimiento con el <strong>Reglamento General de Protección de Datos (RGPD)</strong> de la Unión Europea, detallamos cómo tratamos tus datos personales. 
                            Tu privacidad y seguridad son nuestra máxima prioridad.
                        </p>
                    </div>

                    <section className="space-y-3">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">1</span>
                            Responsable del Tratamiento
                        </h3>
                        <p className="text-muted-foreground">
                            FinancIAs (en adelante, "la Aplicación") es la responsable del tratamiento de los datos personales que nos facilites.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">2</span>
                            Datos Recopilados y Minimización
                        </h3>
                        <p className="text-muted-foreground">Aplicamos estrictamente el principio de minimización de datos (Art. 5.1.c RGPD). Solo recopilamos:</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li><strong>Datos de registro:</strong> Nombre de usuario, correo electrónico y contraseña (encriptada).</li>
                            <li><strong>Datos financieros:</strong> Conceptos de transacciones, importes y fechas subidos voluntariamente por el usuario.</li>
                        </ul>
                        <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-medium">
                            <strong>🚫 Prohibición estricta:</strong> Nunca solicitamos, almacenamos ni procesamos datos bancarios sensibles (IBAN, números de tarjeta, CVV).
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">3</span>
                            Uso de Inteligencia Artificial y Profiling
                        </h3>
                        <p className="text-muted-foreground">La Aplicación utiliza modelos de Inteligencia Artificial (IA) para clasificar transacciones y generar recomendaciones financieras automáticas.</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li><strong>Anonimización previa:</strong> Todo dato enviado a modelos de IA (locales o externos) es previamente anonimizado o seudonimizado automáticamente para eliminar patrones identificables o datos personales.</li>
                            <li><strong>Consentimiento granular (Art. 22 RGPD):</strong> Tienes derecho a decidir si deseas utilizar las funciones de IA. Puedes revocar este consentimiento en cualquier momento desde los ajustes de privacidad.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">4</span>
                            Seguridad y Trazabilidad
                        </h3>
                        <p className="text-muted-foreground">
                            Implementamos medidas de seguridad técnicas y organizativas para garantizar un nivel de seguridad adecuado al riesgo (Art. 32 RGPD). 
                            Mantenemos un registro de auditoría interno sobre el acceso y exportación de datos personales, sin incluir el contenido de los mismos.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">5</span>
                            Tus Derechos (Derechos ARCO y RGPD)
                        </h3>
                        <p className="text-muted-foreground">Tienes en todo momento el control total sobre tus datos. A través del apartado "Privacidad" en la Aplicación puedes ejercer tus derechos de:</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li><strong>Acceso y Portabilidad (Art. 15 y 20 RGPD):</strong> Exportar todos tus datos en un formato estructurado y legible por máquina (JSON).</li>
                            <li><strong>Supresión / Derecho al Olvido (Art. 17 RGPD):</strong> Eliminar tu cuenta y todos los datos asociados de forma permanente e irrecuperable.</li>
                            <li><strong>Revocación de consentimiento (Art. 7.3 RGPD):</strong> Modificar tus preferencias de consentimiento al instante.</li>
                        </ul>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border/60 bg-card/90 backdrop-blur-md flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        Al hacer clic en "He leído y acepto", confirmas haber leído estas condiciones y otorgas tu consentimiento explícito para el tratamiento de tus datos.
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={onAccept} icon={<CheckCircle size={18} />}>
                            He leído y acepto
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
