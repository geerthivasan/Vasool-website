
import React, { useState, useRef, useMemo } from 'react';
import { Invoice, Customer } from '../types';
import { toast } from 'react-hot-toast';
import { extractInvoiceFromText } from '../services/gemini';
import { PROVIDERS, AccountingProvider, connectProvider, syncProviderData, isProviderConnected } from '../services/accounting';
import { getEffectiveStatus, calculateEscalationLevel, getEscalationColor, calculateDynamicRisk } from '../services/finance';
import { useApp } from '../App';
import * as XLSX from 'xlsx';

const Invoices: React.FC = () => {
  const { user, invoices, setInvoices, customers, setCustomers, escalationProtocol } = useApp();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID'>('ALL');
  const [stageFilter, setStageFilter] = useState<number | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'low' | 'medium' | 'high'>('ALL');
  const [maxAmountFilter, setMaxAmountFilter] = useState<number | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualLogModal, setShowManualLogModal] = useState<Invoice | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>(localStorage.getItem(`vasool_last_sync_${user?.id}`) || 'Never synced');
  
  // Sync Staging & OAuth State
  const [extractedInvoices, setExtractedInvoices] = useState<Partial<Invoice>[]>([]);
  const [currentSyncSource, setCurrentSyncSource] = useState<string | null>(null);
  const [oauthModal, setOauthModal] = useState<{ provider: any; step: 'LOGIN' | 'CONSENT' | 'REDIRECT' } | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [newInvoiceData, setNewInvoiceData] = useState({ customerName: '', amount: '', dueDate: new Date().toISOString().split('T')[0] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxAvailableAmount = useMemo(() => {
    if (invoices.length === 0) return 100000;
    return Math.max(...invoices.map(i => i.amount));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const effStatus = getEffectiveStatus(inv);
      const stage = calculateEscalationLevel(inv, escalationProtocol);
      const overdueDays = effStatus === 'OVERDUE' ? Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const risk = calculateDynamicRisk(inv.balance || inv.amount, overdueDays, escalationProtocol);
      return (statusFilter === 'ALL' || effStatus === statusFilter) &&
             (stageFilter === 'ALL' || stage === stageFilter) &&
             (riskFilter === 'ALL' || risk === riskFilter) &&
             (maxAmountFilter === null || inv.amount <= maxAmountFilter);
    });
  }, [invoices, statusFilter, stageFilter, riskFilter, maxAmountFilter, escalationProtocol]);

  // Logic: Master Ledger Update
  const updateGlobalLedger = (newRecords: Partial<Invoice>[], source?: string) => {
    const finalInvoiceRecords: Invoice[] = [];
    const newCustomerRecords: Customer[] = [];
    let duplicateCount = 0;

    newRecords.forEach((ext, idx) => {
      const isDuplicate = invoices.some(existing => 
        (existing.externalId && ext.externalId && existing.externalId === ext.externalId) ||
        (existing.customerName.toLowerCase() === (ext.customerName || '').toLowerCase() &&
         existing.amount === ext.amount &&
         existing.dueDate === ext.dueDate)
      );

      if (isDuplicate) {
        duplicateCount++;
        return;
      }

      const invoice: Invoice = {
        id: ext.id || `SYNC-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${idx}`,
        externalId: ext.externalId,
        source: (source || ext.source || 'MANUAL') as any,
        customerName: ext.customerName || 'Unknown Customer',
        amount: ext.amount || 0,
        balance: ext.balance ?? (ext.amount || 0),
        currency: ext.currency || 'INR',
        dueDate: ext.dueDate || new Date().toISOString().split('T')[0],
        status: (ext.status as any) || 'PENDING',
        isEmailed: ext.isEmailed ?? false,
        probabilityOfPayment: 0.85,
        escalationLevel: 0,
        manualLogs: []
      };
      
      invoice.escalationLevel = calculateEscalationLevel(invoice, escalationProtocol);
      finalInvoiceRecords.push(invoice);

      const existingCust = customers.find(c => c.name.toLowerCase() === invoice.customerName.toLowerCase());
      if (!existingCust) {
        newCustomerRecords.push({
          id: `CUST-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          name: invoice.customerName,
          contactPerson: 'Contact needed',
          email: 'N/A',
          phone: 'N/A',
          totalOutstanding: invoice.amount,
          riskLevel: 'medium',
          lastFollowUp: 'Never',
          currentEscalation: invoice.escalationLevel,
          aiEnabled: true,
          stageContacts: {}
        });
      }
    });
    
    if (finalInvoiceRecords.length > 0) {
      setInvoices(prev => [...finalInvoiceRecords, ...prev]);
      if (newCustomerRecords.length > 0) setCustomers(prev => [...prev, ...newCustomerRecords]);
      return { added: finalInvoiceRecords.length, skipped: duplicateCount };
    }
    return { added: 0, skipped: duplicateCount };
  };

  const handleProviderAction = async (provider: any) => {
    if (isProviderConnected(provider.id)) {
      handleSync(provider.id);
    } else {
      setOauthModal({ provider, step: 'LOGIN' });
    }
  };

  const startOAuthFlow = async () => {
    if (!oauthModal) return;
    setOauthLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setOauthModal({ ...oauthModal, step: 'CONSENT' });
    setOauthLoading(false);
  };

  const authorizeOAuth = async () => {
    if (!oauthModal) return;
    setOauthLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setOauthModal({ ...oauthModal, step: 'REDIRECT' });
    await new Promise(r => setTimeout(r, 800));
    await connectProvider(oauthModal.provider.id);
    const provId = oauthModal.provider.id;
    setOauthModal(null);
    setOauthLoading(false);
    toast.success(`${provId} Connected!`);
    handleSync(provId);
  };

  const handleSync = async (providerId: AccountingProvider) => {
    setIsSyncing(true);
    setCurrentSyncSource(providerId.toUpperCase());
    const toastId = toast.loading(`Synchronizing ${providerId} cloud data...`);
    try {
      const data = await syncProviderData(providerId);
      setExtractedInvoices(data);
      toast.success(`Fetched ${data.length} records.`, { id: toastId });
      const syncTime = `Synced with ${providerId} on ${new Date().toLocaleTimeString()}`;
      setLastSync(syncTime);
      localStorage.setItem(`vasool_last_sync_${user?.id}`, syncTime);
    } catch (err) {
      toast.error(`Sync failed for ${providerId}.`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmBulkInvoices = () => {
    const result = updateGlobalLedger(extractedInvoices, currentSyncSource || 'CLOUD');
    if (result.added > 0) {
      toast.success(`Ledger committed: ${result.added} items.`);
    } else if (result.skipped > 0) {
      toast("No new items found.", { icon: 'ℹ️' });
    }
    setExtractedInvoices([]);
    setShowImportModal(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    const toastId = toast.loading(`AI reading patterns...`);
    try {
      const reader = new FileReader();
      const workbookPromise = new Promise<XLSX.WorkBook>((resolve, reject) => {
        reader.onload = (evt) => {
          try {
            const arrayBuffer = evt.target?.result as ArrayBuffer;
            const data = new Uint8Array(arrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            resolve(wb);
          } catch (readErr) {
            reject(readErr);
          }
        };
        reader.onerror = (err) => reject(err);
      });
      
      reader.readAsArrayBuffer(file);
      const wb = await workbookPromise;
      
      const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      // FIX: Increased the slice to 500 to handle larger spreadsheets without skipping records.
      // Gemini's context window is sufficient for several hundred rows of JSON.
      const dataArray = await extractInvoiceFromText(JSON.stringify(jsonData.slice(0, 500), null, 2));
      
      if (dataArray && dataArray.length > 0) {
        setExtractedInvoices(dataArray);
        setCurrentSyncSource('EXCEL');
        toast.success(`AI recognized ${dataArray.length} items.`, { id: toastId });
      } else {
        toast.error("No recognizable invoices found.", { id: toastId });
      }
    } catch (err) { 
      console.error("XLSX Parse Error:", err);
      toast.error("File processing failed. Please ensure it is a valid Excel or CSV file.", { id: toastId }); 
    } finally { 
      setIsScanning(false); 
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceData.customerName || !newInvoiceData.amount) return;
    const amountNum = parseFloat(newInvoiceData.amount);
    // Fix: Typo in 'probabilityOfPayment' property name (was 'probability of payment')
    const newInvoice: Invoice = {
      id: `INV-${Math.floor(Math.random() * 10000)}`,
      customerName: newInvoiceData.customerName, amount: amountNum, balance: amountNum, currency: 'INR',
      dueDate: newInvoiceData.dueDate, status: 'PENDING', isEmailed: false, probabilityOfPayment: 0.8,
      escalationLevel: 0, manualLogs: [], source: 'MANUAL'
    };
    newInvoice.escalationLevel = calculateEscalationLevel(newInvoice, escalationProtocol);
    setInvoices(prev => [newInvoice, ...prev]);
    setShowAddModal(false);
    toast.success("Invoice committed to ledger.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Ledger Hub</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{lastSync}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowImportModal(true)} className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-2xl font-black shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"><i className="fa-solid fa-cloud-arrow-down text-indigo-500"></i> Cloud Sync</button>
          <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 text-[10px] uppercase tracking-widest"><i className="fa-solid fa-plus mr-2"></i> New Entry</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Payment Status</label>
            <div className="flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              {['ALL', 'OVERDUE', 'PAID'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f as any)} className={`flex-1 px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${statusFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Escalation Stage</label>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-50 transition-all">
              <option value="ALL">All Stages</option>
              {[0, 1, 2, 3, 4, 5].map(s => <option key={s} value={s}>Stage {s}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Risk Profile</label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as any)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-50 transition-all">
              <option value="ALL">All Risks</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>

          <div className="space-y-4 pb-2">
             <div className="flex justify-between items-center ml-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount Cap</label>
               <span className="text-[11px] font-black text-indigo-600">₹{(maxAmountFilter || maxAvailableAmount).toLocaleString()}</span>
             </div>
             <input type="range" min="0" max={maxAvailableAmount} step="1000" value={maxAmountFilter || maxAvailableAmount} onChange={(e) => setMaxAmountFilter(Number(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto custom-scrollbar">
          {filteredInvoices.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <tr>
                  <th className="px-6 md:px-10 py-6">Timeline Stage</th>
                  <th className="px-6 md:px-10 py-6">Partner Identity</th>
                  <th className="px-6 md:px-10 py-6">Amount</th>
                  <th className="px-6 md:px-10 py-6">Due Date</th>
                  <th className="px-6 md:px-10 py-6">Status</th>
                  <th className="px-6 md:px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => {
                  const esc = calculateEscalationLevel(inv, escalationProtocol);
                  const effStatus = getEffectiveStatus(inv);
                  const risk = calculateDynamicRisk(inv.balance || inv.amount, 0, escalationProtocol);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 md:px-10 py-6">
                         <div className="flex flex-col gap-2">
                           <div className="flex gap-1">
                             {[1,2,3,4,5].map(step => <div key={step} className={`h-1.5 w-4 rounded-full ${step <= esc ? getEscalationColor(step as any) : 'bg-slate-100'}`}></div>)}
                           </div>
                           <span className="text-[9px] font-black text-slate-400 uppercase">Stage {esc}</span>
                         </div>
                      </td>
                      <td className="px-6 md:px-10 py-6">
                        <p className="text-sm font-black text-slate-900">{inv.customerName}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase border ${risk === 'high' ? 'text-red-600 border-red-100 bg-red-50' : 'text-emerald-600 border-emerald-100 bg-emerald-50'}`}>{risk} risk</span>
                      </td>
                      <td className="px-6 md:px-10 py-6 text-sm text-slate-900 font-black">₹{inv.amount.toLocaleString()}</td>
                      <td className="px-6 md:px-10 py-6 text-xs text-slate-500 font-bold uppercase tracking-wider">{new Date(inv.dueDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                      <td className="px-6 md:px-10 py-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${effStatus === 'OVERDUE' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{effStatus}</span>
                      </td>
                      <td className="px-6 md:px-10 py-6 text-right space-x-1">
                        <button onClick={() => setShowManualLogModal(inv)} className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><i className="fa-solid fa-note-sticky"></i></button>
                        <button onClick={() => setInvoices(invoices.filter(i => i.id !== inv.id))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><i className="fa-solid fa-trash-can"></i></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center px-10">
              <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8"><i className="fa-solid fa-filter-circle-xmark text-4xl text-slate-200"></i></div>
              <h3 className="text-2xl font-black text-slate-900">Filtered Silence</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-[0.2em]">Adjust your criteria to reveal matching ledger records</p>
            </div>
          )}
        </div>
      </div>

      {/* Sync Engine Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 bg-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Sync Engine</h3>
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Cloud Ledgers & Spreadsheets</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="hover:rotate-90 transition-transform"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            
            <div className="p-8 md:p-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {extractedInvoices.length > 0 ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Staged Records ({extractedInvoices.length})</h4>
                     <button onClick={() => setExtractedInvoices([])} className="text-[10px] font-black text-rose-600 uppercase hover:underline">Clear Staging</button>
                   </div>
                   <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 font-black uppercase text-slate-400">
                          <tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {extractedInvoices.map((ext, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-black text-slate-700">{ext.customerName}</td>
                              <td className="px-4 py-3 font-black text-indigo-600">₹{(ext.amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-500 font-bold">{ext.dueDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                   <button onClick={confirmBulkInvoices} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all">Confirm Commit</button>
                </div>
              ) : (
                <div className="space-y-12">
                   <div>
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 ml-1">Direct Cloud Integration</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {PROVIDERS.map(p => (
                         <button key={p.id} onClick={() => handleProviderAction(p)} className={`flex flex-col items-center gap-4 p-6 rounded-[2rem] border transition-all ${isProviderConnected(p.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-600'} group`}>
                           <div className={`h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-xl ${p.color} group-hover:scale-110 transition-transform`}><i className={`fa-solid ${p.icon}`}></i></div>
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.id}</span>
                         </button>
                       ))}
                     </div>
                   </div>
                   
                   <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Manual Data Import</h4>
                     <div className="relative group">
                       <div className={`border-2 border-dashed rounded-[2.5rem] p-12 text-center transition-all ${isScanning ? 'bg-slate-50 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'}`}>
                          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="space-y-6 relative z-0">
                             <div className="h-16 w-16 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto text-indigo-500 text-2xl group-hover:scale-110 transition-transform">
                               <i className={`fa-solid ${isScanning ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i>
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-700 uppercase tracking-widest">{isScanning ? 'AI Analyzing Patterns...' : 'Drop Ledger Spreadsheet'}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">XLSX, XLS, or CSV supported</p>
                             </div>
                             <div className="flex items-center justify-center gap-4">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                <span className="text-[9px] font-black text-slate-300 uppercase">OR</span>
                                <div className="h-px bg-slate-100 flex-1"></div>
                             </div>
                             <button 
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="relative z-20 px-8 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                             >
                               Select File from Device
                             </button>
                          </div>
                       </div>
                     </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OAuth Handshake simulation restored and enhanced */}
      {oauthModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-8 ${oauthModal.provider.color.replace('text-', 'bg-')} text-white flex justify-between items-center`}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                  <i className={`fa-solid ${oauthModal.provider.icon}`}></i>
                </div>
                <div>
                  <h3 className="text-xl font-black">{oauthModal.provider.name} Auth</h3>
                  <p className="text-white/60 text-[8px] uppercase font-bold tracking-widest">OAuth 2.0 Secure Channel</p>
                </div>
              </div>
              <button onClick={() => setOauthModal(null)} className="opacity-50 hover:opacity-100 transition-opacity"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            <div className="p-10 space-y-8">
              {oauthModal.step === 'LOGIN' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2">
                   <div className="text-center">
                     <h4 className="text-xl font-black text-slate-900">Sign in to {oauthModal.provider.name}</h4>
                     <p className="text-xs text-slate-500 mt-2">Vasool is requesting access to your accounting ledgers.</p>
                   </div>
                   <div className="space-y-4">
                     <input readOnly type="text" value={user?.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-400" />
                     <input type="password" placeholder="Account Password" defaultValue="••••••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-50" />
                   </div>
                   <button onClick={startOAuthFlow} disabled={oauthLoading} className={`w-full py-5 ${oauthModal.provider.color.replace('text-', 'bg-')} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all`}>
                    {oauthLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Log In & Continue'}
                   </button>
                </div>
              )}
              {oauthModal.step === 'CONSENT' && (
                <div className="space-y-8 animate-in slide-in-from-right-2">
                   <div className="flex items-center justify-center gap-6">
                      <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl text-2xl"><i className="fa-solid fa-bolt-lightning"></i></div>
                      <i className="fa-solid fa-right-left text-slate-300 text-xl"></i>
                      <div className={`h-16 w-16 ${oauthModal.provider.color.replace('text-', 'bg-')} rounded-2xl flex items-center justify-center text-white shadow-xl text-2xl`}><i className={`fa-solid ${oauthModal.provider.icon}`}></i></div>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-widest">Requested Permissions</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-[11px] font-bold text-slate-600">
                          <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                          Read all invoice and payment records
                        </li>
                        <li className="flex items-start gap-3 text-[11px] font-bold text-slate-600">
                          <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                          Access partner entity directory
                        </li>
                        <li className="flex items-start gap-3 text-[11px] font-bold text-slate-600">
                          <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                          Synchronize multi-currency ledgers
                        </li>
                      </ul>
                   </div>
                   <div className="flex gap-4">
                     <button onClick={() => setOauthModal(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Deny Access</button>
                     <button onClick={authorizeOAuth} disabled={oauthLoading} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
                      {oauthLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Authorize Sync'}
                     </button>
                   </div>
                </div>
              )}
              {oauthModal.step === 'REDIRECT' && (
                 <div className="py-16 text-center space-y-8 animate-in zoom-in-95">
                    <div className="h-28 w-28 bg-slate-50 rounded-full flex items-center justify-center mx-auto relative">
                       <i className="fa-solid fa-shield-check text-emerald-500 text-6xl"></i>
                       <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Establishing Connection...</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Exchanging Security Keys</p>
                    </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
