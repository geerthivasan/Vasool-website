
import React from 'react';
import { useApp } from '../../App';

const AdminDashboard: React.FC = () => {
  const { invoices } = useApp();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Administration</h2>
          <p className="text-sm text-slate-500 font-medium">Platform Health & Global Metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Invoices Processed</p>
            <p className="text-3xl font-black text-slate-900">{invoices.length + 1240}</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Uptime</p>
            <p className="text-3xl font-black text-emerald-600">99.98%</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">API Latency</p>
            <p className="text-3xl font-black text-indigo-600">42ms</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Tenants</p>
            <p className="text-3xl font-black text-amber-500">84</p>
         </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
        <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-300 text-3xl">
            <i className="fa-solid fa-server"></i>
        </div>
        <h3 className="text-xl font-black text-slate-900">System Nominal</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">All microservices including Gemini AI, Bank Reconciliation Engine, and Notification Dispatcher are operating within optimal parameters.</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
