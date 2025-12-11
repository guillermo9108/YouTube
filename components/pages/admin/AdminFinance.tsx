
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { BalanceRequest, Transaction } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Check, X, Clock, DollarSign, Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';

export default function AdminFinance() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
    const [globalTransactions, setGlobalTransactions] = useState<any[]>([]);

    const loadData = () => {
        db.getBalanceRequests().then(setBalanceRequests);
        db.getGlobalTransactions().then(setGlobalTransactions);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleHandleRequest = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
        if (!currentUser) return;
        try {
            await db.handleBalanceRequest(currentUser.id, reqId, action);
            toast.success(`Solicitud ${action === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`);
            loadData();
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

            {/* Global Transactions History */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-400"/>
                    <h3 className="font-bold text-white">Actividad Reciente Global</h3>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Detalle</th>
                                <th className="px-4 py-3 text-right">Monto</th>
                                <th className="px-4 py-3 text-right">Comisión</th>
                                <th className="px-4 py-3 text-right">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {globalTransactions.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Sin movimientos recientes</td></tr>
                            ) : (
                                globalTransactions.map(t => {
                                    const isDeposit = t.type === 'DEPOSIT';
                                    const isMarket = t.type === 'MARKETPLACE';
                                    return (
                                        <tr key={t.id} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${isDeposit ? 'bg-emerald-500/20 text-emerald-400' : (isMarket ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400')}`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isDeposit ? (
                                                    <div className="flex items-center gap-1 text-slate-300">
                                                        <ArrowDownLeft size={14} className="text-emerald-500"/> Recarga de {t.buyerName}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-white">{t.itemTitle || t.videoTitle || 'Ítem'}</span>
                                                        <span className="text-[10px] text-slate-500">{t.sellerName} <ArrowUpRight size={10} className="inline"/> {t.buyerName}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-white">
                                                {Number(t.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-400">
                                                {Number(t.adminFee) > 0 ? '+' + Number(t.adminFee).toFixed(2) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-slate-500">
                                                {new Date(t.timestamp * 1000).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
