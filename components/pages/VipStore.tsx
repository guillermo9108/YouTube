
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { VipPlan, SystemSettings } from '../../types';
import { Crown, Check, Zap, Loader2, ArrowLeft, Wallet, CreditCard, Coins, TrendingUp } from 'lucide-react';
import { useNavigate } from '../Router';

export default function VipStore() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [plans, setPlans] = useState<VipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        db.getSystemSettings().then((s: SystemSettings) => {
            if (s.vipPlans) setPlans(s.vipPlans);
            setLoading(false);
        });
    }, []);

    const handleInstantPurchase = async (plan: VipPlan) => {
        if (!user) return;
        if (user.balance < plan.price) {
            toast.error("Saldo insuficiente. Por favor recarga primero.");
            return;
        }

        const confirmMsg = plan.type === 'BALANCE' 
            ? `¿Canjear ${plan.price} $ por una recarga de ${(plan.price * (1 + (plan.bonusPercent || 0) / 100)).toFixed(2)} $?`
            : `¿Canjear ${plan.price} $ por ${plan.durationDays} días de acceso VIP?`;

        if (!confirm(confirmMsg)) return;

        setSubmitting(true);
        try {
            await db.purchaseVipInstant(user.id, plan);
            toast.success(plan.type === 'BALANCE' ? "¡Saldo acreditado!" : "¡VIP Activado!");
            refreshUser();
            navigate('/profile');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-amber-500" /></div>;

    return (
        <div className="pb-24 pt-6 px-4 max-w-5xl mx-auto animate-in fade-in">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8">
                <ArrowLeft size={20}/> Volver
            </button>

            <div className="text-center mb-12">
                <h1 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">Centro de Recarga & VIP</h1>
                <p className="text-slate-400 text-sm uppercase font-bold tracking-widest">Optimiza tu capital dentro de la plataforma</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => {
                    const isBalance = plan.type === 'BALANCE';
                    const finalRecharge = plan.price * (1 + (plan.bonusPercent || 0) / 100);

                    return (
                        <div key={plan.id} className={`bg-slate-900 border ${plan.highlight ? 'border-amber-500/50 ring-2 ring-amber-500/10' : 'border-slate-800'} rounded-[32px] p-8 flex flex-col hover:border-indigo-500/50 transition-all group relative overflow-hidden shadow-2xl`}>
                            {plan.highlight && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black px-4 py-1 rounded-bl-xl">POPULAR</div>}
                            
                            <div className="mb-4">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isBalance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                    {isBalance ? 'Plan de Recarga' : 'Pase de Acceso'}
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">{plan.name}</h3>
                            <div className="text-4xl font-black text-white mb-6">
                                {plan.price} <span className="text-sm font-normal text-slate-500">$</span>
                            </div>
                            
                            <ul className="space-y-4 mb-10 flex-1">
                                {isBalance ? (
                                    <>
                                        <li className="flex gap-3 text-sm text-slate-300 items-center">
                                            <TrendingUp size={18} className="text-emerald-500 shrink-0"/>
                                            <span>Bonificación: <strong>+{plan.bonusPercent}%</strong></span>
                                        </li>
                                        <li className="flex gap-3 text-sm text-white items-center bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                                            <Coins size={18} className="text-emerald-400 shrink-0"/>
                                            <span className="font-bold">Recibes: {finalRecharge.toFixed(2)} $</span>
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li className="flex gap-3 text-sm text-slate-300">
                                            <Check size={18} className="text-emerald-500 shrink-0"/>
                                            <span>Contenido Admin <strong>GRATIS</strong></span>
                                        </li>
                                        <li className="flex gap-3 text-sm text-slate-300">
                                            <Check size={18} className="text-emerald-500 shrink-0"/>
                                            <span>Duración: {plan.durationDays} días</span>
                                        </li>
                                    </>
                                )}
                            </ul>

                            <div className="space-y-3">
                                <button 
                                    onClick={() => handleInstantPurchase(plan)}
                                    disabled={submitting}
                                    className={`w-full py-4 ${isBalance ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-500 hover:bg-amber-400'} text-black font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95`}
                                >
                                    {submitting ? <Loader2 className="animate-spin"/> : <Wallet size={18}/>}
                                    Canjear Saldo
                                </button>
                                <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all">
                                    <CreditCard size={14} className="inline mr-2"/> Pago Externo
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-12 p-6 bg-slate-900/50 rounded-3xl border border-slate-800 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    ¿Necesitas saldo? Contacta con un administrador para recargas directas o usa la pasarela de pago externa.
                </p>
            </div>
        </div>
    );
}
