
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../App';
import { Invoice } from '../../types';
import { toast } from 'react-hot-toast';
import { GoogleGenAI } from '@google/genai';

const CustomerPortal: React.FC = () => {
  const { user, logout, invoices, setInvoices } = useApp();
  const [activeTab, setActiveTab] = useState<'dues' | 'notices' | 'history'>('dues');
  const [showDisputeModal, setShowDisputeModal] = useState<Invoice | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleMode, setSettleMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK' | 'CARD' | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: `Hello ${user?.fullName}! I'm your Vasool Financial Assistant. How can I help you with your account today?` }
  ]);
  const [isChatting, setIsChatting] = useState(false);

  const customerInvoices = useMemo(() => invoices.filter(inv => inv.customerName === user?.businessName), [invoices, user]);
  const totalOutstanding = customerInvoices.reduce((sum, inv) => inv.status !== 'PAID' ? sum + (inv.balance ?? inv.amount) : sum, 0);
  const pendingCount = customerInvoices.filter(i => i.status !== 'PAID').length;

  useEffect(() => {
    if (showSettleModal) {
      setSettleAmount(totalOutstanding);
      setSettleMode('FULL');
      setPaymentMethod(null);
    }
  }, [showSettleModal, totalOutstanding]);

  const handleFinalSettle = async () => {
    if (!paymentMethod || settleAmount <= 0) return;
    setIsProcessingPayment(true);
    const toastId = toast.loading(`Processing Secure ${paymentMethod} Payment...`);
    await new Promise(r => setTimeout(r, 2000));
    setInvoices(prev => prev.map(inv => {
      if (inv.customerName === user?.businessName && inv.status !== 'PAID') {
        return { ...inv, status: 'PAID', balance: 0 };
      }
      return inv;
    }));
    toast.success("Payment Successful! Ledger synchronized.", { id: toastId });
    setShowSettleModal(false);
    setIsProcessingPayment(false);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Assistant for Vasool. Customer: ${user?.fullName} from ${user?.businessName}. Dues: ₹${totalOutstanding}. Query: ${userMsg}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm processing that information..." }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', text: "Service temporarily unavailable." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col animate-in fade-in duration-700 pb-12">
      <header className="bg-white border-b border-slate-200 px-6 md:px-10 py-5 flex justify-between items-center sticky top-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-bolt-lightning"></i></div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-black text-slate-900 tracking-tighter">Partner Portal</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Self-Service Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-black text-slate-900">{user?.fullName}</p>
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{user?.businessName}</p>
          </div>
          <button onClick={logout} className="h-10 w-10 rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><i className="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-10 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Balance Hero */}
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute -right-20 -bottom-20 h-64 w-64 bg-indigo-50 rounded-full blur-[100px]"></div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Current Liability Balance</p>
                <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter">₹{totalOutstanding.toLocaleString()}</h2>
                <div className="flex items-center gap-2 mt-6">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{pendingCount} Open Invoices</p>
                </div>
              </div>
              <button onClick={() => setShowSettleModal(true)} className="w-full md:w-auto bg-indigo-600 text-white px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">Settle Dues</button>
            </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-full md:w-fit overflow-x-auto">
            {[{id:'dues', icon:'fa-receipt'}, {id:'notices', icon:'fa-bell'}, {id:'history', icon:'fa-history'}].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><i className={`fa-solid ${tab.icon}`}></i> {tab.id}</button>
            ))}
          </div>

          <div className="space-y-4">
            {activeTab === 'dues' && (
              customerInvoices.filter(i => i.status !== 'PAID').length > 0 ? (
                customerInvoices.filter(i => i.status !== 'PAID').map(inv => (
                  <div key={inv.id} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:border-indigo-100 transition-all">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      <div className={`h-16 w-16 rounded-3xl flex items-center justify-center text-2xl shadow-lg ${inv.status === 'OVERDUE' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}><i className={`fa-solid ${inv.status === 'OVERDUE' ? 'fa-triangle-exclamation' : 'fa-clock'}`}></i></div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900">Invoice #{inv.id}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900">₹{(inv.balance ?? inv.amount).toLocaleString()}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Settlement</p>
                      </div>
                      <button onClick={() => setShowSettleModal(true)} className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-600 transition-all">Pay</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 text-3xl"><i className="fa-solid fa-circle-check"></i></div>
                  <h4 className="text-2xl font-black text-slate-900">All Clear!</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Your account is in perfect standing</p>
                </div>
              )
            )}
            {activeTab === 'notices' && (
              <div className="bg-indigo-50/50 p-10 rounded-[3rem] border border-indigo-100 text-center">
                <i className="fa-solid fa-envelope-open-text text-4xl text-indigo-400 mb-6"></i>
                <p className="text-sm text-indigo-700 font-bold leading-relaxed italic">"Thank you for being a valued partner. Our records indicate a positive payment trend for Reliance Retail."</p>
                <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-8">Vasool Insight Engine • Just Now</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 flex flex-col h-[550px] overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-900 text-white">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"><i className="fa-solid fa-robot text-indigo-400"></i> Smart Concierge</h3>
              </div>
              <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/20">
                 {chatMessages.map((msg, i) => (
                   <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-5 rounded-2xl text-[11px] font-black leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>{msg.text}</div>
                   </div>
                 ))}
                 {isChatting && <div className="flex justify-start"><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><div className="flex gap-1.5"><div className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce"></div><div className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce delay-75"></div><div className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce delay-150"></div></div></div></div>}
              </div>
              <form onSubmit={handleChat} className="p-5 bg-white border-t border-slate-100"><div className="relative"><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="w-full pl-6 pr-14 py-4 bg-slate-100 border-none rounded-2xl text-xs font-black focus:ring-4 focus:ring-indigo-50 outline-none transition-all" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90"><i className="fa-solid fa-paper-plane text-xs"></i></button></div></form>
           </div>
        </div>
      </div>

      {/* Settlement Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
               <div><h3 className="text-2xl font-black">Secure Checkout</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Vasool Payment Gateway</p></div>
               <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            <div className="p-8 md:p-12 space-y-10">
               <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                 <button onClick={() => { setSettleMode('FULL'); setSettleAmount(totalOutstanding); }} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${settleMode === 'FULL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Full</button>
                 <button onClick={() => setSettleMode('PARTIAL')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${settleMode === 'PARTIAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Partial</button>
               </div>
               <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Checkout Total</p>
                  {settleMode === 'FULL' ? <p className="text-5xl font-black text-slate-900 tracking-tighter">₹{totalOutstanding.toLocaleString()}</p> : <div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400 text-2xl">₹</span><input type="number" value={settleAmount} onChange={(e) => setSettleAmount(Number(e.target.value))} className="w-full pl-12 pr-6 py-6 bg-white border border-slate-200 rounded-3xl font-black text-3xl text-indigo-600 text-center outline-none" /></div>}
               </div>
               <div className="space-y-4">
                 {['UPI', 'BANK', 'CARD'].map(m => (
                   <button key={m} onClick={() => setPaymentMethod(m as any)} className={`flex items-center justify-between w-full p-5 rounded-2xl border transition-all ${paymentMethod === m ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{m} Options</span>
                     {paymentMethod === m && <i className="fa-solid fa-circle-check text-indigo-600"></i>}
                   </button>
                 ))}
               </div>
               <button onClick={handleFinalSettle} disabled={!paymentMethod || isProcessingPayment} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3">
                 {isProcessingPayment ? <i className="fa-solid fa-spinner fa-spin"></i> : `Complete ₹${settleAmount.toLocaleString()}`}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;