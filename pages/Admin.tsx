
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, ContentRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<number>(10);
  
  // Maintenance State
  const [repairing, setRepairing] = useState(false);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [diag, setDiag] = useState<{ytdlp: boolean; python: boolean; msg: string} | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    db.getAllUsers().then(setUsers);
    db.getRequests().then(setRequests);
  };

  const handleAddCredit = async (targetId: string, username: string) => {
    if (!currentUser) return;
    if (confirm(`Add ${amount} Saldo to ${username}?`)) {
      try {
        await db.adminAddBalance(currentUser.id, targetId, amount);
        loadData();
        alert(`Successfully added ${amount} Saldo.`);
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleRepairDb = async () => {
    if (confirm("This will attempt to create any missing tables. Data will NOT be lost. Continue?")) {
      setRepairing(true);
      try {
         await db.adminRepairDb();
         alert("Database schema updated successfully.");
      } catch (e: any) {
         alert("Repair failed: " + e.message);
      } finally {
         setRepairing(false);
      }
    }
  };

  const checkDependencies = async () => {
     try {
       const res = await db.adminCheckDependencies();
       setDiag(res);
     } catch (e) {
       alert("Failed to check dependencies");
     }
  };

  const triggerDownload = async () => {
     if(confirm("Force queue processing now?")) {
       try {
         const res = await db.triggerQueueProcessing();
         alert(res.message);
         loadData();
       } catch (e) {
         alert("Trigger failed");
       }
     }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 pb-24">
      
      {/* Header */}
      <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-red-200 mb-1">Admin Dashboard</h2>
          <p className="text-red-300/70 text-sm">Manage users and system health.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleRepairDb} disabled={repairing} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-700">
             <Database size={16} /> {repairing ? 'Repairing...' : 'Update DB Schema'}
           </button>
        </div>
      </div>

      {/* System Status / Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Download Queue */}
         <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-slate-200 flex items-center gap-2">
                 <DownloadCloud className="text-indigo-400" /> Download Queue
               </h3>
               <button onClick={triggerDownload} className="text-xs bg-indigo-600 px-2 py-1 rounded text-white hover:bg-indigo-500">
                 Force Process
               </button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
               {requests.length === 0 ? (
                 <p className="text-slate-500 text-sm">No active requests.</p>
               ) : (
                 requests.map(r => (
                   <div key={r.id} className="flex justify-between items-center bg-slate-950 p-2 rounded text-sm border border-slate-800">
                      <div>
                        <span className="font-bold text-slate-300 block">{r.query}</span>
                        <span className="text-xs text-slate-500">{r.username} • {r.status}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-600">{r.useLocalNetwork ? 'LOCAL' : 'SERVER'}</span>
                   </div>
                 ))
               )}
            </div>
         </div>

         {/* Server Diagnostics */}
         <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 mb-4">
               <Shield className="text-emerald-400" /> Server Diagnostics
            </h3>
            <button onClick={checkDependencies} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded text-sm mb-4 border border-slate-700">
               Test Dependencies
            </button>
            
            {diag && (
              <div className="space-y-2 text-sm">
                 <div className={`flex items-center gap-2 ${diag.python ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${diag.python ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                    Python Installed
                 </div>
                 <div className={`flex items-center gap-2 ${diag.ytdlp ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${diag.ytdlp ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                    yt-dlp Binary
                 </div>
                 <pre className="mt-2 bg-black/50 p-2 rounded text-xs text-slate-500 whitespace-pre-wrap">
                    {diag.msg}
                 </pre>
              </div>
            )}
         </div>
      </div>

      {/* User Management */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 sticky top-0 md:top-auto z-10 shadow-lg md:shadow-none">
         <div className="flex-1 relative">
           <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
           <input 
             type="text" 
             placeholder="Search users..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
           />
         </div>
         <div className="w-full md:w-48 flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Credit Amount:</span>
            <input 
               type="number"
               value={amount}
               onChange={e => setAmount(parseInt(e.target.value))}
               className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-center font-bold text-lg"
               title="Amount to credit"
            />
         </div>
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Role</th>
              <th className="p-4 text-right">Balance</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/50">
                <td className="p-4 font-medium text-slate-200 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">{u.username[0]}</div>
                   {u.username}
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-right font-mono text-indigo-300">{u.balance}</td>
                <td className="p-4 flex justify-center">
                   <button 
                     onClick={() => handleAddCredit(u.id, u.username)}
                     className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                   >
                     <PlusCircle size={16} /> Add {amount}
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View: Cards Grid */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {filteredUsers.map(u => (
           <div key={u.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-start">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                       {u.username[0].toUpperCase()}
                    </div>
                    <div>
                       <h3 className="font-bold text-white text-lg">{u.username}</h3>
                       <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'}`}>
                          {u.role}
                       </span>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase">Balance</p>
                    <p className="font-mono text-xl text-indigo-400">{u.balance}</p>
                 </div>
              </div>
              
              <button 
                onClick={() => handleAddCredit(u.id, u.username)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <PlusCircle size={20} /> Add {amount} Saldo
              </button>
           </div>
        ))}
      </div>
    </div>
  );
}
