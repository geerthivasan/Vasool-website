
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
  resetDatabase: () => void;
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

  // Initial Load from "Database" (LocalStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('vasool_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      const userId = parsedUser.id;
      const savedInvoices = localStorage.getItem(`vasool_invoices_${userId}`);
      const savedCustomers = localStorage.getItem(`vasool_customers_${userId}`);
      const savedProtocol = localStorage.getItem(`vasool_protocol_${userId}`);

      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
      if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
      if (savedProtocol) setEscalationProtocolState(JSON.parse(savedProtocol));
      
      // Seed data if database is empty for a better "Fully Functional" experience
      if (!savedInvoices || JSON.parse(savedInvoices).length === 0) {
        const seedInvoices: Invoice[] = [
          {
            id: 'INV-1001',
            customerName: 'Airtel Business',
            amount: 75000,
            balance: 75000,
            currency: 'INR',
            dueDate: '2025-10-15',
            status: 'PENDING',
            isEmailed: true,
            probabilityOfPayment: 0.9,
            manualLogs: [],
            escalationLevel: 0
          },
          {
            id: 'INV-1002',
            customerName: 'Reliance Retail',
            amount: 125000,
            balance: 50000,
            currency: 'INR',
            dueDate: '2025-10-20',
            status: 'PENDING',
            isEmailed: true,
            probabilityOfPayment: 0.7,
            manualLogs: [],
            escalationLevel: 0
          }
        ];
        setInvoices(seedInvoices);
      }
    }
    setIsLoading(false);
  }, []);

  // Persistent Save to "Database"
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

  const resetDatabase = () => {
    if (!user) return;
    setInvoices([]);
    setCustomers([]);
    setEscalationProtocolState(DEFAULT_PROTOCOL);
    localStorage.removeItem(`vasool_invoices_${user.id}`);
    localStorage.removeItem(`vasool_customers_${user.id}`);
    localStorage.removeItem(`vasool_protocol_${user.id}`);
    toast.success("Database cleared and reset.");
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const userId = btoa(email);
    const mockUser: User = {
      id: userId,
      email,
      fullName: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      role: email.includes('admin') ? UserRole.ADMIN : UserRole.USER,
      businessName: 'Acme Solutions',
      mfaEnabled: false,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    };
    setUser(mockUser);
    localStorage.setItem('vasool_user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const signup = async (data: { email: string, fullName: string, businessName: string, pass: string }) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
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

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
      <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center animate-bounce shadow-2xl shadow-indigo-100">
        <i className="fa-solid fa-bolt-lightning text-white text-2xl"></i>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Initializing Data Core</p>
    </div>
  );

  if (!user) {
    return (
      <AppContext.Provider value={{ user, login, signup, logout, currentView, setView, invoices, setInvoices, customers, setCustomers, escalationProtocol, setEscalationProtocol, resetDatabase }}>
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
    <AppContext.Provider value={{ user, login, signup, logout, currentView, setView, invoices, setInvoices, customers, setCustomers, escalationProtocol, setEscalationProtocol, resetDatabase }}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-6 py-10">{renderContent()}</div>
        </main>
        <div className="md:hidden"><MobileNav /></div>
      </div>
      <Toaster position="top-right" />
    </AppContext.Provider>
  );
};

export default App;
