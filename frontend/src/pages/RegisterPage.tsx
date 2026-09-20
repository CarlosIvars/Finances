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
        <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
            <div className="w-full max-w-md my-8">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <PieChart className="w-10 h-10 text-blue-500" />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            FinancIAs
                        </h1>
                    </div>
                    <p className="text-slate-400">Crea tu cuenta segura</p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Nombre de usuario"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                    minLength={3}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5">Debe incluir mayúscula, minúscula y número.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="password"
                                    name="password_confirm"
                                    value={formData.password_confirm}
                                    onChange={handleChange}
                                    placeholder="Repetir contraseña"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
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
                                    <div className={`w-5 h-5 rounded border ${acceptTerms ? 'bg-blue-500 border-blue-500' : 'bg-slate-800 border-slate-600 group-hover:border-blue-500'} transition-colors flex items-center justify-center`}>
                                        {acceptTerms && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 leading-snug">
                                    He leído y acepto los{' '}
                                    <button 
                                        type="button"
                                        onClick={() => setShowTerms(true)}
                                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                                    >
                                        Términos y Condiciones y la Política de Privacidad (RGPD)
                                    </button>.
                                </div>
                            </label>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!acceptTerms && !error}>
                            Crear Cuenta Segura
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-slate-400 text-sm mt-6">
                    ¿Ya tienes una cuenta?{' '}
                    <button 
                        onClick={onGoToLogin}
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
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
