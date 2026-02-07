import { useState, useEffect } from 'react'
import { getTransactions } from './services/api';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { ImportPage } from './pages/ImportPage';
import { LoginPage } from './pages/LoginPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InsightsPage } from './pages/InsightsPage';
import { BudgetPage } from './pages/BudgetPage';
import { Loader2 } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setCheckingAuth(false);
  }, []);

  const handleLogin = (_token: string) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
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
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
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
      case 'transactions':
        return <TransactionsPage transactions={transactions} onTransactionUpdated={fetchData} />;
      case 'analytics':
        return <AnalyticsPage transactions={transactions} />;
      case 'budget':
        return <BudgetPage />;
      case 'insights':
        return <InsightsPage />;
      case 'import':
        return <ImportPage />;
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
    <Layout activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  )
}

export default App
