import { useState, useEffect } from 'react'
import { getTransactions, authService } from './services/api';
import { startAutoSync, stopAutoSync } from './services/syncService';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { ImportPage } from './pages/ImportPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InsightsPage } from './pages/InsightsPage';
import { BudgetPage } from './pages/BudgetPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { BankingPage } from './pages/BankingPage';
import { TaxPage } from './pages/TaxPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { QuickExpenseForm } from './components/QuickExpenseForm';
import { Loader2 } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.includes('banking') || window.location.search.includes('connection')) {
        if (window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/' + window.location.search);
        }
        return 'banking';
      }
      if (window.location.search.includes('tab=documents') || window.location.search.includes('gmail_connected')) {
        return 'documents';
      }
      if (window.location.search.includes('tab=tax')) {
        return 'tax';
      }
    }
    return 'dashboard';
  });
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in (BFF session check or legacy token)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const authStatus = await authService.getAuthStatus();
        if (authStatus.authenticated) {
          setIsAuthenticated(true);
        } else if (localStorage.getItem('access_token')) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, []);

  // Start auto-sync when authenticated (includes 1h cron)
  useEffect(() => {
    if (isAuthenticated) {
      startAutoSync();
      return () => {
        stopAutoSync();
      };
    }
  }, [isAuthenticated]);

  const handleLogin = (_token?: string) => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("Error logging out", e);
    }
    setIsAuthenticated(false);
  };

  const fetchData = async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
      calculateStats(data);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: any[]) => {
    let inc = 0;
    let exp = 0;
    data.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'income') inc += amt;
      else if (t.type === 'expense') exp += Math.abs(amt);
    });
    setStats({ income: inc, expense: exp, balance: inc - exp });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
      </div>
    );
  }

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage 
                onRegister={handleLogin} 
                onGoToLogin={() => setAuthView('login')} 
             />;
    }
    return <LoginPage 
              onLogin={handleLogin} 
              onGoToRegister={() => setAuthView('register')} 
           />;
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center text-blue-500">
          <Loader2 className="animate-spin w-10 h-10" />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={stats} transactions={transactions} />;
      case 'banking':
        return <BankingPage />;
      case 'transactions':
        return <TransactionsPage transactions={transactions} onTransactionUpdated={fetchData} />;
      case 'documents':
        return <DocumentsPage />;
      case 'tax':
        return <TaxPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'analytics':
        return <AnalyticsPage transactions={transactions} />;
      case 'budget':
        return <BudgetPage />;
      case 'insights':
        return <InsightsPage />;
      case 'import':
        return <ImportPage />;
      case 'privacy':
        return <PrivacyPage onLogout={handleLogout} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
            <p>Esta funcionalidad ({activeTab}) está en desarrollo.</p>
          </div>
        );
    }
  };

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
        {renderContent()}
      </Layout>
      <QuickExpenseForm onTransactionAdded={fetchData} />
    </>
  )
}

export default App
