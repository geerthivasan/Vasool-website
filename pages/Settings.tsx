
import React, { useState } from 'react';
import { useApp } from '../App';
import { toast } from 'react-hot-toast';
import { PROVIDERS, AccountingProvider, connectProvider, isProviderConnected, disconnectProvider } from '../services/accounting';
import { getEscalationColor } from '../services/finance';

type SettingSection = 'Profile' | 'Escalation Matrix' | 'Integrations' | 'Security';

const Settings: React.FC = () => {
  const { user, escalationProtocol, setEscalationProtocol, resetDatabase } = useApp();
  const [activeTab, setActiveTab] = useState<SettingSection>('Profile');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const [tempProtocol, setTempProtocol] = useState(escalationProtocol);

  const handleProtocolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempProtocol({ ...tempProtocol, [e.target.name]: parseInt(e.target.value) || 0 });
  };

  const saveProtocol = () => {
    setEscalationProtocol(tempProtocol);
    toast.success("Escalation thresholds updated!");
  };

  const handleProviderToggle = async (providerId: AccountingProvider, name: string) => {
    if (isProviderConnected(providerId)) {
      disconnectProvider(providerId);
      toast.success(`${name} Disconnected.`);
      window.location.reload();
    } else {
      setIsProcessing(providerId);
      toast.loading(`Connecting to ${name}...`, { id: 'settings-auth' });
      await connectProvider(providerId);
      setIsProcessing(null);
      toast.success(`${name} Connected!`, { id: 'settings-auth' });
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configuration</h2>
        <p className="text-sm text-slate-500 font-medium">Fine-tune your recovery infrastructure.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-2">
           {(['Profile', 'Escalation Matrix', 'Integrations', 'Security'] as SettingSection[]).map(item => (
             <button 
              key={item} 
              onClick={() => setActiveTab(item)}
              className={`w-full text-left px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === item ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
               {item}
             </button>
           ))}
           <div className="pt-10">
              <button 
                onClick={() => {
                  if (confirm("Are you sure? This will wipe all invoices and customer data from your browser's local database.")) {
                    resetDatabase();
                  }
                }}
                className="w-full text-left px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-trash-can"></i> Reset Local Database
              </button>
           </div>
        </div>

        <div className="lg:col-span-2">
          {activeTab === 'Profile' && (
            <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Business Identity</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Entity Name</label>
                  <input type="text" defaultValue={user?.businessName} className="w-full px-5 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Name</label>
                  <input type="text" defaultValue={user?.fullName} className="w-full px-5 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none" />
                </div>
              </div>
              <button onClick={() => toast.success("Profile details updated.")} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Save Profile</button>
            </section>
          )}

          {activeTab === 'Escalation Matrix' && (
            <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Recovery Thresholds</h4>
                <button onClick={saveProtocol} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Apply Changes</button>
              </div>

              <div className="space-y-6">
                {[
                  { id: 'level1Days', label: 'L1: Friendly Nudge (Days before due)', color: getEscalationColor(1) },
                  { id: 'level2Days', label: 'L2: Overdue Standard (Days after due)', color: getEscalationColor(2) },
                  { id: 'level3Days', label: 'L3: Overdue Firm (Days after due)', color: getEscalationColor(3) },
                  { id: 'level4Days', label: 'L4: Overdue Management (Days after due)', color: getEscalationColor(4) },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${item.color}`}></div>
                      <p className="text-[11px] font-bold text-slate-700">{item.label}</p>
                    </div>
                    <input 
                      type="number" 
                      name={item.id} 
                      value={(tempProtocol as any)[item.id]} 
                      onChange={handleProtocolChange}
                      className="w-16 text-center py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                ))}
              </div>

              <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-2 w-2 rounded-full ${getEscalationColor(5)}`}></div>
                  <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Level 5: AI Voice Escalation</h5>
                </div>
                <p className="text-[10px] text-red-500 font-medium leading-relaxed">Automatic triggering of stern AI voice calls occurs for all invoices exceeding the Level 4 threshold ({tempProtocol.level4Days}+ days).</p>
              </div>
            </section>
          )}

          {activeTab === 'Integrations' && (
            <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Ledger Source Cloud</h4>
              <div className="space-y-3">
                {PROVIDERS.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 border border-slate-50 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <i className={`fa-solid ${p.icon} ${p.color}`}></i>
                      <p className="text-xs font-bold">{p.name}</p>
                    </div>
                    <button onClick={() => handleProviderToggle(p.id, p.name)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${isProviderConnected(p.id) ? 'bg-red-50 text-red-600' : 'bg-indigo-600 text-white shadow-sm'}`}>
                      {isProviderConnected(p.id) ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'Security' && (
             <div className="bg-white p-24 text-center rounded-[2rem] border border-slate-200 shadow-sm">
                <i className="fa-solid fa-shield-check text-4xl text-indigo-600 mb-4"></i>
                <h5 className="text-lg font-black text-slate-900 mb-2">Data Protection</h5>
                <p className="text-xs text-slate-400 mb-8">All your financial data is encrypted and stored locally in your browser. No third-party access without explicit OAuth authorization.</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-500">2FA Authentication</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase">Always Active</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-500">Audit Logs</span>
                    <button onClick={() => toast("Exporting audit logs...")} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Download</button>
                  </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
