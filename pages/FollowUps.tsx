
import React, { useState, useMemo } from 'react';
import { FollowUp, Customer, EscalationLevel, PaymentPlan, EscalationProtocol, CommChannel, StageContact, Invoice } from '../types';
import { toast } from 'react-hot-toast';
import { useApp } from '../App';
import { generateReminderAudio, generateReminderText, generatePaymentPlan, analyzeCustomerResponse } from '../services/gemini';
import { calculateEscalationLevel, getEscalationColor, getEffectiveStatus, getLevelChannel } from '../services/finance';

type FollowUpTab = 'pipeline' | 'activity' | 'matrix';

const FollowUps: React.FC = () => {
  const { invoices, setInvoices, customers, setCustomers, escalationProtocol, setEscalationProtocol, user } = useApp();
  const [activeTab, setActiveTab] = useState<FollowUpTab>('pipeline');
  const [activityLog, setActivityLog] = useState<FollowUp[]>([]);
  const [activeCall, setActiveCall] = useState<{ customer: string; status: string; tone: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: PaymentPlan; customer: Customer } | null>(null);
  const [showResponseModal, setShowResponseModal] = useState<FollowUp | null>(null);
  const [responseInput, setResponseInput] = useState('');
  
  // Remind Workflow State
  const [remindTarget, setRemindTarget] = useState<any>(null);
  const [composingChannel, setComposingChannel] = useState<CommChannel | null>(null);
  const [validationDraft, setValidationDraft] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [recipientContact, setRecipientContact] = useState<{ name: string; detail: string } | null>(null);
  const [showContactFix, setShowContactFix] = useState(false);
  const [fixData, setFixData] = useState({ email: '', phone: '' });

  // Payment Tracking State
  const [paymentTarget, setPaymentTarget] = useState<any>(null);
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState<number>(0);

  const [tempProtocol, setTempProtocol] = useState<EscalationProtocol>(escalationProtocol);

  const suggestedReminders = useMemo(() => {
    const uniqueNames = Array.from(new Set([
        ...customers.map(c => c.name.toLowerCase()),
        ...invoices.map(i => i.customerName.toLowerCase())
    ]));

    return uniqueNames
      .map(nameKey => {
        const customerInvoices = invoices.filter(inv => inv.customerName.toLowerCase() === nameKey && getEffectiveStatus(inv) !== 'PAID');
        const overdueAmount = customerInvoices.reduce((sum, inv) => sum + (inv.balance ?? inv.amount), 0);
        if (overdueAmount === 0) return null;

        const levels = customerInvoices.map(inv => calculateEscalationLevel(inv, escalationProtocol));
        const currentLevel = Math.max(...levels) as EscalationLevel;
        const channel = getLevelChannel(currentLevel, escalationProtocol) as CommChannel;

        const fullCustomer = customers.find(c => c.name.toLowerCase() === nameKey);
        
        return {
          customer: fullCustomer || {
            id: `virtual-${nameKey}`,
            name: invoices.find(i => i.customerName.toLowerCase() === nameKey)?.customerName || nameKey,
            phone: '',
            email: '',
            contactPerson: 'Contact Person'
          },
          amount: overdueAmount,
          count: customerInvoices.length,
          level: currentLevel,
          type: channel
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.level - a!.level) as any[];
  }, [customers, invoices, escalationProtocol]);

  const startRemindWorkflow = (rem: any) => {
    setRemindTarget(rem);
    setComposingChannel(null);
    setValidationDraft('');
    setRecipientContact(null);
    setShowContactFix(false);
  };

  const handleChannelSelect = async (channel: CommChannel) => {
    if (!remindTarget) return;

    setComposingChannel(channel);
    
    // Identify the best contact for this specific escalation level
    const stageContact: StageContact | undefined = remindTarget.customer.stageContacts?.[remindTarget.level];
    const contactName = stageContact?.name || remindTarget.customer.contactPerson || remindTarget.customer.name;
    const contactDetail = (channel === 'EMAIL') 
      ? (stageContact?.email || remindTarget.customer.email)
      : (stageContact?.phone || remindTarget.customer.phone);

    // Requirement: Check if contact info is available
    if (!contactDetail || contactDetail === 'N/A') {
      setRecipientContact({ name: contactName, detail: '' });
      setFixData({ 
        email: remindTarget.customer.email === 'N/A' ? '' : remindTarget.customer.email, 
        phone: remindTarget.customer.phone === 'N/A' ? '' : remindTarget.customer.phone 
      });
      setShowContactFix(true);
      return;
    }

    setRecipientContact({ name: contactName, detail: contactDetail });
    generateAiDraft(channel, contactName);
  };

  const generateAiDraft = async (channel: CommChannel, contactName: string) => {
    setIsComposing(true);
    const toastId = toast.loading(`AI Drafting ${channel} notice...`);
    
    try {
      const tone = remindTarget.level >= 4 ? 'Firm & Urgent' : (remindTarget.level >= 3 ? 'Professional' : 'Friendly');
      let message = await generateReminderText(channel, contactName, remindTarget.amount, tone);
      
      const payLink = `https://vasool.in/pay/${remindTarget.customer.id.substring(0, 8)}`;
      message = message.replace('[PAYMENT_LINK]', payLink);

      setValidationDraft(message);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error("Failed to compose draft.", { id: toastId });
      setComposingChannel(null);
    } finally {
      setIsComposing(false);
    }
  };

  const handleSaveFixData = () => {
    if (!fixData.email && composingChannel === 'EMAIL') {
      toast.error("Email is required for this channel.");
      return;
    }
    if (!fixData.phone && (composingChannel === 'WHATSAPP' || composingChannel === 'SMS' || composingChannel === 'CALL')) {
      toast.error("Phone number is required for this channel.");
      return;
    }

    // Update global customer state
    setCustomers(prev => prev.map(c => c.id === remindTarget.customer.id ? {
      ...c,
      email: fixData.email || c.email,
      phone: fixData.phone || c.phone
    } : c));

    const updatedDetail = composingChannel === 'EMAIL' ? fixData.email : fixData.phone;
    setRecipientContact(prev => prev ? { ...prev, detail: updatedDetail } : null);
    setShowContactFix(false);
    
    const contactName = recipientContact?.name || remindTarget.customer.name;
    generateAiDraft(composingChannel!, contactName);
    toast.success("Contact details updated locally.");
  };

  const finalizeReminder = () => {
    if (!validationDraft || !composingChannel || !remindTarget) return;

    const encodedMessage = encodeURIComponent(validationDraft);
    const destination = recipientContact?.detail || '';
    
    if (composingChannel === 'WHATSAPP') {
      window.open(`https://wa.me/${destination.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
    } else if (composingChannel === 'EMAIL') {
      window.location.href = `mailto:${destination}?subject=Payment Reminder: ${remindTarget.customer.name}&body=${encodedMessage}`;
    } else if (composingChannel === 'SMS') {
      window.location.href = `sms:${destination.replace(/\D/g, '')}?body=${encodedMessage}`;
    } else if (composingChannel === 'CALL') {
      window.location.href = `tel:${destination.replace(/\D/g, '')}`;
    }

    const newLog: FollowUp = {
      id: Date.now().toString(),
      customerId: remindTarget.customer.id,
      customerName: remindTarget.customer.name,
      type: composingChannel,
      status: 'SENT',
      timestamp: new Date().toLocaleTimeString(),
      message: validationDraft,
      escalationLevel: remindTarget.level
    };

    setActivityLog(prev => [newLog, ...prev]);
    toast.success(`${composingChannel} dispatched.`);
    
    setRemindTarget(null);
    setComposingChannel(null);
    setValidationDraft('');
  };

  const handleMarkPayment = () => {
    if (!paymentTarget) return;
    
    const totalToPay = paymentType === 'FULL' ? paymentTarget.amount : partialAmount;
    if (totalToPay <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    let remainingPayment = totalToPay;
    const updatedInvoices = invoices.map(inv => {
      if (inv.customerName.toLowerCase() === paymentTarget.customer.name.toLowerCase() && getEffectiveStatus(inv) !== 'PAID') {
        const currentBalance = inv.balance ?? inv.amount;
        if (remainingPayment <= 0) return inv;

        const paymentApplied = Math.min(remainingPayment, currentBalance);
        const newBalance = currentBalance - paymentApplied;
        remainingPayment -= paymentApplied;

        return {
          ...inv,
          balance: newBalance,
          status: newBalance <= 0 ? 'PAID' : inv.status,
          manualLogs: [...(inv.manualLogs || []), {
            date: new Date().toISOString(),
            note: `Received payment of ₹${paymentApplied.toLocaleString()} (${paymentType})`,
            performedBy: user?.fullName || 'System'
          }]
        };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    toast.success(`Recorded ₹${totalToPay.toLocaleString()} for ${paymentTarget.customer.name}`);
    setPaymentTarget(null);
    setPartialAmount(0);
  };

  const captureResponse = async () => {
    if (!showResponseModal || !responseInput) return;
    
    const toastId = toast.loading("AI analyzing partner response...");
    const suggestion = await analyzeCustomerResponse(responseInput);
    
    setActivityLog(prev => prev.map(log => 
      log.id === showResponseModal.id 
        ? { ...log, status: 'REPLIED', customerResponse: responseInput, aiSuggestedNextStep: suggestion } 
        : log
    ));
    
    toast.success("Response analyzed.", { id: toastId });
    setShowResponseModal(null);
    setResponseInput('');
  };

  const executeAiSuggestion = (log: FollowUp) => {
    if (!log.aiSuggestedNextStep) return;
    const rem = suggestedReminders.find(r => r.customer.id === log.customerId);
    if (log.aiSuggestedNextStep.type === 'PLAN' && rem) handleGeneratePlan(rem);
    else if (log.aiSuggestedNextStep.type === 'MESSAGE' && rem) startRemindWorkflow(rem);
    setActivityLog(prev => prev.map(l => l.id === log.id ? { ...l, aiSuggestedNextStep: undefined } : l));
  };

  const handleGeneratePlan = async (rem: any) => {
    const tid = toast.loading("AI constructing recovery plan...");
    try {
      const plan = await generatePaymentPlan(rem.amount, rem.customer.name);
      setSelectedPlan({ plan, customer: rem.customer });
      toast.success("Plan generated!", { id: tid });
    } catch (err) {
      toast.error("Failed to generate plan.", { id: tid });
    }
  };

  const simulateVoiceCall = async () => {
    if (!remindTarget || !recipientContact) return;
    const tone = remindTarget.level >= 4 ? 'firm' : 'soft';
    setActiveCall({ customer: recipientContact.name, status: 'Simulating AI Voice Call...', tone });
    const audioBase64 = await generateReminderAudio(recipientContact.name, remindTarget.amount, "immediately", tone);
    if (audioBase64) {
      setActiveCall({ customer: recipientContact.name, status: 'Audio Playback Active...', tone });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bytes = atob(audioBase64).split('').map(c => c.charCodeAt(0));
      const decodeAudio = async (data: number[], ctx: AudioContext) => {
        const dataInt16 = new Int16Array(new Uint8Array(data).buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const cData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) cData[i] = dataInt16[i] / 32768.0;
        return buffer;
      };
      const buffer = await decodeAudio(bytes, audioCtx);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setActiveCall(null);
        finalizeReminder();
      };
      source.start();
    } else {
      setActiveCall(null);
      toast.error("Synthesis failed.");
    }
  };

  const saveMatrix = () => {
    setEscalationProtocol(tempProtocol);
    toast.success("Protocols Updated.");
  };

  const getChannelIcon = (type: CommChannel) => {
    switch(type) {
      case 'WHATSAPP': return 'fa-brands fa-whatsapp';
      case 'EMAIL': return 'fa-solid fa-envelope';
      case 'SMS': return 'fa-solid fa-comment-dots';
      case 'CALL': return 'fa-solid fa-phone-volume';
      default: return 'fa-solid fa-paper-plane';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Recovery Hub</h2>
          <p className="text-sm text-slate-500 font-medium">Coordinate automated multi-channel follow-ups.</p>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: 'pipeline', label: 'Queue', icon: 'fa-list-ol' },
            { id: 'activity', label: 'History', icon: 'fa-clock-rotate-left' },
            { id: 'matrix', label: 'Matrix', icon: 'fa-gears' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FollowUpTab)}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'pipeline' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {suggestedReminders.map((rem, i) => (
                 <div key={i} className={`bg-white p-8 rounded-[2rem] border-2 transition-all hover:shadow-xl ${rem.level >= 4 ? 'border-red-100 shadow-red-50/10' : 'border-slate-100'}`}>
                   <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-4">
                       <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-white ${getEscalationColor(rem.level)} shadow-lg`}>
                         {rem.customer.name.charAt(0)}
                       </div>
                       <div>
                         <h4 className="font-black text-slate-900 truncate max-w-[120px]">{rem.customer.name}</h4>
                         <p className="text-[10px] font-black text-indigo-500 uppercase">₹{rem.amount.toLocaleString()}</p>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(s => <div key={s} className={`h-1.5 w-3 rounded-full ${s <= rem.level ? getEscalationColor(s as any) : 'bg-slate-100'}`}></div>)}
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Stage {rem.level}</span>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 mb-4">
                     <button 
                        onClick={() => startRemindWorkflow(rem)} 
                        className="py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                     >
                       <i className="fa-solid fa-bell"></i> Remind
                     </button>
                     <button 
                        onClick={() => setPaymentTarget(rem)} 
                        className="py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                     >
                       <i className="fa-solid fa-indian-rupee-sign"></i> Paid
                     </button>
                   </div>
                   <button 
                      onClick={() => handleGeneratePlan(rem)} 
                      className="w-full py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 border border-slate-100"
                   >
                     <i className="fa-solid fa-calendar-check"></i> Generate AI Recovery Plan
                   </button>
                 </div>
               ))}
               {suggestedReminders.length === 0 && (
                 <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">All Payments Secured</p>
                 </div>
               )}
             </div>
          </div>
        )}

        {/* Remind Modal with Contact Fixer */}
        {remindTarget && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
               <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black">Manual Intervention</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {remindTarget.customer.name} • Stage {remindTarget.level} • ₹{remindTarget.amount.toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => setRemindTarget(null)} className="text-slate-400 hover:text-white transition-colors">
                    <i className="fa-solid fa-xmark text-2xl"></i>
                  </button>
               </div>

               <div className="p-10 space-y-8">
                  {showContactFix ? (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300 text-center">
                      <div className="h-20 w-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto text-amber-500 text-3xl">
                        <i className="fa-solid fa-address-card"></i>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Missing Contact Details</h4>
                        <p className="text-xs text-slate-500 mt-2 font-medium">To send a {composingChannel} reminder, we need the partner's info.</p>
                      </div>
                      <div className="space-y-4">
                        <input 
                          type="email" 
                          placeholder="Email Address" 
                          value={fixData.email} 
                          onChange={(e) => setFixData({...fixData, email: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-50"
                        />
                        <input 
                          type="text" 
                          placeholder="WhatsApp / Phone" 
                          value={fixData.phone} 
                          onChange={(e) => setFixData({...fixData, phone: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setComposingChannel(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Back</button>
                        <button onClick={handleSaveFixData} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Update & Compose</button>
                      </div>
                    </div>
                  ) : !composingChannel ? (
                    <div className="space-y-6">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Select Channel</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {['WHATSAPP', 'EMAIL', 'SMS', 'CALL'].map(ch => (
                           <button 
                            key={ch}
                            onClick={() => handleChannelSelect(ch as CommChannel)}
                            className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all group"
                           >
                              <div className={`h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all`}>
                                <i className={getChannelIcon(ch as CommChannel)}></i>
                              </div>
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{ch}</span>
                           </button>
                         ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <i className={getChannelIcon(composingChannel)}></i>
                          <div>
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{recipientContact?.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{recipientContact?.detail}</p>
                          </div>
                        </div>
                        <button onClick={() => setComposingChannel(null)} className="text-[8px] font-black text-indigo-600 uppercase">Change</button>
                      </div>

                      {isComposing ? (
                        <div className="h-48 flex flex-col items-center justify-center space-y-4 bg-slate-50 rounded-3xl border border-slate-100">
                          <i className="fa-solid fa-sparkles fa-spin text-indigo-600 text-3xl"></i>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Gemini Drafting Notice...</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <textarea 
                            value={validationDraft}
                            onChange={(e) => setValidationDraft(e.target.value)}
                            className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium leading-relaxed resize-none focus:ring-4 focus:ring-indigo-100 outline-none"
                          />
                          <div className="flex gap-4">
                            <button onClick={() => setRemindTarget(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Discard</button>
                            {composingChannel === 'CALL' ? (
                              <button onClick={simulateVoiceCall} className="flex-2 px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><i className="fa-solid fa-robot"></i> Test Script</button>
                            ) : (
                              <button onClick={finalizeReminder} className="flex-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Send Now</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* Mark Payment Modal */}
        {paymentTarget && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 space-y-8 animate-in zoom-in-95 duration-200">
               <div className="text-center">
                  <div className="h-16 w-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-money-check-dollar text-2xl text-emerald-600"></i></div>
                  <h3 className="text-2xl font-black text-slate-900">Record Payment</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Settling Ledger for {paymentTarget.customer.name}</p>
               </div>

               <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-100">
                 <button 
                  onClick={() => setPaymentType('FULL')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${paymentType === 'FULL' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                 >Full Settlement</button>
                 <button 
                  onClick={() => setPaymentType('PARTIAL')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${paymentType === 'PARTIAL' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                 >Partial Payment</button>
               </div>

               {paymentType === 'FULL' ? (
                 <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                   <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Settlement Amount</p>
                   <p className="text-3xl font-black text-slate-900">₹{paymentTarget.amount.toLocaleString()}</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Received Amount</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">₹</span>
                      <input 
                        type="number" 
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(Number(e.target.value))}
                        className="w-full pl-10 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg focus:outline-none focus:ring-4 focus:ring-emerald-50 text-emerald-600"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">Remaining Balance: ₹{(paymentTarget.amount - partialAmount).toLocaleString()}</p>
                 </div>
               )}

               <div className="flex gap-4">
                  <button onClick={() => setPaymentTarget(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Discard</button>
                  <button onClick={handleMarkPayment} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100">Confirm Receipt</button>
               </div>
            </div>
          </div>
        )}

        {/* History Tab Rendering */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Partner & Interaction</th>
                    <th className="px-8 py-5">AI Status</th>
                    <th className="px-8 py-5">Stage</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {activityLog.map(log => (
                     <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-8 py-5">
                            <p className="font-bold text-sm text-slate-900">{log.customerName}</p>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">{log.message}</p>
                        </td>
                        <td className="px-8 py-5">
                            {log.aiSuggestedNextStep && (
                                <button onClick={() => executeAiSuggestion(log)} className="text-[9px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg uppercase shadow-sm">Execute AI Suggestion</button>
                            )}
                        </td>
                        <td className="px-8 py-5"><span className={`px-2 py-0.5 rounded text-[8px] font-black text-white ${getEscalationColor(log.escalationLevel)}`}>L{log.escalationLevel}</span></td>
                        <td className="px-8 py-5 text-right">
                            <button onClick={() => setShowResponseModal(log)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"><i className="fa-solid fa-reply"></i></button>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        {/* Matrix Rendering Omitted for Brevity (unchanged) */}
      </div>

      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-3xl z-[300] flex items-center justify-center p-6">
           <div className="max-w-md w-full text-center">
              <div className="mb-12 h-32 w-32 mx-auto relative">
                <div className={`h-full w-full rounded-full flex items-center justify-center relative z-10 shadow-2xl ${activeCall.tone === 'firm' ? 'bg-red-600' : 'bg-indigo-600'}`}>
                   <i className={`fa-solid ${activeCall.tone === 'firm' ? 'fa-scale-balanced' : 'fa-robot'} text-5xl text-white`}></i>
                </div>
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 scale-125 bg-indigo-600"></div>
              </div>
              <h3 className="text-3xl font-black text-white mb-2">{activeCall.customer}</h3>
              <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-[0.5em] animate-pulse">{activeCall.status}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default FollowUps;
