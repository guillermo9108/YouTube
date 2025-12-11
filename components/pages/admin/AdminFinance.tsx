
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { BalanceRequest, VipRequest } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Check, X, Clock, DollarSign, Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Crown, FileText, User } from 'lucide-react';

export default function AdminFinance() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    
    const [requests, setRequests] = useState<{balance: BalanceRequest[], vip: VipRequest[]}>({
        balance: [], 
        vip: []
    });
    
    const [globalTransactions, setGlobalTransactions] = useState<any[]>([]);
    const [systemRevenue, setSystemRevenue] = useState(0);
    const [activeVips, setActiveVips] = useState<any[]>([]);
    
    // Countdown refresh trigger
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const loadData = () => {
        db.getBalanceRequests()
            .then((data: any) => {
                if (data && typeof data === 'object') {
                    setRequests({
                        balance: Array.isArray(data.balance) ? data.balance : [],
                        vip: Array.isArray(data.vip) ? data.vip : []
                    });
                    if (data.activeVip) setActiveVips(data.activeVip);
                }
            })
            .catch(e => console.error("Failed to load requests", e));
            
        db.getGlobalTransactions()
            .then((data: any) => {
                if (data.history) setGlobalTransactions(data.history);
                if (data.systemRevenue !== undefined) setSystemRevenue(data.systemRevenue);
            })
            .catch(e => console.error("Failed to load transactions", e));
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleBalanceReq = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
        if (!currentUser) return;
        try {
            await db.handleBalanceRequest(currentUser.id, reqId, action);
            toast.success(`Solicitud ${action === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`);
            loadData();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const handleVipReq = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
        if (!currentUser) return;
        try {
            await db.handleVipRequest(currentUser.id, reqId, action);
            toast.success(`VIP ${action === 'APPROVED' ? 'Activado' : 'Rechazado'}`);
            loadData();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const getRemainingTime = (expiry: number) => {
        const diff = expiry * 1000 - now;
        if (diff <= 0) return "Expirado";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
    };

    const stats = useMemo(() => {
        const bal = requests.balance || [];
        const vip = requests.vip || [];
        
        const pendingCount = bal.length + vip.length;
        const totalPendingAmount = bal.reduce((acc, r) => acc + Number(r.amount), 0);
        return { pendingCount, totalPendingAmount };
    }, [requests]);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* KPI Cards - REVENUE SEPARATED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Caja Chica (Ingresos)</p>
                        <h3 className="text-2xl font-bold text-emerald-400">+{systemRevenue.toFixed(2)} $</h3>
                        <p className="text-[10px] text-slate-500">Separado de tu saldo personal</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <TrendingUp size={24} />
                    </div>
                </div>
                
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
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">VIPs Activos</p>
                        <h3 className="text-2xl font-bold text-white">{activeVips.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Crown size={24} />
                    </div>
                </div>
            </div>

            {/* Active VIPs List */}
            {activeVips.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                        <Crown size={18} className="text-amber-400"/>
                        <h3 className="font-bold text-white">Usuarios con Membresía Activa</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {activeVips.map(u => (
                            <div key={u.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-500"><User size={20}/></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm truncate">{u.username}</div>
                                    <div className="text-xs text-amber-400 font-mono">Expira: {getRemainingTime(u.vipExpiry)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIP Requests Table */}
            {requests.vip && requests.vip.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm mb-6">
                    <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                        <FileText size={18} className="text-blue-400"/>
                        <h3 className="font-bold text-white">Solicitudes de Planes / Recargas</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-3">Usuario</th>
                                    <th className="px-6 py-3">Plan</th>
                                    <th className="px-6 py-3">Ref. Pago</th>
                                    <th className="px-6 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {requests.vip.map(req => {
                                    const rawSnapshot = req.planSnapshot as any;
                                    let plan: any = {};
                                    try {
                                        plan = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot) : rawSnapshot;
                                    } catch (e) { plan = { name: 'Error Plan', price: 0 }; }
                                        
                                    return (
                                        <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-bold text-white">{req.username}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-white font-medium">{plan.name}</div>
                                                <div className="text-[10px] text-slate-500">{plan.type === 'ACCESS' ? `${plan.durationDays} Días` : `+${plan.bonusPercent}% Bono`} - <span className="text-amber-400 font-bold">{plan.price} CUP</span></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {req.paymentRef ? (
                                                    <div className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-1 rounded w-fit">
                                                        <span className="font-mono text-xs">{req.paymentRef}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 italic text-xs">Sin referencia</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleVipReq(req.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg" title="Confirmar Pago y Aprobar"><Check size={16}/></button>
                                                    <button onClick={() => handleVipReq(req.id, 'REJECTED')} className="bg-slate-800 hover:bg-red-600 text-white p-2 rounded-lg" title="Rechazar"><X size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Balance Requests Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                    <Wallet size={18} className="text-indigo-400"/>
                    <h3 className="font-bold text-white">Solicitudes de Saldo (Legacy)</h3>
                </div>
                
                {(!requests.balance || requests.balance.length === 0) ? (
                    <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                        <Check size={32} className="text-emerald-500/50"/>
                        <p>No hay solicitudes de saldo pendientes.</p>
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
                                {requests.balance.map(req => (
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
                                                    onClick={() => handleBalanceReq(req.id, 'APPROVED')} 
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                    title="Aprobar"
                                                >
                                                    <Check size={16}/> <span className="hidden md:inline">Aprobar</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleBalanceReq(req.id, 'REJECTED')} 
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
                    <h3 className="font-bold text-white">Historial de Transacciones Globales</h3>
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
                                    const isVipRev = t.type === 'VIP_REVENUE';
                                    const isVip = t.type === 'VIP';
                                    const isMarket = t.type === 'MARKETPLACE';
                                    
                                    return (
                                        <tr key={t.id} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                    isDeposit ? 'bg-emerald-500/20 text-emerald-400' : 
                                                    (isVip ? 'bg-amber-500/20 text-amber-400' : 
                                                    (isVipRev ? 'bg-indigo-500/20 text-indigo-400' : 
                                                    (isMarket ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400')))
                                                }`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isDeposit || isVip ? (
                                                    <div className="flex items-center gap-1 text-slate-300">
                                                        <ArrowDownLeft size={14} className="text-emerald-500"/> Usuario: {t.buyerName}
                                                    </div>
                                                ) : isVipRev ? (
                                                    <div className="flex items-center gap-1 text-slate-300">
                                                        <TrendingUp size={14} className="text-emerald-500"/> Ingreso por VIP/Recarga
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
