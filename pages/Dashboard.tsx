
import React, { useState, useEffect, useMemo } from 'react';
import { AIInsight, Invoice } from '../types';
import { getCashflowInsights } from '../services/gemini';
import { getEffectiveStatus } from '../services/finance';
import { useApp } from '../App';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { toast } from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const { invoices } = useApp();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (invoices.length > 0) {
      const fetchInsights = async () => {
        setLoadingInsights(true);
        const data = await getCashflowInsights(invoices);
        setInsights(data);
        setLoadingInsights(false);
      };
      fetchInsights();
    }
  }, [invoices]);

  const handleDownloadInsights = () => {
    if (insights.length === 0) {
      toast.error("No insights generated yet.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      generatedAt: new Date().toISOString(),
      insights: insights,
      summary: totals
    }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "vasool_financial_intelligence.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Intelligence report downloaded successfully.");
  };

  const totals = useMemo(() => {
    return invoices.reduce((acc, inv) => {
      const status = getEffectiveStatus(inv);
      if (status === 'PAID') acc.paid += inv.amount;
      else {
        acc.outstanding += inv.balance || inv.amount;
        if (status === 'OVERDUE') acc.overdue += inv.balance || inv.amount;
      }
      return acc;
    }, { outstanding: 0, overdue: 0, paid: 0 });
  }, [invoices]);

  // --- Customer Insights ---
  const topCustomersData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => { map[inv.customerName] = (map[inv.customerName] || 0) + inv.amount; });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [invoices]);

  const invoiceCountByCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => { map[inv.customerName] = (map[inv.customerName] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [invoices]);

  // --- Financial Overview ---
  const statusData = useMemo(() => {
    const overdue = invoices.filter(i => getEffectiveStatus(i) === 'OVERDUE').length;
    const pending = invoices.filter(i => getEffectiveStatus(i) === 'PENDING').length;
    const paid = invoices.filter(i => i.status === 'PAID').length;
    const draft = invoices.filter(i => i.status === 'DRAFT').length;
    return [
      { name: 'Overdue', value: overdue, color: '#f43f5e' }, // Rose 500
      { name: 'Pending', value: pending, color: '#6366f1' }, // Indigo 500
      { name: 'Paid', value: paid, color: '#10b981' }, // Emerald 500
      { name: 'Draft', value: draft, color: '#94a3b8' }  // Slate 400
    ].filter(d => d.value > 0);
  }, [invoices]);

  const outstandingVsTotalData = useMemo(() => {
    const map: Record<string, { total: number, balance: number }> = {};
    invoices.forEach(inv => {
      if (!map[inv.customerName]) map[inv.customerName] = { total: 0, balance: 0 };
      map[inv.customerName].total += inv.amount;
      map[inv.customerName].balance += (inv.balance || 0);
    });
    
    return Object.entries(map)
      .map(([name, data]) => ({ 
        name, 
        Paid: data.total - data.balance, 
        Outstanding: data.balance 
      }))
      .sort((a, b) => (a.Paid + a.Outstanding) - (b.Paid + b.Outstanding)) // sort by total asc for chart
      .reverse()
      .slice(0, 5);
  }, [invoices]);

  const invoiceValueHistogram = useMemo(() => {
    if (invoices.length === 0) return [];
    const amounts = invoices.map(i => i.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const binCount = 5;
    const binSize = (max - min) / binCount || 1000;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${Math.floor(min + i * binSize) / 1000}k-${Math.floor(min + (i + 1) * binSize) / 1000}k`,
      count: 0
    }));

    amounts.forEach(amt => {
      const binIndex = Math.min(Math.floor((amt - min) / binSize), binCount - 1);
      bins[binIndex].count++;
    });
    
    return bins;
  }, [invoices]);

  // --- Timeline & Trends ---
  const revenueOverTime = useMemo(() => {
    const map: Record<string, number> = {};
    [...invoices]
      .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .forEach(inv => {
        // Grouping by Date for granular line chart
        const date = new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        map[date] = (map[date] || 0) + inv.amount;
      });
    return Object.entries(map).map(([date, amount]) => ({ date, amount }));
  }, [invoices]);

  const dueHeatmapData = useMemo(() => {
    // A simple list of upcoming due dates with intensity
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === 'PAID') return;
      const d = inv.dueDate; // YYYY-MM-DD
      map[d] = (map[d] || 0) + (inv.balance || 0);
    });
    // Create an array of next 30 days
    const days = [];
    const today = new Date();
    for (let i = 0; i < 28; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        days.push({
            date: date,
            dateStr: dateStr,
            amount: map[dateStr] || 0
        });
    }
    return days;
  }, [invoices]);

  // --- Operational Metrics ---
  const emailStatusData = useMemo(() => {
    const sent = invoices.filter(i => i.isEmailed).length;
    const notSent = invoices.length - sent;
    return [
      { name: 'Sent', value: sent, color: '#8b5cf6' }, // Violet 500
      { name: 'Not Sent', value: notSent, color: '#cbd5e1' } // Slate 300
    ].filter(d => d.value > 0);
  }, [invoices]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-2 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Ledger Intelligence</h2>
          <p className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Holistic SME Cashflow Operations</p>
        </div>
        <button 
          onClick={handleDownloadInsights}
          className="w-full md:w-auto bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-2xl font-black shadow-sm hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"
        >
          <i className="fa-solid fa-download text-indigo-500"></i> Download Insights
        </button>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Pending Liquidity', value: totals.outstanding, color: 'text-indigo-600', icon: 'fa-sack-dollar', bg: 'bg-indigo-50/30' },
          { label: 'Critical Overdue', value: totals.overdue, color: 'text-rose-600', icon: 'fa-bolt-lightning', bg: 'bg-rose-50/30' },
          { label: 'Total Revenue', value: totals.paid + totals.outstanding, color: 'text-emerald-600', icon: 'fa-chart-simple', bg: 'bg-emerald-50/30' },
          { label: 'Avg. Invoice Value', value: invoices.length ? (totals.paid + totals.outstanding) / invoices.length : 0, color: 'text-amber-500', icon: 'fa-file-invoice-dollar', bg: 'bg-amber-50/30' }
        ].map((kpi, i) => (
          <div key={i} className={`bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className={`absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500 text-8xl ${kpi.color}`}>
              <i className={`fa-solid ${kpi.icon}`}></i>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{kpi.label}</p>
            <p className={`text-2xl md:text-3xl font-black ${kpi.color}`}>
              ₹{kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Analytics Column */}
        <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Customer Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Top Customers by Revenue</h4>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topCustomersData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Invoice Count per Customer</h4>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={invoiceCountByCustomer}>
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} interval={0} />
                                <YAxis hide />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 2. Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status Distribution</h4>
                    <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}>
                                    {statusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm md:col-span-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Outstanding vs. Total Amount</h4>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={outstandingVsTotalData} layout="vertical" margin={{left: 20}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Legend wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                                <Bar dataKey="Paid" stackId="a" fill="#10b981" radius={[0,0,0,0]} barSize={20} />
                                <Bar dataKey="Outstanding" stackId="a" fill="#f43f5e" radius={[0,10,10,0]} barSize={20} />
                             </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

             {/* Invoice Histogram */}
             <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Invoice Value Distribution (Histogram)</h4>
                 <div className="h-[200px]">
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={invoiceValueHistogram}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey="range" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                             <YAxis tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                             <Tooltip cursor={{fill: '#f8fafc'}} />
                             <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={40}>
                               {invoiceValueHistogram.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fillOpacity={0.6 + (index * 0.1)} />
                               ))}
                             </Bar>
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
             </div>

            {/* 3. Timeline & Trends */}
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 mb-8 uppercase tracking-[0.3em] flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500"></span> Billing Trends (Revenue Timeline)
                </h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueOverTime}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} dot={{r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Due Date Heatmap (Simplified) */}
                 <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Upcoming Due Heatmap (30 Days)</h4>
                    <div className="grid grid-cols-7 gap-2">
                        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-center text-[8px] font-black text-slate-300">{d}</div>)}
                        {dueHeatmapData.map((day, i) => {
                             const intensity = day.amount > 50000 ? 'bg-rose-500' : day.amount > 10000 ? 'bg-amber-400' : day.amount > 0 ? 'bg-emerald-300' : 'bg-slate-50';
                             return (
                                 <div key={i} className={`aspect-square rounded-lg flex items-center justify-center relative group ${intensity} transition-all hover:scale-110`}>
                                     <span className={`text-[8px] font-bold ${day.amount > 0 ? 'text-white' : 'text-slate-300'}`}>{day.date.getDate()}</span>
                                     {day.amount > 0 && (
                                         <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                                             ₹{day.amount.toLocaleString()}
                                         </div>
                                     )}
                                 </div>
                             );
                        })}
                    </div>
                 </div>

                 {/* Operational Metrics */}
                 <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Email Status</h4>
                    <div className="h-[200px] relative">
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie data={emailStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2}>
                                     {emailStatusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                                 </Pie>
                                 <Tooltip />
                                 <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                             </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="text-center">
                                 <p className="text-xl font-black text-slate-900">{((emailStatusData.find(d => d.name === 'Sent')?.value || 0) / invoices.length * 100).toFixed(0)}%</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase">Communicated</p>
                             </div>
                         </div>
                    </div>
                 </div>
            </div>

        </div>

        {/* AI Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden min-h-[500px] sticky top-8">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 blur-[80px]"></div>
            <h3 className="text-xl font-black mb-10 flex items-center gap-3">
              <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i> AI Hub
            </h3>
            <div className="space-y-6">
              {loadingInsights ? (
                <div className="space-y-6">
                  {[1,2,3].map(i => <div key={i} className="h-32 bg-white/5 rounded-3xl animate-pulse"></div>)}
                </div>
              ) : (
                insights.map((insight, i) => (
                  <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 hover:bg-white/10 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-black text-[9px] text-indigo-300 uppercase tracking-[0.2em]">{insight.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${insight.severity === 'high' ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {insight.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-6 font-medium">{insight.description}</p>
                    <button onClick={() => toast.success(`Action: ${insight.actionLabel}`)} className="w-full text-[10px] font-black text-white bg-indigo-600 py-3.5 rounded-2xl hover:bg-indigo-500 transition-all uppercase tracking-[0.2em] shadow-lg shadow-indigo-900/20">
                      {insight.actionLabel}
                    </button>
                  </div>
                ))
              )}
              {insights.length === 0 && !loadingInsights && (
                 <div className="text-center py-10">
                    <p className="text-slate-500 text-xs">No insights available. Add invoices to generate AI analysis.</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
