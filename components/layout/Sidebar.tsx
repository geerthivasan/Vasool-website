
import React from 'react';
import { useApp, View } from '../../App';
import { UserRole } from '../../types';

const Sidebar: React.FC = () => {
  const { user, logout, currentView, setView } = useApp();

  const navItems: { label: string; icon: string; role: UserRole[]; view: View }[] = [
    { label: 'Dashboard', icon: 'fa-chart-pie', role: [UserRole.USER, UserRole.ADMIN], view: 'dashboard' },
    { label: 'Invoices', icon: 'fa-file-invoice-dollar', role: [UserRole.USER], view: 'invoices' },
    { label: 'Customers', icon: 'fa-users', role: [UserRole.USER], view: 'customers' },
    { label: 'Follow-ups', icon: 'fa-paper-plane', role: [UserRole.USER], view: 'followups' },
    { label: 'Reconciliation', icon: 'fa-file-invoice', role: [UserRole.USER], view: 'reconciliation' },
    { label: 'Admin Panel', icon: 'fa-shield-halved', role: [UserRole.ADMIN], view: 'admin' },
    { label: 'Settings', icon: 'fa-gear', role: [UserRole.USER, UserRole.ADMIN], view: 'settings' },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full flex flex-col">
      <div className="p-6 cursor-pointer group" onClick={() => setView('dashboard')}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform duration-200">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fillOpacity="0.5"/>
              <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Vasool</h1>
            <p className="text-[10px] text-indigo-500 mt-1 uppercase tracking-widest font-black">Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems
          .filter(item => item.role.includes(user?.role!))
          .map((item, idx) => (
            <button
              key={idx}
              onClick={() => setView(item.view)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                currentView === item.view 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5`}></i>
              {item.label}
            </button>
          ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div 
          className="flex items-center gap-3 px-2 mb-4 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
          onClick={() => setView('settings')}
        >
          <img src={user?.avatarUrl} className="h-10 w-10 rounded-full border border-slate-200" alt="Profile" />
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{user?.role.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <i className="fa-solid fa-right-from-bracket w-5"></i>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
