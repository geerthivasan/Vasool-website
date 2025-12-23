
import React from 'react';
import { useApp, View } from '../../App';

const MobileNav: React.FC = () => {
  const { currentView, setView } = useApp();

  const tabs: { label: string; icon: string; view: View }[] = [
    { label: 'Home', icon: 'fa-house', view: 'dashboard' },
    { label: 'Invoices', icon: 'fa-file-invoice', view: 'invoices' },
    { label: 'Customers', icon: 'fa-users', view: 'customers' },
    { label: 'Recovery', icon: 'fa-paper-plane', view: 'followups' },
    { label: 'Bank', icon: 'fa-building-columns', view: 'reconciliation' },
    { label: 'Settings', icon: 'fa-gear', view: 'settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-2 py-4 flex justify-around items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-6 safe-area-bottom">
      {tabs.map((tab, idx) => (
        <button
          key={idx}
          onClick={() => setView(tab.view)}
          className={`flex flex-col items-center gap-1.5 transition-all p-2 rounded-xl active:scale-95 ${
            currentView === tab.view ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`text-lg transition-transform ${currentView === tab.view ? 'scale-110' : ''}`}>
             <i className={`fa-solid ${tab.icon}`}></i>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wide ${currentView === tab.view ? 'opacity-100' : 'opacity-70'}`}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default MobileNav;
