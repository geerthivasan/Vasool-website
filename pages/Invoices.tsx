
import React, { useState, useRef } from 'react';
import { Invoice, Customer } from '../types';
import { toast } from 'react-hot-toast';
import { extractInvoiceFromText } from '../services/gemini';
import { PROVIDERS, AccountingProvider, connectProvider, syncProviderData, isProviderConnected } from '../services/accounting';
import { getEffectiveStatus, calculateEscalationLevel, getEscalationColor } from '../services/finance';
import { useApp } from '../App';
import * as XLSX from 'xlsx';

const Invoices: React.FC = () => {
  const { user, invoices, setInvoices, customers, setCustomers, escalationProtocol } = useApp();
  const [filter, setFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualLogModal, setShowManualLogModal] = useState<Invoice | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSync, setLastSync] = useState<string>(localStorage.getItem(`vasool_last_sync_${user?.id}`) || 'Never synced');
  
  const [extractedInvoices, setExtractedInvoices] = useState<Partial<Invoice>[]>([]);
  const [currentSyncSource, setCurrentSyncSource] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredInvoices = invoices.filter(inv => {
    const eff = getEffectiveStatus(inv);
    return filter === 'ALL' || eff === filter;
  });

  const updateGlobalLedger = (newRecords: Partial<Invoice>[], source?: any) => {
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
        source: source || (ext as any).source || 'MANUAL',
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

  const handleProviderAction = async (provider: AccountingProvider) => {
    if (isProviderConnected(provider)) handleSync(provider);
    else {
      setIsSyncing(true);
      toast.loading(`Authenticating with ${provider}...`, { id: 'auth-toast' });
      const success = await connectProvider(provider);
      setIsSyncing(false);
      if (success) {
        toast.success(`${provider} Connected!`, { id: 'auth-toast' });
        handleSync(provider);
      }
    }
  };

  const handleSync = async (provider: AccountingProvider) => {
    setIsSyncing(true);
    setCurrentSyncSource(provider.toUpperCase());
    toast.loading(`Fetching ledgers from ${provider}...`, { id: 'sync-toast' });
    try {
      const data = await syncProviderData(provider);
      setExtractedInvoices(data);
      toast.success(`Found ${data.length} records in ${provider}. Review before committing.`, { id: 'sync-toast' });
      const syncTime = `Synced with ${provider} on ${new Date().toLocaleTimeString()}`;
      setLastSync(syncTime);
      localStorage.setItem(`vasool_last_sync_${user?.id}`, syncTime);
    } catch (err) {
      toast.error(`Failed to sync with ${provider}.`, { id: 'sync-toast' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    const toastId = toast.loading(`AI reading patterns...`);
    try {
      const reader = new FileReader();
      const workbookPromise = new Promise<XLSX.WorkBook>((resolve) => {
        reader.onload = (evt) => {
          const data = evt.target?.result;
          resolve(XLSX.read(data, { type: 'array' }));
        };
      });
      reader.readAsArrayBuffer(file);
      const wb = await workbookPromise;
      const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      // Limit to first 100 rows for AI efficiency
      const dataToProcess = jsonData.slice(0, 100);
      const dataArray = await extractInvoiceFromText(JSON.stringify(dataToProcess, null, 2));
      
      if (dataArray && dataArray.length > 0) {
        setExtractedInvoices(dataArray);
        setCurrentSyncSource('EXCEL');
        toast.success(`Extracted ${dataArray.length} potential invoices. Review below.`, { id: toastId });
      } else {
        toast.error("AI couldn't find recognizable invoice patterns in this file.", { id: toastId });
      }
    } catch (err) { 
      toast.error("File processing failed. Ensure it's a valid Excel or CSV.", { id: toastId }); 
    } finally { 
      setIsScanning(false); 
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmBulkInvoices = () => {
    const result = updateGlobalLedger(extractedInvoices, currentSyncSource);
    if (result.added > 0) {
      toast.success(`Imported ${result.added} records successfully!`);
      if (result.skipped > 0) toast(`Skipped ${result.skipped} duplicate entries.`, { icon: 'ℹ️' });
    } else {
      toast.error(result.skipped > 0 ? "All entries in this file already exist in your ledger." : "No new records to add.");
    }
    setExtractedInvoices([]);
    setCurrentSyncSource(null);
    setShowImportModal(false);
  };

  const handleSaveManualLog = () => {
    if (!showManualLogModal || !manualNote) return;
    setInvoices(prev => prev.map(inv => inv.id === showManualLogModal.id ? {
        ...inv,
        manualLogs: [...(inv.manualLogs || []), { date: new Date().toISOString(), note: manualNote, performedBy: user?.fullName || 'User' }]
    } : inv));
    toast.success(`Follow-up logged for Invoice ${showManualLogModal.id}`);
    setShowManualLogModal(null);
    setManualNote('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ledger Hub</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`flex h-1.5 w-1.5 rounded-full ${invoices.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{lastSync}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="bg-white border border-slate-200 text-slate-900 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 text-sm"><i className="fa-solid fa-cloud-arrow-down text-indigo-500"></i> Cloud Sync</button>
          <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 text-sm"><i className="fa-solid fa-plus mr-2"></i> New Entry</button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-fit">
        {['ALL', 'OVERDUE', 'PENDING', 'PAID'].map(f => (
          <button key={f} onClick={() => setFilter(f as any)} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm min-h-[400px]">
        {filteredInvoices.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="px-8 py-5">Escalation</th>
                <th className="px-8 py-5">Entity & Source</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Expected On</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map(inv => {
                const esc = calculateEscalationLevel(inv, escalationProtocol);
                const effStatus = getEffectiveStatus(inv);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="flex gap-1 items-center">
                         {[1,2,3,4,5].map(step => (
                           <div key={step} className={`h-1.5 w-3 rounded-full transition-all ${step <= esc ? getEscalationColor(step as any) : 'bg-slate-100'}`}></div>
                         ))}
                       </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-900">{inv.customerName}</p>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{inv.source}</span>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-900 font-black">₹{inv.amount.toLocaleString()}</td>
                    <td className="px-8 py-5 text-xs text-slate-500 font-medium">{new Date(inv.dueDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        effStatus === 'OVERDUE' ? 'bg-red-50 text-red-600' :
                        effStatus === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {effStatus}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right space-x-1">
                      <button onClick={() => setShowManualLogModal(inv)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Log Follow-up"><i className="fa-solid fa-note-sticky"></i></button>
                      <button onClick={() => setInvoices(invoices.filter(i => i.id !== inv.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-8 bg-slate-50/30">
            <div className="h-20 w-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-6"><i className="fa-solid fa-vault text-3xl text-slate-200"></i></div>
            <h3 className="text-xl font-black text-slate-900">Your Ledger is Empty</h3>
          </div>
        )}
      </div>

      {showManualLogModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 space-y-8 animate-in zoom-in-95 duration-200">
             <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900">Log Manual Follow-up</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Invoice #{showManualLogModal.id}</p>
             </div>
             <textarea 
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Details of the interaction..."
                className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-50"
             />
             <div className="flex gap-4">
                <button onClick={() => setShowManualLogModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleSaveManualLog} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Save Log</button>
             </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-600 text-white">
              <div>
                <h3 className="text-2xl font-black tracking-tight">Sync Engine</h3>
                <p className="text-indigo-100 text-[10px] mt-1 font-bold uppercase tracking-widest">Import from Spreadsheets or Cloud Ledgers</p>
              </div>
              <button onClick={() => { setShowImportModal(false); setExtractedInvoices([]); setCurrentSyncSource(null); }} className="hover:rotate-90 transition-transform"><i className="fa-solid fa-xmark text-3xl"></i></button>
            </div>
            
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {extractedInvoices.length > 0 ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Staged Invoices ({extractedInvoices.length})
                     </h4>
                     <button onClick={() => setExtractedInvoices([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Clear Staging</button>
                   </div>
                   
                   <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 font-black uppercase text-slate-400 text-[9px]">
                          <tr>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Due Date</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {extractedInvoices.map((ext, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-bold text-slate-700">{ext.customerName}</td>
                              <td className="px-4 py-3 font-black text-slate-900">₹{(ext.amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-500">{ext.dueDate}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[8px] font-black uppercase">{ext.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>

                   <button onClick={confirmBulkInvoices} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] text-xs">
                     Confirm & Add to Ledger
                   </button>
                </div>
              ) : (
                <div className="space-y-8">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {PROVIDERS.map(p => (
                       <button key={p.id} onClick={() => handleProviderAction(p.id)} className={`flex flex-col items-center gap-3 p-5 border rounded-3xl transition-all group ${isProviderConnected(p.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                         <div className={`h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm ${p.color} group-hover:scale-110 transition-transform`}><i className={`fa-solid ${p.icon} text-xl`}></i></div>
                         <span className="text-[9px] font-black text-slate-500 uppercase">{p.id}</span>
                       </button>
                     ))}
                   </div>
                   
                   <div className="relative group">
                     <div className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all ${isScanning ? 'bg-slate-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'}`}>
                        <input type="file" ref={fileInputRef} className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} disabled={isScanning} />
                        {isScanning ? (
                          <div className="space-y-4">
                            <i className="fa-solid fa-spinner fa-spin text-4xl text-indigo-500"></i>
                            <p className="text-sm font-black text-indigo-600 animate-pulse uppercase tracking-widest">AI Patterns Detected... Processing</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500 mb-2 group-hover:scale-110 transition-transform">
                              <i className="fa-solid fa-file-excel text-2xl"></i>
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-1">Drag & Drop Spreadsheet</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">Supports Excel (.xlsx, .xls) and CSV</p>
                            </div>
                            
                            <div className="flex items-center justify-center gap-4">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                <span className="text-[10px] font-black text-slate-300 uppercase">OR</span>
                                <div className="h-px bg-slate-100 flex-1"></div>
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="relative z-10 px-8 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-upload mr-2"></i> Select File from Device
                            </button>
                          </div>
                        )}
                     </div>
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
