
import React, { useState, useMemo } from 'react';
import { Customer, EscalationLevel, StageContact } from '../types';
import { toast } from 'react-hot-toast';
import { useApp } from '../App';
import { getEffectiveStatus, calculateEscalationLevel, calculateDynamicRisk, getEscalationColor } from '../services/finance';

const Customers: React.FC = () => {
  const { customers, setCustomers, invoices, escalationProtocol } = useApp();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<number>(1);
  const [showLogModal, setShowLogModal] = useState<Customer | null>(null);
  const [logNote, setLogNote] = useState('');

  // Filtering state
  const [stageFilter, setStageFilter] = useState<number | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'low' | 'medium' | 'high'>('ALL');
  const [maxAmountFilter, setMaxAmountFilter] = useState<number | null>(null);

  // Group invoices by customer name and consolidate data to fix duplicate tiles
  const augmentedCustomers = useMemo(() => {
    // 1. Identify all unique customer names across CRM and Invoices
    const uniqueNames = Array.from(new Set([
      ...customers.map(c => c.name.toLowerCase()),
      ...invoices.map(i => i.customerName.toLowerCase())
    ]));

    const allAugmented = uniqueNames.map(nameKey => {
      // Find base CRM record or create a virtual one
      const baseRecord = customers.find(c => c.name.toLowerCase() === nameKey) || {
        id: `virtual-${nameKey}`,
        name: invoices.find(i => i.customerName.toLowerCase() === nameKey)?.customerName || nameKey,
        contactPerson: 'Contact Needed',
        email: 'N/A',
        phone: 'N/A',
        totalOutstanding: 0,
        riskLevel: 'low' as const,
        lastFollowUp: 'Never',
        currentEscalation: EscalationLevel.LEVEL_0,
        aiEnabled: true,
        stageContacts: {}
      };

      const cInvoices = invoices.filter(inv => inv.customerName.toLowerCase() === nameKey);
      
      const maxEsc = cInvoices.reduce((max, inv) => {
        const level = calculateEscalationLevel(inv, escalationProtocol);
        return level > max ? level : max;
      }, EscalationLevel.LEVEL_0);
      
      const outstanding = cInvoices.reduce((sum, inv) => 
        getEffectiveStatus(inv) !== 'PAID' ? sum + inv.amount : sum, 0
      );

      // Find max overdue days for risk matrix calculation
      const maxOverdueDays = cInvoices.reduce((max, inv) => {
        if (getEffectiveStatus(inv) !== 'OVERDUE') return max;
        const due = new Date(inv.dueDate);
        const diff = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return diff > max ? diff : max;
      }, 0);

      const dynamicRisk = calculateDynamicRisk(outstanding, maxOverdueDays, escalationProtocol);

      return { 
        ...baseRecord, 
        currentEscalation: maxEsc, 
        totalOutstanding: outstanding, 
        riskLevel: dynamicRisk 
      };
    });

    // Apply Filters
    return allAugmented.filter(cust => {
      const matchesStage = stageFilter === 'ALL' || cust.currentEscalation === stageFilter;
      const matchesRisk = riskFilter === 'ALL' || cust.riskLevel === riskFilter;
      const matchesAmount = maxAmountFilter === null || cust.totalOutstanding <= maxAmountFilter;
      return matchesStage && matchesRisk && matchesAmount;
    });
  }, [customers, invoices, escalationProtocol, stageFilter, riskFilter, maxAmountFilter]);

  const maxAvailableOutstanding = useMemo(() => {
    // Re-calculate all outstanding to find max for slider
    const uniqueNames = Array.from(new Set([
        ...customers.map(c => c.name.toLowerCase()),
        ...invoices.map(i => i.customerName.toLowerCase())
    ]));
    const outstandings = uniqueNames.map(nameKey => {
      return invoices.filter(inv => inv.customerName.toLowerCase() === nameKey && getEffectiveStatus(inv) !== 'PAID')
                    .reduce((sum, inv) => sum + inv.amount, 0);
    });
    return outstandings.length > 0 ? Math.max(...outstandings) : 100000;
  }, [customers, invoices]);

  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setCustomers(prev => {
        const exists = prev.some(c => c.id === editingCustomer.id);
        if (exists) return prev.map(c => c.id === editingCustomer.id ? editingCustomer : c);
        return [...prev, editingCustomer];
    });
    toast.success(`Contact details updated for ${editingCustomer.name}`);
    setEditingCustomer(null);
  };

  const handleManualLog = () => {
    if (!showLogModal || !logNote) return;
    toast.success(`Logged manual activity for ${showLogModal.name}`);
    setShowLogModal(null);
    setLogNote('');
  };

  const updateStageContact = (lvl: number, field: keyof StageContact, val: string) => {
    if (!editingCustomer) return;
    const stageContacts = { ...editingCustomer.stageContacts };
    if (!stageContacts[lvl]) stageContacts[lvl] = { name: '', email: '', phone: '' };
    stageContacts[lvl] = { ...stageContacts[lvl], [field]: val };
    setEditingCustomer({ ...editingCustomer, stageContacts });
  };

  const syncAllStages = () => {
    if (!editingCustomer) return;
    const current = editingCustomer.stageContacts[activeStageTab] || { name: '', email: '', phone: '' };
    const newStages = { ...editingCustomer.stageContacts };
    [1, 2, 3, 4, 5].forEach(lvl => {
      newStages[lvl] = { ...current };
    });
    setEditingCustomer({ ...editingCustomer, stageContacts: newStages });
    toast.success("Applied contact details to all stages.");
  };

  const toggleAI = (id: string) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, aiEnabled: !c.aiEnabled } : c));
    const c = customers.find(x => x.id === id);
    toast.success(`AI Autopilot ${!c?.aiEnabled ? 'Engaged' : 'Disengaged'} for ${c?.name || 'Customer'}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Partner Hub</h2>
          <p className="text-sm text-slate-500 font-medium">Managing business relationships.</p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stage Filter</label>
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                {['ALL', 0, 1, 2, 3, 4, 5].map(s => (
                    <button 
                        key={s} 
                        onClick={() => setStageFilter(s as any)}
                        className={`flex-1 min-w-[32px] py-2 text-[9px] font-black uppercase rounded-lg transition-all ${stageFilter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        {s === 'ALL' ? 'ALL' : `L${s}`}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Risk Filter</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {['ALL', 'low', 'medium', 'high'].map(r => (
                    <button 
                        key={r} 
                        onClick={() => setRiskFilter(r as any)}
                        className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${riskFilter === r ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outstanding Cap</label>
                <span className="text-[10px] font-black text-indigo-600">₹{(maxAmountFilter || maxAvailableOutstanding).toLocaleString()}</span>
            </div>
            <input 
                type="range" 
                min="0" 
                max={maxAvailableOutstanding} 
                step="5000"
                value={maxAmountFilter || maxAvailableOutstanding}
                onChange={(e) => setMaxAmountFilter(Number(e.target.value))}
                className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {augmentedCustomers.map(cust => (
          <div key={cust.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="absolute top-4 right-4">
                <button 
                    onClick={() => toggleAI(cust.id)}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${cust.aiEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'}`}
                >
                    <i className={`fa-solid ${cust.aiEnabled ? 'fa-robot' : 'fa-hand-dots'}`}></i>
                </button>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg shrink-0">
                {cust.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-black text-slate-900 truncate tracking-tight">{cust.name}</h3>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                  cust.riskLevel === 'high' ? 'text-red-600 bg-red-50' : 
                  cust.riskLevel === 'medium' ? 'text-amber-600 bg-amber-50' : 
                  'text-emerald-600 bg-emerald-50'
                }`}>
                    {cust.riskLevel} Risk Profile
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[1.5rem] p-5 mb-8 border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Outstanding</p>
                <p className="text-xl font-black text-slate-900">₹{cust.totalOutstanding.toLocaleString()}</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escalation Status</span>
                    <span className="text-[9px] font-black text-indigo-600 uppercase">Stage {cust.currentEscalation}</span>
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= cust.currentEscalation ? getEscalationColor(s as any) : 'bg-slate-100'}`}></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditingCustomer(cust)} className="py-4 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-100 hover:bg-indigo-600 transition-all">
                Contacts
              </button>
              <button onClick={() => setShowLogModal(cust)} className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200">
                Activity
              </button>
            </div>
          </div>
        ))}
        {augmentedCustomers.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
            <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200 text-3xl">
                <i className="fa-solid fa-users-slash"></i>
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No partners match your current filters</p>
            <button onClick={() => { setStageFilter('ALL'); setRiskFilter('ALL'); setMaxAmountFilter(null); }} className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Clear all filters</button>
          </div>
        )}
      </div>

      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-black">Contact Management</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuring {editingCustomer.name}</p>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            
            <form onSubmit={handleEditCustomerSubmit} className="p-8 md:p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Partner Legal Entity</label>
                    <input type="text" value={editingCustomer.name} onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} className="w-full px-6 py-4 border border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
                  </div>
                  <div className="flex items-end">
                    <button 
                        type="button"
                        onClick={() => setEditingCustomer({...editingCustomer, aiEnabled: !editingCustomer.aiEnabled})}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${editingCustomer.aiEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                    >
                        <i className="fa-solid fa-robot mr-2"></i> AI Autopilot: {editingCustomer.aiEnabled ? 'ENGAGED' : 'DISENGAGED'}
                    </button>
                  </div>
              </div>

              <div className="border border-slate-100 rounded-[2.5rem] p-6 md:p-8 space-y-8 bg-slate-50/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Escalation Phase Contacts</h4>
                    <button 
                      type="button" 
                      onClick={syncAllStages}
                      className="mt-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrows-rotate"></i> Bulk sync current contact to all levels
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-slate-100 rounded-xl shadow-sm">
                    {[1,2,3,4,5].map(lvl => (
                      <button 
                        key={lvl}
                        type="button"
                        onClick={() => setActiveStageTab(lvl)}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-black transition-all ${activeStageTab === lvl ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Point Person</label>
                        <input 
                            type="text" 
                            placeholder="Full Name"
                            value={editingCustomer.stageContacts[activeStageTab]?.name || ''} 
                            onChange={(e) => updateStageContact(activeStageTab, 'name', e.target.value)}
                            className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-white text-xs font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Phase Email</label>
                        <input 
                            type="email" 
                            placeholder="email@partner.com"
                            value={editingCustomer.stageContacts[activeStageTab]?.email || ''} 
                            onChange={(e) => updateStageContact(activeStageTab, 'email', e.target.value)}
                            className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-white text-xs font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp/Mobile</label>
                        <input 
                            type="text" 
                            placeholder="+91..."
                            value={editingCustomer.stageContacts[activeStageTab]?.phone || ''} 
                            onChange={(e) => updateStageContact(activeStageTab, 'phone', e.target.value)}
                            className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-white text-xs font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
                        />
                    </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                  <button type="button" onClick={() => setEditingCustomer(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest border border-slate-200">Discard Changes</button>
                  <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                    Commit Updates
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 space-y-8 animate-in zoom-in-95 duration-300">
             <div className="text-center">
                <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-clipboard-list text-2xl text-slate-900"></i></div>
                <h3 className="text-2xl font-black text-slate-900">Manual Activity Log</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Recording interaction with {showLogModal.name}</p>
             </div>
             <textarea 
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="e.g. Discussed payment timeline with accounts head..."
                className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-50 leading-relaxed resize-none"
             />
             <div className="flex gap-4">
                <button onClick={() => setShowLogModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200">Cancel</button>
                <button onClick={handleManualLog} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Save Activity</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
