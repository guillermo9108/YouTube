import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { User } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Search, Users, Wallet, Shield, ChevronLeft, ChevronRight, RefreshCw, Smartphone, TrendingUp } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</p>
            <p className="text-xl font-black text-white">{value}</p>
        </div>
    </div>
);

const ITEMS_PER_PAGE = 15;

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    
    // Manual Balance State
    const [addBalanceAmount, setAddBalanceAmount] = useState('');
    const [addBalanceTarget, setAddBalanceTarget] = useState('');

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await db.getAllUsers();
            setUsers(data);
        } catch(e) {
            toast.error("Fallo al conectar con el servidor de usuarios.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    // Derived State
    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            u.username.toLowerCase().includes(search.toLowerCase()) || 
            u.id.toLowerCase().includes(search.toLowerCase())
        );
    }, [users, search]);

    const stats = useMemo(() => {
        const totalUsers = users.length;
        const totalBalance = users.reduce((acc, u) => acc + Number(u.balance || 0), 0);
        const activeToday = users.filter(u => u.lastActive && (Date.now()/1000 - u.lastActive) < 86400).length;
        return { totalUsers, totalBalance, activeToday };
    }, [users]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleAddBalance = async () => {
        if (!currentUser || !addBalanceTarget || !addBalanceAmount) return;
        try {
            await db.adminAddBalance(currentUser.id, addBalanceTarget, parseFloat(addBalanceAmount));
            toast.success("Saldo inyectado correctamente");
            setAddBalanceAmount('');
            setAddBalanceTarget('');
            loadUsers();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-24">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Cuentas Totales" value={stats.totalUsers} icon={Users} color="bg-blue-500/20 text-blue-400" />
                <StatCard label="Circulante (Saldo)" value={stats.totalBalance.toFixed(0) + ' $'} icon={Wallet} color="bg-emerald-500/20 text-emerald-400" />
                <StatCard label="Activos 24h" value={stats.activeToday} icon={Smartphone} color="bg-purple-500/20 text-purple-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-xl">
                    <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-indigo-400"/>
                            <span className="font-black text-white uppercase tracking-tighter">Directorio de Usuarios</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-2.5 text-slate-500"/>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por @nick..." 
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                    className="bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-xs text-white focus:border-indigo-500 outline-none w-40 md:w-56"
                                />
                            </div>
                            <button onClick={loadUsers} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400"><RefreshCw size={14}/></button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-950/50">
                                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                    <th className="px-4 py-4">Usuario</th>
                                    <th className="px-4 py-4">Rol</th>
                                    <th className="px-4 py-4">Saldo</th>
                                    <th className="px-4 py-4">Dispositivo</th>
                                    <th className="px-4 py-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-indigo-500" /></td></tr>
                                ) : paginatedUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-white/5">
                                                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-600">{u.username[0]}</div>}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white truncate">@{u.username}</div>
                                                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Activo: {u.lastActive ? new Date(u.lastActive * 1000).toLocaleDateString() : 'Nunca'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${u.role?.trim().toUpperCase() === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                                {u.role || 'USER'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-mono font-bold text-emerald-400 text-sm">
                                            {Number(u.balance).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-300 transition-colors">
                                                <Smartphone size={10} />
                                                <span className="text-[10px] font-mono truncate max-w-[80px]">{u.lastDeviceId || 'Desconocido'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button onClick={() => setAddBalanceTarget(u.id)} className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><TrendingUp size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/30">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 text-slate-400"><ChevronLeft size={20}/></button>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 text-slate-400"><ChevronRight size={20}/></button>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
                        <h3 className="font-black text-white mb-4 flex items-center gap-2 uppercase tracking-tighter"><TrendingUp size={18} className="text-emerald-400"/> Recarga Directa</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Destinatario</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" value={addBalanceTarget} onChange={e => setAddBalanceTarget(e.target.value)}>
                                    <option value="">Selecciona usuario...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.username} ({Number(u.balance).toFixed(0)} $)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Monto a inyectar ($)</label>
                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold" value={addBalanceAmount} onChange={e => setAddBalanceAmount(e.target.value)} placeholder="0.00" />
                            </div>
                            <button onClick={handleAddBalance} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest">Confirmar Transacción</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}