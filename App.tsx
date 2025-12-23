
import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, UserRole, Invoice, Customer, EscalationProtocol } from './types';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import FollowUps from './pages/FollowUps';
import Reconciliation from './pages/Reconciliation';
import Settings from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import { Toaster, toast } from 'react-hot-toast';
import { DEFAULT_PROTOCOL } from './services/finance';

export type View = 'dashboard' | 'invoices' | 'customers' | 'followups' | 'reconciliation' | 'settings' | 'admin';

interface AppContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (userData: { email: string, fullName: string, businessName: string, pass: string }) => Promise<void>;
  logout: () => void;
  currentView: View;
  setView: (view: View) => void;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  escalationProtocol: EscalationProtocol;
  setEscalationProtocol: (p: EscalationProtocol) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [escalationProtocol, setEscalationProtocolState] = useState<EscalationProtocol>(DEFAULT_PROTOCOL);

  useEffect(() => {
    const savedUser = localStorage.getItem('vasool_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      const savedInvoices = localStorage.getItem(`vasool_invoices_${parsedUser.id}`);
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
      
      const savedCustomers = localStorage.getItem(`vasool_customers_${parsedUser.id}`);
      if (savedCustomers) setCustomers(JSON.parse(savedCustomers));

      const savedProtocol = localStorage.getItem(`vasool_protocol_${parsedUser.id}`);
      if (savedProtocol) setEscalationProtocolState(JSON.parse(savedProtocol));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`vasool_invoices_${user.id}`, JSON.stringify(invoices));
    }
  }, [invoices, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`vasool_customers_${user.id}`, JSON.stringify(customers));
    }
  }, [customers, user]);

  const setEscalationProtocol = (p: EscalationProtocol) => {
    setEscalationProtocolState(p);
    if (user) {
      localStorage.setItem(`vasool_protocol_${user.id}`, JSON.stringify(p));
    }
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const userId = btoa(email);
    const mockUser: User = {
      id: userId,
      email,
      fullName: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      role: email.includes('admin') ? UserRole.ADMIN : UserRole.USER,
      businessName: 'Acme Corp',
      mfaEnabled: false,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    };
    setUser(mockUser);
    localStorage.setItem('vasool_user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const signup = async (data: { email: string, fullName: string, businessName: string, pass: string }) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const userId = btoa(data.email);
    const newUser: User = {
      id: userId,
      email: data.email,
      fullName: data.fullName,
      role: UserRole.USER,
      businessName: data.businessName,
      mfaEnabled: false,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`
    };
    setUser(newUser);
    localStorage.setItem('vasool_user', JSON.stringify(newUser));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vasool_user');
    toast.success("Logged out.");
  };

  const setView = (view: View) => setCurrentView(view);

  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <AppContext.Provider value={{ user, login, signup, logout, currentView, setView, invoices, setInvoices, customers, setCustomers, escalationProtocol, setEscalationProtocol }}>
        <Login />
        <Toaster position="top-right" />
      </AppContext.Provider>
    );
  }

  const renderContent = () => {
    if (user.role === UserRole.ADMIN) return <AdminDashboard />;
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'invoices': return <Invoices />;
      case 'customers': return <Customers />;
      case 'followups': return <FollowUps />;
      case 'reconciliation': return <Reconciliation />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={{ user, login, signup, logout, currentView, setView, invoices, setInvoices, customers, setCustomers, escalationProtocol, setEscalationProtocol }}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-10">{renderContent()}</div>
        </main>
        <div className="md:hidden"><MobileNav /></div>
      </div>
      <Toaster position="top-right" />
    </AppContext.Provider>
  );
};

export default App;
