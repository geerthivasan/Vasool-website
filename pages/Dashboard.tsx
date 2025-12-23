
import React, { useState, useEffect, useMemo } from 'react';
import { AIInsight, Invoice } from '../types';
import { getCashflowInsights } from '../services/gemini';
import { getEffectiveStatus } from '../services/finance';
import { useApp } from '../App';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, LineChart, Line, Legend, LabelList
} from 'recharts';
import { toast } from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const { invoices, customers } = useApp();
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

  // 1. Customer Insights: Top Customers by Revenue
  const topCustomersData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      map[inv.customerName] = (map[inv.customerName] || 0) + inv.amount;
    });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [invoices]);

  // 2. Invoice Count per Customer (Renamed from Invoice Frequency)
  const invoiceCountData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      map[inv.customerName] = (map[inv.customerName] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [invoices]);

  // 3. Status Distribution (Overdue vs Draft/Pending)
  const statusData = useMemo(() => {
    const overdue = invoices.filter(i => getEffectiveStatus(i) === 'OVERDUE').length;
    const pending = invoices.filter(i => getEffectiveStatus(i) === 'PENDING').length;
    const draft = invoices.filter(i => i.status === 'DRAFT').length;
    return [
      { name: 'Overdue', value: overdue, color: '#ef4444' },
      { name: 'Pending', value: pending, color: '#6366f1' },
      { name: 'Draft', value: draft, color: '#94a3b8' }
    ].filter(d => d.value > 0);
  }, [invoices]);

  // 4. Outstanding vs Total (Stacked Bar)
  const liquidityData = useMemo(() => {
    const map: Record<string, { total: number, balance: number }> = {};
    invoices.forEach(inv => {
      if (!map[inv.customerName]) map[inv.customerName] = { total: 0, balance: 0 };
      map[inv.customerName].total += inv.amount;
      map[inv.customerName].balance += (inv.status === 'PAID' ? 0 : inv.balance);
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, total: data.total, balance: data.balance }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  // 5. Value Distribution (Histogram)
  const histogramData = useMemo(() => {
    const bins = { '0-10k': 0, '10-30k': 0, '30-60k': 0, '60k+': 0 };
    invoices.forEach(inv => {
      if (inv.amount <= 10000) bins['0-10k']++;
      else if (inv.amount <= 30000) bins['10-30k']++;
      else if (inv.amount <= 60000) bins['30-60k']++;
      else bins['60k+']++;
    });
    return Object.entries(bins).map(([range, count]) => ({ range, count }));
  }, [invoices]);

  // 6. Revenue Over Time
  const revenueTimeline = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).forEach(inv => {
      const date = inv.dueDate.substring(0, 7); // YYYY-MM
      map[date] = (map[date] || 0) + inv.amount;
    });
    return Object.entries(map).map(([date, amount]) => ({ date, amount }));
  }, [invoices]);

  // 7. Email Operational Status (Donut)
  const emailData = useMemo(() => {
    const emailed = invoices.filter(i => i.isEmailed).length;
    const notEmailed = invoices.length - emailed;
    return [
      { name: 'Emailed', value: emailed, color: '#10b981' },
      { name: 'Pending Send', value: notEmailed, color: '#f59e0b' }
    ];
  }, [invoices]);

  // 8. Heatmap Data (Next 30 days)
  const heatmapData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
    return days.map(day => {
      const amount = invoices.filter(i => i.dueDate === day && i.status !== 'PAID').reduce((sum, i) => sum + i.amount, 0);
      return { day, intensity: amount > 50000 ? 3 : amount > 20000 ? 2 : amount > 0 ? 1 : 0 };
    });
  }, [invoices]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Ledger Intelligence</h2>
          <p className="text-sm text-slate-500 font-medium">Holistic SME Cashflow Operations</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-slate-200 text-slate-900 px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all text-xs">Download Report</button>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Liquidity', value: totals.outstanding, color: 'text-indigo-600', icon: 'fa-sack-dollar' },
          { label: 'Critical Overdue', value: totals.overdue, color: 'text-rose-600', icon: 'fa-bolt-lightning' },
          { label: 'Total Revenue', value: totals.paid + totals.outstanding, color: 'text-emerald-600', icon: 'fa-chart-simple' },
          { label: 'Communication Rate', value: `${((invoices.filter(i => i.isEmailed).length / (invoices.length || 1)) * 100).toFixed(0)}%`, color: 'text-amber-500', icon: 'fa-envelope-circle-check' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-125 transition-transform duration-500 text-7xl ${kpi.color}`}>
              <i className={`fa-solid ${kpi.icon}`}></i>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className={`text-2xl font-black ${kpi.color}`}>
              {typeof kpi.value === 'number' ? `₹${kpi.value.toLocaleString()}` : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Customer Insights Section */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span> Customer Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase">Top Customers by Revenue</p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCustomersData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} formatter={(val) => `₹${val.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase">Invoice Count per Customer</p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceCountData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[10, 10, 0, 0]} barSize={30}>
                       <LabelList dataKey="count" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#10b981' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="lg:col-span-4 bg-slate-950 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl"></div>
          <h3 className="text-lg font-black mb-8 flex items-center gap-3 text-indigo-400">
            <i className="fa-solid fa-wand-magic-sparkles"></i> AI Recovery Hub
          </h3>
          <div className="space-y-5">
            {loadingInsights ? (
              <div className="space-y-4 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl"></div>)}
              </div>
            ) : (
              insights.map((insight, i) => (
                <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-[9px] text-indigo-300 uppercase tracking-[0.2em]">{insight.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${insight.severity === 'high' ? 'bg-rose-500' : 'bg-indigo-600'}`}>
                      {insight.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-4">{insight.description}</p>
                  <button onClick={() => toast.success(`Executing: ${insight.actionLabel}`)} className="w-full text-[10px] font-black text-white bg-indigo-600 py-2.5 rounded-xl hover:bg-indigo-500 transition-all uppercase tracking-widest">
                    {insight.actionLabel}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Financial Overview Section */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Status Distribution</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Outstanding vs Total</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liquidityData}>
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val) => `₹${val.toLocaleString()}`} />
                  <Bar dataKey="total" stackId="a" fill="#e2e8f0" radius={[10, 10, 0, 0]}>
                    <LabelList dataKey="total" position="top" style={{ fontSize: '9px', fill: '#94a3b8' }} formatter={(v) => `₹${(v/1000).toFixed(1)}k`} />
                  </Bar>
                  <Bar dataKey="balance" stackId="a" fill="#6366f1" radius={[10, 10, 0, 0]}>
                     <LabelList dataKey="balance" position="insideTop" style={{ fontSize: '9px', fill: '#fff', fontWeight: 'bold' }} formatter={(v) => v > 0 ? `₹${(v/1000).toFixed(1)}k` : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Value Distribution (Histogram)</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" fill="#334155" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Trends & Operations Section */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Timeline & Trends
            </h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTimeline}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Operational Metrics</h3>
          <div className="space-y-8">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={emailData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2}>
                    {emailData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase mt-2">Email Coverage</p>
            </div>

            <div className="space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date Intensity (Next 30 Days)</p>
               <div className="grid grid-cols-6 gap-2">
                 {heatmapData.map((item, i) => (
                   <div 
                    key={i} 
                    title={`${item.day}: Intensity Level ${item.intensity}`}
                    className={`h-4 w-full rounded-sm transition-all hover:scale-125 ${
                      item.intensity === 3 ? 'bg-rose-500' :
                      item.intensity === 2 ? 'bg-amber-400' :
                      item.intensity === 1 ? 'bg-indigo-200' : 'bg-slate-50'
                    }`}
                   ></div>
                 ))}
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
