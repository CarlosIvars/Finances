import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { User, Lock, AlertCircle } from 'lucide-react';
import { authService } from '../services/api';

interface LoginPageProps {
    onLogin: (token?: string) => void;
    onGoToRegister: () => void;
}

export function LoginPage({ onLogin, onGoToRegister }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authService.login(username, password);
            onLogin();
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Error al iniciar sesión';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const url = await authService.getGoogleLoginUrl();
            window.location.href = url;
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Error al conectar con Google');
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

            <div className="w-full max-w-md relative z-10">
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
                    <p className="text-muted-foreground text-sm font-medium">Gestión inteligente de finanzas personales</p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="admin"
                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
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
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Iniciar Sesión
                        </Button>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">o continúa con</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-secondary/50 hover:bg-secondary text-foreground font-medium rounded-xl border border-border transition-all shadow-sm text-sm"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                            </svg>
                            Continuar con Google
                        </button>
                    </form>
                </Card>

                <p className="text-center text-muted-foreground text-sm mt-6">
                    ¿No tienes una cuenta?{' '}
                    <button 
                        onClick={onGoToRegister}
                        className="text-primary hover:underline font-semibold transition-colors"
                    >
                        Regístrate
                    </button>
                </p>
            </div>
        </div>
    );
}
