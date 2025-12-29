
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { VipPlan, SystemSettings } from '../../types';
import { Crown, Check, Zap, Loader2, ArrowLeft, Wallet, CreditCard } from 'lucide-react';
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

        if (!confirm(`¿Canjear ${plan.price} $ por ${plan.durationDays} días de acceso VIP?`)) return;

        setSubmitting(true);
        try {
            await db.purchaseVipInstant(user.id, plan);
            toast.success("¡VIP Activado instantáneamente!");
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
                <h1 className="text-3xl font-black text-white mb-2">Pase VIP StreamPay</h1>
                <p className="text-slate-400">Acceso ilimitado a todo el contenido de los administradores.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 flex flex-col hover:border-amber-500/50 transition-all group relative overflow-hidden">
                        {plan.highlight && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black px-4 py-1 rounded-bl-xl">POPULAR</div>}
                        
                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <div className="text-4xl font-black text-amber-400 mb-6">{plan.price} <span className="text-sm font-normal text-slate-500">$</span></div>
                        
                        <ul className="space-y-4 mb-10 flex-1">
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Check size={18} className="text-emerald-500 shrink-0"/>
                                <span>Contenido Admin <strong>GRATIS</strong></span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Check size={18} className="text-emerald-500 shrink-0"/>
                                <span>Duración: {plan.durationDays} días</span>
                            </li>
                        </ul>

                        <div className="space-y-3">
                            <button 
                                onClick={() => handleInstantPurchase(plan)}
                                disabled={submitting}
                                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin"/> : <Wallet size={18}/>}
                                Comprar con mi Saldo
                            </button>
                            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all">
                                <CreditCard size={14} className="inline mr-2"/> Pago Externo
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
