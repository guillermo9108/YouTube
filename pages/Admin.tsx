import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<number>(10);

  useEffect(() => {
    db.getAllUsers().then(setUsers);
  }, []);

  const handleAddCredit = async (targetId: string) => {
    if (!currentUser) return;
    try {
      await db.adminAddBalance(currentUser.id, targetId, amount);
      // Refresh list
      const u = await db.getAllUsers();
      setUsers(u);
      alert(`Added ${amount} Saldo to user.`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl">
        <h2 className="text-xl font-bold text-red-200 mb-1">Admin Dashboard</h2>
        <p className="text-red-300/70 text-sm">Manage user balances. Use with caution.</p>
      </div>

      <div className="flex gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
         <div className="flex-1 relative">
           <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
           <input 
             type="text" 
             placeholder="Search users..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
           />
         </div>
         <div className="w-32">
            <input 
               type="number"
               value={amount}
               onChange={e => setAmount(parseInt(e.target.value))}
               className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-center"
               title="Amount to credit"
            />
         </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
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
                <td className="p-4 font-medium text-slate-200">{u.username}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-right font-mono text-indigo-300">{u.balance}</td>
                <td className="p-4 flex justify-center">
                   <button 
                     onClick={() => handleAddCredit(u.id)}
                     className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 p-2 rounded-full transition-colors"
                     title={`Add ${amount} Saldo`}
                   >
                     <PlusCircle size={20} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}