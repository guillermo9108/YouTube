
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock, Settings, Save, Play, Pause, ExternalLink, Key, Loader2 } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<number>(10);
  
  // Maintenance State
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'CONFIG'>('USERS');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    loadData();
    db.getSystemSettings().then(setSettings);
  }, []);

  const loadData = async () => {
    setLoadingUsers(true);
    try {
        const u = await db.getAllUsers();
        setUsers(u || []);
        const r = await db.getRequests();
        setRequests(r || []);
    } catch(e) {
        console.error("Admin Load Error", e);
    } finally {
        setLoadingUsers(false);
    }
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
    if (confirm("This will attempt to create any missing tables. Continue?")) {
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

  const saveSettings = async () => {
      if (!settings) return;
      try {
          await db.updateSystemSettings(settings);
          alert("Settings saved!");
      } catch (e) { alert("Failed to save"); }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-24">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Admin Dashboard</h2>
          <p className="text-slate-400 text-sm">System Management</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setActiveTab('USERS')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Users</button>
           <button onClick={() => setActiveTab('CONFIG')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CONFIG' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Configuration</button>
        </div>
      </div>

      {activeTab === 'CONFIG' && settings && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} /> Auto-Download Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings({...settings, downloadStartTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings({...settings, downloadEndTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch Size (Videos per Run)</label>
                    <input type="number" min="1" max="50" value={settings.batchSize} onChange={e => setSettings({...settings, batchSize: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Duration (Sec)</label>
                        <input type="number" value={settings.maxDuration} onChange={e => setSettings({...settings, maxDuration: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Height (px)</label>
                        <input type="number" placeholder="1080" value={settings.maxResolution} onChange={e => setSettings({...settings, maxResolution: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <button onClick={saveSettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    <Save size={18} /> Save Settings
                </button>
             </div>

             <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                         <h3 className="font-bold text-white flex items-center gap-2"><Key size={18} /> Server API Keys</h3>
                         <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Stored Safely in DB</span>
                    </div>
                    <p className="text-xs text-slate-500">Provide keys to allow the server and users to search/download stock content.</p>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pexels Key</label>
                            <a href="https://www.pexels.com/api/new/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Get Key</a>
                        </div>
                        <input type="text" value={settings.pexelsKey} onChange={e => setSettings({...settings, pexelsKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Your Pexels API Key"/>
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pixabay Key</label>
                            <a href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Get Key</a>
                        </div>
                        <input type="text" value={settings.pixabayKey} onChange={e => setSettings({...settings, pixabayKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Your Pixabay API Key"/>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18} /> Queue Controls</h3>
                    <div className="flex gap-2">
                        <button 
                           onClick={() => { setSettings({...settings, isQueuePaused: !settings.isQueuePaused}); saveSettings(); }}
                           className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${settings.isQueuePaused ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                        >
                            {settings.isQueuePaused ? <><Play size={18}/> Resume Queue</> : <><Pause size={18}/> Pause Queue</>}
                        </button>
                        <button onClick={triggerDownload} className="flex-1 bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                            <DownloadCloud size={18}/> Force Run
                        </button>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 bg-slate-950 p-2 rounded">
                        <span>Status: <strong>{settings.isQueuePaused ? 'PAUSED' : 'ACTIVE'}</strong></span>
                        <span>{requests.filter(r => r.status === 'PENDING').length} Pending</span>
                    </div>
                </div>
             </div>
         </div>
      )}

      {activeTab === 'USERS' && (
        <>
            <div className="flex justify-end">
                <button onClick={handleRepairDb} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2">
                    <Database size={14} /> Repair DB
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
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
                    />
                </div>
            </div>

            <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                    <tr>
                    <th className="p-4">User</th>
                    <th className="p-4 text-right">Balance</th>
                    <th className="p-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loadingUsers ? (
                         <tr><td colSpan={3} className="p-10 text-center text-slate-500"><Loader2 className="animate-spin mx-auto"/> Loading users...</td></tr>
                    ) : (
                        filteredUsers.length === 0 ? (
                            <tr><td colSpan={3} className="p-10 text-center text-slate-500">No users found.</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                            <tr key={u.id}>
                                <td className="p-4 font-bold text-slate-200 flex items-center gap-2"><UserIcon size={16}/> {u.username} <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-500">{u.role}</span></td>
                                <td className="p-4 text-right font-mono text-indigo-300">{u.balance}</td>
                                <td className="p-4 flex justify-center">
                                    <button onClick={() => handleAddCredit(u.id, u.username)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                                        <PlusCircle size={16} /> Add {amount}
                                    </button>
                                </td>
                            </tr>
                            ))
                        )
                    )}
                </tbody>
                </table>
            </div>
            
            {/* Mobile List View */}
            <div className="md:hidden space-y-4">
                {loadingUsers && <div className="text-center p-4"><Loader2 className="animate-spin mx-auto text-indigo-500"/></div>}
                {!loadingUsers && filteredUsers.map(u => (
                     <div key={u.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                         <div className="flex justify-between items-center mb-3">
                             <span className="font-bold text-white">{u.username}</span>
                             <span className="font-mono text-indigo-400">{u.balance} Saldo</span>
                         </div>
                         <button onClick={() => handleAddCredit(u.id, u.username)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                             <PlusCircle size={16} /> Add {amount} Credits
                         </button>
                     </div>
                ))}
            </div>
        </>
      )}

    </div>
  );
}
