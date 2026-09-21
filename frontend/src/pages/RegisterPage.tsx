import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PieChart, User, Lock, Mail, ShieldAlert } from 'lucide-react';
import { TermsModal } from '../components/TermsModal';

interface RegisterPageProps {
    onRegister: (token: string) => void;
    onGoToLogin: () => void;
}

export function RegisterPage({ onRegister, onGoToLogin }: RegisterPageProps) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const validateForm = () => {
        if (!acceptTerms) {
            setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad.');
            return false;
        }
        if (formData.password !== formData.password_confirm) {
            setError('Las contraseñas no coinciden.');
            return false;
        }
        if (formData.password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            const response = await fetch('/api/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    password_confirm: formData.password_confirm,
                    accept_terms: acceptTerms
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Formatting backend errors
                let errorMsg = 'Error al registrar usuario.';
                if (typeof data === 'object') {
                    const firstErrorKey = Object.keys(data)[0];
                    if (data[firstErrorKey] && data[firstErrorKey][0]) {
                        errorMsg = data[firstErrorKey][0];
                    }
                }
                throw new Error(errorMsg);
            }

            // Successful registration returns tokens via auto-login
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            onRegister(data.access);
        } catch (err: any) {
            setError(err.message || 'Fallo de conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
            {/* Ambient glows */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md my-8 relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 p-1.5 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-sm overflow-hidden">
                            <img src="/logo.png" alt="FinancIAs Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-3xl font-sans font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent tracking-tight">
                            FinancIAs
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Crea tu cuenta segura</p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Nombre de usuario"
                                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    required
                                    minLength={3}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">Debe incluir mayúscula, minúscula y número.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="password"
                                    name="password_confirm"
                                    value={formData.password_confirm}
                                    onChange={handleChange}
                                    placeholder="Repetir contraseña"
                                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    required
                                />
                            </div>
                        </div>

                        {/* RGPD Consent */}
                        <div className="pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border ${acceptTerms ? 'bg-primary border-primary' : 'bg-background border-border group-hover:border-primary'} transition-colors flex items-center justify-center`}>
                                        {acceptTerms && <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground leading-snug">
                                    He leído y acepto los{' '}
                                    <button 
                                        type="button"
                                        onClick={() => setShowTerms(true)}
                                        className="text-primary hover:underline transition-colors focus:outline-none font-medium"
                                    >
                                        Términos y Condiciones y la Política de Privacidad (RGPD)
                                    </button>.
                                </div>
                            </label>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!acceptTerms && !error}>
                            Crear Cuenta Segura
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-muted-foreground text-sm mt-6">
                    ¿Ya tienes una cuenta?{' '}
                    <button 
                        onClick={onGoToLogin}
                        className="text-primary hover:underline font-semibold transition-colors"
                    >
                        Inicia Sesión
                    </button>
                </p>

                {/* Privacy Modal */}
                <TermsModal 
                    isOpen={showTerms} 
                    onClose={() => setShowTerms(false)} 
                    onAccept={() => {
                        setAcceptTerms(true);
                        setShowTerms(false);
                    }} 
                />
            </div>
        </div>
    );
}
