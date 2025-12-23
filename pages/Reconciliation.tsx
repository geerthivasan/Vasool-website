
import React, { useState, useRef } from 'react';
import { useApp } from '../App';
import { BankTransaction, Invoice } from '../types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { extractInvoiceFromText, fetchMockBankData } from '../services/gemini';

interface BankOption {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

const Reconciliation: React.FC = () => {
  const { invoices, setInvoices } = useApp();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [credentials, setCredentials] = useState({ userId: '', password: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const majorBanks: BankOption[] = [
    { id: 'hdfc', name: 'HDFC Bank', color: 'bg-blue-900', textColor: 'text-white' },
    { id: 'icici', name: 'ICICI Bank', color: 'bg-orange-600', textColor: 'text-white' },
    { id: 'sbi', name: 'State Bank of India', color: 'bg-blue-600', textColor: 'text-white' },
    { id: 'axis', name: 'Axis Bank', color: 'bg-rose-900', textColor: 'text-white' },
    { id: 'kotak', name: 'Kotak Mahindra', color: 'bg-red-600', textColor: 'text-white' },
    { id: 'indusind', name: 'IndusInd Bank', color: 'bg-amber-800', textColor: 'text-white' },
  ];

  const handleBankSelect = (bank: BankOption) => {
    setSelectedBank(bank);
    setShowBankSelector(false);
    setShowLoginModal(true);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.userId || !credentials.password) {
      toast.error("Please provide both User ID and Password.");
      return;
    }

    setShowLoginModal(false);
    setIsSyncing(true);
    const toastId = toast.loading(`Connecting to ${selectedBank?.name} Secure Feed...`);

    try {
      // Simulated OAuth/Authentication Latency
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const bankData = await fetchMockBankData(selectedBank?.name || "Bank");
      setTransactions(prev => [...bankData, ...prev]);
      
      toast.success(`${selectedBank?.name} Feed Connected! Found ${bankData.length} new transactions.`, { id: toastId });
    } catch (err) {
      toast.error("Failed to connect to bank feed.", { id: toastId });
    } finally {
      setIsSyncing(false);
      setCredentials({ userId: '', password: '' });
    }
  };

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tid = toast.loading("Gemini AI matching transactions...");
    
    // Mock parsing
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTransactions(prev => [
        { id: `TXN-EXT-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: 'UPI: ZOMATO SETTLEMENT', amount: 32000, status: 'SUGGESTED' },
        ...prev
    ]);
    toast.success("Statement Processed.", { id: tid });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const reconcile = (txn: BankTransaction) => {
    const matchedInvoice = invoices.find(inv => 
      (inv.amount === txn.amount || (inv.balance && inv.balance === txn.amount)) && 
      inv.status !== 'PAID'
    );
    
    if (matchedInvoice) {
        setInvoices(prev => prev.map(inv => inv.id === matchedInvoice.id ? { ...inv, status: 'PAID', balance: 0 } : inv));
        setTransactions(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'RECONCILED' } : t));
        toast.success(`Matched ${txn.description} with Invoice ${matchedInvoice.id}`);
    } else {
        toast.error("No exact amount match found in ledger. Try manual match.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Reconciliation</h2>
          <p className="text-sm text-slate-500 font-medium">Verify payments and clear your ledger automatically.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all"
          >
            <i className="fa-solid fa-file-import mr-2 text-indigo-500"></i> Upload Statement
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleStatementUpload} />
          <button 
            onClick={() => setShowBankSelector(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <i className="fa-solid fa-building-columns mr-2"></i> Connect Bank Feed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Unreconciled Bank Feed</h3>
                <span className="text-[10px] font-bold text-slate-400">{transactions.length} Transactions Found</span>
            </div>
            
            {transactions.length > 0 ? (
                <div className="divide-y divide-slate-50">
                    {transactions.map(txn => (
                        <div key={txn.id} className="p-8 hover:bg-slate-50/50 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-6">
                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-lg ${txn.status === 'RECONCILED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <i className={`fa-solid ${txn.status === 'RECONCILED' ? 'fa-check-double' : 'fa-receipt'}`}></i>
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900">{txn.description}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{txn.date} • ₹{txn.amount.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                {txn.status === 'SUGGESTED' && (
                                    <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-500">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-indigo-500 uppercase">AI Match Detected</p>
                                            <p className="text-[11px] font-bold text-slate-600 italic">Found ledger candidate</p>
                                        </div>
                                        <button 
                                            onClick={() => reconcile(txn)}
                                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
                                        >
                                            Clear Entry
                                        </button>
                                    </div>
                                )}
                                {txn.status === 'UNMATCHED' && (
                                    <button className="text-[9px] font-black text-slate-400 uppercase border border-slate-100 px-4 py-2 rounded-lg hover:bg-white transition-all">Manual Match</button>
                                )}
                                {txn.status === 'RECONCILED' && (
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl">Reconciled</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-24 text-center">
                    <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200 text-4xl">
                        <i className="fa-solid fa-magnifying-glass-dollar"></i>
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending transactions</p>
                    <p className="text-[10px] text-slate-300 mt-2">Connect your bank or upload a statement to start matching.</p>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
                <h3 className="text-xl font-black mb-4">Direct Bank Access</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Vasool integrates directly with 40+ Indian banks including HDFC, ICICI, and SBI to pull real-time cash inflows.</p>
                <div className="flex gap-2">
                    {majorBanks.slice(0, 4).map(b => (
                        <div key={b.id} className={`h-10 px-3 rounded-lg ${b.color} ${b.textColor} flex items-center justify-center font-bold text-[8px] uppercase tracking-widest border border-white/10`}>
                            {b.name}
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-white">
                <h3 className="text-xl font-black mb-4">AI Statement Engine</h3>
                <p className="text-indigo-100 text-sm leading-relaxed mb-8">Our proprietary Gemini-based logic reads messy description fields to correctly identify customers even with partial names.</p>
                <button className="bg-white/10 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/20">Learn More</button>
            </div>
        </div>
      </div>

      {/* Bank Selector Modal */}
      {showBankSelector && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Choose Your Institution</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Select a bank to connect your live ledger feed</p>
              </div>
              <button onClick={() => setShowBankSelector(false)} className="text-slate-400 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>
            <div className="p-10 grid grid-cols-2 md:grid-cols-3 gap-4">
              {majorBanks.map(bank => (
                <button 
                  key={bank.id}
                  onClick={() => handleBankSelect(bank)}
                  className={`flex flex-col items-center gap-4 p-6 rounded-[2rem] border border-slate-100 transition-all hover:border-indigo-500 hover:bg-slate-50 group`}
                >
                  <div className={`h-14 w-14 rounded-2xl ${bank.color} ${bank.textColor} flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                    {bank.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest text-center">{bank.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bank Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[210] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 ${selectedBank?.color} ${selectedBank?.textColor} flex justify-between items-center`}>
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-lock"></i>
                <h3 className="text-lg font-black uppercase tracking-widest">{selectedBank?.name} Login</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="opacity-50 hover:opacity-100">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleLoginSubmit} className="p-10 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Customer ID / User ID</label>
                  <input 
                    type="text" 
                    value={credentials.userId}
                    onChange={(e) => setCredentials({...credentials, userId: e.target.value})}
                    className="w-full px-5 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none"
                    placeholder="Enter ID"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password / PIN</label>
                  <input 
                    type="password" 
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    className="w-full px-5 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-50 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                <i className="fa-solid fa-shield-halved text-amber-500 mt-1"></i>
                <p className="text-[9px] text-amber-700 font-medium leading-relaxed">Vasool uses bank-grade 256-bit AES encryption. We do not store your banking passwords locally or on our servers.</p>
              </div>
              <button 
                type="submit"
                className={`w-full py-4 ${selectedBank?.color} ${selectedBank?.textColor} rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] hover:opacity-90`}
              >
                Secure Authorize
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
