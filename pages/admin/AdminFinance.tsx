
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/db';
import { BalanceRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Check, X, Clock, DollarSign, Wallet, TrendingUp } from 'lucide-react';

export default function AdminFinance() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);

    const loadRequests = () => {
        db.getBalanceRequests().then(setBalanceRequests);
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleHandleRequest = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
        if (!currentUser) return;
        try {
            await db.handleBalanceRequest(currentUser.id, reqId, action);
            toast.success(`Solicitud ${action === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`);
            loadRequests();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const stats = useMemo(() => {
        const pendingCount = balanceRequests.length;
        const totalPendingAmount = balanceRequests.reduce((acc, r) => acc + Number(r.amount), 0);
        return { pendingCount, totalPendingAmount };
    }, [balanceRequests]);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Solicitudes Pendientes</p>
                        <h3 className="text-2xl font-bold text-white">{stats.pendingCount}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                </div>
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Monto Total Pendiente</p>
                        <h3 className="text-2xl font-bold text-white">{stats.totalPendingAmount.toFixed(2)} $</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <DollarSign size={24} />
                    </div>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                    <Wallet size={18} className="text-indigo-400"/>
                    <h3 className="font-bold text-white">Cola de Aprobación</h3>
                </div>
                
                {balanceRequests.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                        <Check size={32} className="text-emerald-500/50"/>
                        <p>Todo al día. No hay solicitudes pendientes.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-3">Usuario</th>
                                    <th className="px-6 py-3">Solicitado</th>
                                    <th className="px-6 py-3">Fecha</th>
                                    <th className="px-6 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {balanceRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">{req.username}</div>
                                            <div className="text-[10px] text-slate-500">ID: {req.userId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-emerald-400 font-bold text-lg">+{req.amount}</div>
                                            <div className="text-[10px] text-slate-500">Saldo</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {new Date(req.createdAt * 1000).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleHandleRequest(req.id, 'APPROVED')} 
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                    title="Aprobar"
                                                >
                                                    <Check size={16}/> <span className="hidden md:inline">Aprobar</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleHandleRequest(req.id, 'REJECTED')} 
                                                    className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                    title="Rechazar"
                                                >
                                                    <X size={16}/> <span className="hidden md:inline">Rechazar</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
