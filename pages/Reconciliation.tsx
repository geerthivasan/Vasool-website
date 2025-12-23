
import React, { useState, useRef } from 'react';
import { useApp } from '../App';
import { BankTransaction, Invoice } from '../types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { extractInvoiceFromText } from '../services/gemini';

const Reconciliation: React.FC = () => {
  const { invoices, setInvoices } = useApp();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBankConnect = async () => {
    setIsSyncing(true);
    toast.loading("Connecting to HDFC NetBanking API...", { id: 'bank-sync' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock transactions
    const mockTrans: BankTransaction[] = [
      { id: 'TXN1', date: '2025-10-28', description: 'NEFT FROM RELIANCE RETAIL', amount: 45000, status: 'SUGGESTED' },
      { id: 'TXN2', date: '2025-10-29', description: 'UPI TRANSFER: ADITYA BIRLA', amount: 12500, status: 'UNMATCHED' },
      { id: 'TXN3', date: '2025-10-30', description: 'CHQ DEPOSIT: TATA MOTORS', amount: 89000, status: 'SUGGESTED' },
    ];
    
    setTransactions(mockTrans);
    setIsSyncing(false);
    toast.success("Bank Feed Synced.", { id: 'bank-sync' });
  };

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.loading("Gemini AI matching transactions...", { id: 'match-sync' });
    
    // Mock parsing
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTransactions([
        { id: 'TXN4', date: '2025-11-01', description: 'ONLINE TRANSFER: ZOMATO LTD', amount: 32000, status: 'SUGGESTED' }
    ]);
    toast.success("Statement Processed.", { id: 'match-sync' });
  };

  const reconcile = (txn: BankTransaction) => {
    const matchedInvoice = invoices.find(inv => inv.amount === txn.amount && inv.status !== 'PAID');
    if (matchedInvoice) {
        setInvoices(prev => prev.map(inv => inv.id === matchedInvoice.id ? { ...inv, status: 'PAID', balance: 0 } : inv));
        setTransactions(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'RECONCILED' } : t));
        toast.success(`Matched ${txn.description} with Invoice ${matchedInvoice.id}`);
    } else {
        toast.error("No exact amount match found in ledger.");
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
            <i className="fa-solid fa-file-import mr-2"></i> Upload Statement
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleStatementUpload} />
          <button 
            onClick={handleBankConnect}
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
                                            <p className="text-[11px] font-bold text-slate-600 italic">Found 1 ledger entry</p>
                                        </div>
                                        <button 
                                            onClick={() => reconcile(txn)}
                                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
                                        >
                                            Clear Invoice
                                        </button>
                                    </div>
                                )}
                                {txn.status === 'UNMATCHED' && (
                                    <button className="text-[9px] font-black text-slate-400 uppercase border border-slate-100 px-4 py-2 rounded-lg hover:bg-white transition-all">Manual Match</button>
                                )}
                                {txn.status === 'RECONCILED' && (
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl">Processed</span>
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
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending transactions to reconcile</p>
                    <p className="text-[10px] text-slate-300 mt-2">Connect your bank or upload a statement to start matching.</p>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
                <h3 className="text-xl font-black mb-4">Direct Bank Access</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Vasool integrates directly with 40+ Indian banks including HDFC, ICICI, and SBI to pull real-time cash inflows.</p>
                <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-12 w-12 rounded-full border-4 border-slate-900 bg-slate-800 flex items-center justify-center font-bold text-xs">Bank</div>)}
                </div>
            </div>
            <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-white">
                <h3 className="text-xl font-black mb-4">AI Statement Engine</h3>
                <p className="text-indigo-100 text-sm leading-relaxed mb-8">Our proprietary Gemini-based logic reads messy description fields to correctly identify customers even with partial names.</p>
                <button className="bg-white/10 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/20">Learn More</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reconciliation;
