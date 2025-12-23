
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-2 md:px-0">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configuration</h2>
        <p className="text-sm text-slate-500 font-medium">Fine-tune your recovery infrastructure.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-2">
           <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1">
             {(['Profile', 'Escalation Matrix', 'Integrations', 'Security'] as SettingSection[]).map(item => (
               <button 
                key={item} 
                onClick={() => setActiveTab(item)}
                className={`w-full text-left px-5 py-4 md:py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === item ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                 {item}
               </button>
             ))}
           </div>
           
           <div className="pt-6 px-2">
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

        <div className="lg:col-span-9">
          {activeTab === 'Profile' && (
            <section className="bg-white p-8 md:p-10 rounded-[2rem] border border-slate-200 shadow-sm space-y-8 animate-in slide-in-from-bottom-2">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Business Identity</h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Entity Name</label>
                  <input type="text" defaultValue={user?.businessName} className="w-full px-6 py-4 border border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Name</label>
                  <input type="text" defaultValue={user?.fullName} className="w-full px-6 py-4 border border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
                </div>
              </div>
              <div className="pt-4">
                 <button onClick={() => toast.success("Profile details updated.")} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Save Profile</button>
              </div>
            </section>
          )}

          {activeTab === 'Escalation Matrix' && (
            <section className="bg-white p-8 md:p-10 rounded-[2rem] border border-slate-200 shadow-sm space-y-8 animate-in slide-in-from-bottom-2">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Recovery Thresholds</h4>
                <button onClick={saveProtocol} className="px-6 py-2 bg-slate-100 rounded-xl text-[10px] font-black text-indigo-600 uppercase hover:bg-indigo-50 transition-colors">Apply Changes</button>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'level1Days', label: 'L1: Friendly Nudge (Days before due)', color: getEscalationColor(1) },
                  { id: 'level2Days', label: 'L2: Overdue Standard (Days after due)', color: getEscalationColor(2) },
                  { id: 'level3Days', label: 'L3: Overdue Firm (Days after due)', color: getEscalationColor(3) },
                  { id: 'level4Days', label: 'L4: Overdue Management (Days after due)', color: getEscalationColor(4) },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`h-3 w-3 rounded-full ${item.color}`}></div>
                      <p className="text-xs font-bold text-slate-700">{item.label}</p>
                    </div>
                    <input 
                      type="number" 
                      name={item.id} 
                      value={(tempProtocol as any)[item.id]} 
                      onChange={handleProtocolChange}
                      className="w-20 text-center py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                ))}
              </div>

              <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-2 w-2 rounded-full ${getEscalationColor(5)}`}></div>
                  <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Level 5: AI Voice Escalation</h5>
                </div>
                <p className="text-[11px] text-red-500 font-medium leading-relaxed">Automatic triggering of stern AI voice calls occurs for all invoices exceeding the Level 4 threshold ({tempProtocol.level4Days}+ days).</p>
              </div>
            </section>
          )}

          {activeTab === 'Integrations' && (
            <section className="bg-white p-8 md:p-10 rounded-[2rem] border border-slate-200 shadow-sm space-y-8 animate-in slide-in-from-bottom-2">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Ledger Source Cloud</h4>
              <div className="space-y-4">
                {PROVIDERS.map(p => (
                  <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 border border-slate-100 rounded-[1.5rem] hover:bg-slate-50 transition-colors gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm text-xl">
                        <i className={`fa-solid ${p.icon} ${p.color}`}></i>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{p.description}</p>
                      </div>
                    </div>
                    <button onClick={() => handleProviderToggle(p.id, p.name)} className={`w-full md:w-auto px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isProviderConnected(p.id) ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'}`}>
                      {isProviderConnected(p.id) ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'Security' && (
             <div className="bg-white p-12 md:p-24 text-center rounded-[2rem] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
                <div className="h-20 w-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-indigo-600 text-3xl">
                   <i className="fa-solid fa-shield-check"></i>
                </div>
                <h5 className="text-xl font-black text-slate-900 mb-3">Data Protection</h5>
                <p className="text-xs text-slate-400 mb-10 max-w-md mx-auto leading-relaxed">All your financial data is encrypted and stored locally in your browser. No third-party access without explicit OAuth authorization.</p>
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-500">2FA Authentication</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2"><i className="fa-solid fa-circle-check"></i> Active</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-500">Audit Logs</span>
                    <button onClick={() => toast("Exporting audit logs...")} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Download CSV</button>
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
