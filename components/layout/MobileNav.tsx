
import React from 'react';
import { useApp, View } from '../../App';

const MobileNav: React.FC = () => {
  const { currentView, setView } = useApp();

  const tabs: { label: string; icon: string; view: View }[] = [
    { label: 'Home', icon: 'fa-house', view: 'dashboard' },
    { label: 'Invoices', icon: 'fa-file-invoice', view: 'invoices' },
    { label: 'Insights', icon: 'fa-wand-magic-sparkles', view: 'dashboard' }, // Links to dashboard for now
    { label: 'Profile', icon: 'fa-user', view: 'settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {tabs.map((tab, idx) => (
        <button
          key={idx}
          onClick={() => setView(tab.view)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            currentView === tab.view ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <i className={`fa-solid ${tab.icon} text-lg`}></i>
          <span className="text-[10px] font-bold uppercase">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MobileNav;
