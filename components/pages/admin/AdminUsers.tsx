
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/db';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PlusCircle, Search, Users, Wallet, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const ITEMS_PER_PAGE = 10;

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Manual Balance State
    const [addBalanceAmount, setAddBalanceAmount] = useState('');
    const [addBalanceTarget, setAddBalanceTarget] = useState('');

    const loadUsers = () => {
        db.getAllUsers().then(setUsers);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // Derived State
    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            u.username.toLowerCase().includes(search.toLowerCase()) || 
            u.id.toLowerCase().includes(search.toLowerCase())
        );
    }, [users, search]);

    const stats = useMemo(() => {
        const totalUsers = users.length;
        const totalBalance = users.reduce((acc, u) => acc + Number(u.balance), 0);
        const admins = users.filter(u => u.role === 'ADMIN').length;
        return { totalUsers, totalBalance, admins };
    }, [users]);

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleAddBalance = async () => {
        if (!currentUser || !addBalanceTarget || !addBalanceAmount) return;
        try {
            await db.adminAddBalance(currentUser.id, addBalanceTarget, parseFloat(addBalanceAmount));
            toast.success("Saldo agregado correctamente");
            setAddBalanceAmount('');
            setAddBalanceTarget('');
            loadUsers();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Usuarios Totales" value={stats.totalUsers} icon={Users} color="bg-blue-500/20 text-blue-400" />
                <StatCard label="Masa Monetaria (Saldo)" value={stats.totalBalance.toFixed(2)} icon={Wallet} color="bg-emerald-500/20 text-emerald-400" />
                <StatCard label="Administradores" value={stats.admins} icon={Shield} color="bg-purple-500/20 text-purple-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center flex-wrap gap-2">
                        <div className="font-bold">Usuarios del Sistema</div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-500"/>
                            <input 
                                type="text" 
                                placeholder="Buscar usuario..." 
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-sm text-white focus:border-indigo-500 outline-none w-48 focus:w-64 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                                <tr>
                                    <th className="px-4 py-3">Usuario</th>
                                    <th className="px-4 py-3">Rol</th>
                                    <th className="px-4 py-3">Saldo</th>
                                    <th className="px-4 py-3">Último Acceso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {paginatedUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <span className="font-bold text-slate-500">{u.username[0]}</span>}
                                                </div>
                                                <span className="font-medium text-white">{u.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role?.trim().toUpperCase() === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{u.role ? u.role.trim() : 'USER'}</span></td>
                                        <td className="px-4 py-3 font-mono text-emerald-400">{Number(u.balance).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-500">{(u.lastActive || 0) > 0 ? new Date((u.lastActive || 0) * 1000).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                ))}
                                {paginatedUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-500">No se encontraron usuarios</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/30">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"><ChevronLeft size={18}/></button>
                            <span className="text-xs text-slate-500">Página {currentPage} de {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"><ChevronRight size={18}/></button>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit sticky top-4">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><PlusCircle size={18}/> Agregar Saldo Manual</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Usuario Destino</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" value={addBalanceTarget} onChange={e => setAddBalanceTarget(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username} ({Number(u.balance).toFixed(2)})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Cantidad</label>
                            <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" value={addBalanceAmount} onChange={e => setAddBalanceAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <button onClick={handleAddBalance} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg shadow-lg active:scale-95 transition-all">Procesar Recarga</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
