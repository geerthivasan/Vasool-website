
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState(Array.from({ length: 10 }).map((_, i) => ({
    id: i + 1,
    name: `SME Owner ${i + 1}`,
    email: `owner${i + 1}@example.com`,
    status: i % 3 === 0 ? 'BANNED' : 'ACTIVE',
    business: `Business Name ${i + 1}`,
    joinDate: '2024-01-15'
  })));

  const handleBanToggle = (id: number) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newStatus = u.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
        toast(
          `User ${u.name} is now ${newStatus}`,
          { icon: newStatus === 'ACTIVE' ? '✅' : '🚫' }
        );
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  const handleEditUser = (name: string) => {
    toast(`Edit profile for ${name} coming soon!`, { icon: '✏️' });
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
          System Overview
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Infrastructure and user administration portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Active Users', value: '1,284', icon: 'fa-users', color: 'text-indigo-600' },
           { label: 'Total Collections', value: '₹12.4 Cr', icon: 'fa-money-bill-trend-up', color: 'text-emerald-600' },
           { label: 'API Health', value: '99.9%', icon: 'fa-heart-pulse', color: 'text-indigo-500' },
           { label: 'Queue Backlog', value: '0', icon: 'fa-layer-group', color: 'text-slate-600' }
         ].map((stat, i) => (
           <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <i className={`fa-solid ${stat.icon} ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity`}></i>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">User Management</h3>
          <button 
            onClick={() => toast.success("Loading user directory...")}
            className="text-indigo-600 font-bold text-sm hover:underline"
          >
            View All Users
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{u.name}</span>
                      <span className="text-xs text-slate-500">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.business}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                      u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.joinDate}</td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button 
                      onClick={() => handleEditUser(u.name)}
                      className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-100 transition-all"
                      title="Edit User"
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button 
                      onClick={() => handleBanToggle(u.id)}
                      className={`p-2 rounded-lg transition-all ${
                        u.status === 'ACTIVE' 
                          ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                          : 'text-red-600 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={u.status === 'ACTIVE' ? 'Ban User' : 'Unban User'}
                    >
                      <i className={`fa-solid ${u.status === 'ACTIVE' ? 'fa-ban' : 'fa-circle-check'}`}></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
