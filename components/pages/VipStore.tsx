
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { VipPlan, SystemSettings } from '../../types';
import { 
    Crown, Check, Zap, Loader2, ArrowLeft, Wallet, 
    CreditCard, Coins, TrendingUp, ShieldCheck, 
    Smartphone, Globe, X, Copy, Info, Clock
} from 'lucide-react';
import { useNavigate, useLocation } from '../Router';

export default function VipStore() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    
    const [plans, setPlans] = useState<VipPlan[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<VipPlan | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    useEffect(() => {
        db.getSystemSettings().then((s: SystemSettings) => {
            setSettings(s);
            if (s.vipPlans) setPlans(s.vipPlans);
            setLoading(false);
        });
    }, []);

    const handleInstantPurchase = async (plan: VipPlan) => {
        if (!user) return;
        if (plan.type && plan.type.toString().toUpperCase() === 'BALANCE') {
            toast.error("Las recargas de saldo requieren pago externo.");
            return;
        }
        if (user.balance < plan.price) {
            toast.error("Saldo insuficiente.");
            return;
        }
        if (!confirm(`¿Canjear ${plan.price} $ por ${plan.durationDays} días VIP?`)) return;

        setSubmitting(true);
        try {
            await db.purchaseVipInstant(user.id, plan);
            toast.success("¡Acceso VIP Activado!");
            refreshUser();
            navigate('/profile');
        } catch (e: any) { toast.error(e.message); }
        finally { setSubmitting(false); }
    };

    const handleTropipayDirect = async (plan: VipPlan) => {
        if (!user) return;
        setSubmitting(true);
        try {
            const res = await db.createPayLink(user.id, plan);
            if (res.paymentUrl) {
                window.location.href = res.paymentUrl;
            }
        } catch (e: any) { toast.error(e.message); setSubmitting(false); }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-amber-500" /></div>;

    // Enhanced defaults for visibility
    const activeMethods = settings?.paymentMethods || {
        manual: { enabled: true, instructions: 'Contacta con soporte.' }
    };

    return (
        <div className="pb-24 pt-6 px-4 max-w-5xl mx-auto animate-in fade-in">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 bg-slate-900 px-4 py-2 rounded-full border border-slate-800 transition-all">
                <ArrowLeft size={20}/> Volver
            </button>

            <div className="text-center mb-12">
                <h1 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">VIP & Recargas</h1>
                <p className="text-slate-400 text-sm uppercase font-bold tracking-widest">Mejora tu experiencia en StreamPay</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => {
                    const isBalance = plan.type && plan.type.toString().toUpperCase() === 'BALANCE';
                    const finalRecharge = plan.price * (1 + (plan.bonusPercent || 0) / 100);

                    return (
                        <div key={plan.id} className={`bg-slate-900 border ${plan.highlight ? 'border-amber-500/50 ring-2 ring-amber-500/10' : 'border-slate-800'} rounded-[32px] p-8 flex flex-col hover:border-indigo-500/50 transition-all group relative overflow-hidden shadow-2xl`}>
                            {plan.highlight && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black px-4 py-1 rounded-bl-xl">POPULAR</div>}
                            <div className="mb-4">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isBalance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                    {isBalance ? 'Recarga de Saldo' : 'Acceso VIP'}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">{plan.name}</h3>
                            <div className="text-4xl font-black text-white mb-6">{plan.price} $</div>
                            
                            <ul className="space-y-4 mb-10 flex-1">
                                {isBalance ? (
                                    <li className="flex gap-3 text-sm text-white items-center bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                                        <Coins size={18} className="text-emerald-400 shrink-0"/>
                                        <span className="font-bold">Recibes: {finalRecharge.toFixed(2)} $</span>
                                    </li>
                                ) : (
                                    <>
                                        <li className="flex gap-3 text-sm text-slate-300 items-center"><Check size={18} className="text-emerald-500"/> Contenido Premium Gratis</li>
                                        <li className="flex gap-3 text-sm text-slate-300 items-center"><Clock size={18} className="text-blue-500"/> Duración: {plan.durationDays} días</li>
                                    </>
                                )}
                            </ul>

                            <div className="space-y-3">
                                {!isBalance && (
                                    <button 
                                        onClick={() => handleInstantPurchase(plan)}
                                        className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        <Wallet size={18}/> Canjear Saldo
                                    </button>
                                )}
                                <button 
                                    onClick={() => { setSelectedPlan(plan); setShowPaymentModal(true); }}
                                    className={`w-full py-3 ${isBalance ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-800 hover:bg-slate-700'} text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95`}
                                >
                                    <CreditCard size={14}/> Pago Externo
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Pagos Externos */}
            {showPaymentModal && selectedPlan && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-white uppercase text-sm tracking-widest">Método de Pago</h3>
                                <p className="text-[10px] text-amber-500 font-bold uppercase">{selectedPlan.name} - {selectedPlan.price} $</p>
                            </div>
                            <button onClick={() => { setShowPaymentModal(false); setSelectedMethod(null); }} className="p-2 hover:bg-white/10 rounded-full text-slate-500"><X/></button>
                        </div>

                        <div className="p-6 space-y-4">
                            {!selectedMethod ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {activeMethods.tropipay?.enabled && (
                                        <button onClick={() => handleTropipayDirect(selectedPlan)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500/50 transition-all group">
                                            <Globe size={24} className="text-blue-400 group-hover:scale-110 transition-transform"/>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center leading-tight">Tropipay Directo</span>
                                        </button>
                                    )}
                                    {activeMethods.card?.enabled && (
                                        <button onClick={() => setSelectedMethod('card')} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500/50 transition-all group">
                                            <CreditCard size={24} className="text-emerald-400 group-hover:scale-110 transition-transform"/>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center leading-tight">Tarjeta / Transfer</span>
                                        </button>
                                    )}
                                    {activeMethods.mobile?.enabled && (
                                        <button onClick={() => setSelectedMethod('mobile')} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500/50 transition-all group">
                                            <Smartphone size={24} className="text-pink-400 group-hover:scale-110 transition-transform"/>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center leading-tight">Saldo Móvil</span>
                                        </button>
                                    )}
                                    {activeMethods.manual?.enabled && (
                                        <button onClick={() => setSelectedMethod('manual')} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500/50 transition-all group">
                                            <Wallet size={24} className="text-amber-400 group-hover:scale-110 transition-transform"/>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center leading-tight">Solicitud Manual</span>
                                        </button>
                                    )}
                                    {(!activeMethods.tropipay?.enabled && !activeMethods.card?.enabled && !activeMethods.mobile?.enabled && !activeMethods.manual?.enabled) && (
                                        <div className="col-span-2 py-10 text-center text-slate-500 uppercase text-[10px] font-black italic tracking-widest">No hay métodos configurados</div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <button onClick={() => setSelectedMethod(null)} className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-1"><ArrowLeft size={12}/> Cambiar Método</button>
                                    
                                    <div className="bg-slate-950 p-6 rounded-3xl border border-indigo-500/20 relative">
                                        <h4 className="text-xs font-black text-white uppercase mb-4 tracking-widest flex items-center gap-2">
                                            <Info size={14} className="text-indigo-400"/> Instrucciones
                                        </h4>
                                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap italic">
                                            {(activeMethods as any)[selectedMethod]?.instructions || "Consulte con el administrador."}
                                        </p>
                                        <button 
                                            onClick={() => handleCopy((activeMethods as any)[selectedMethod]?.instructions)}
                                            className="absolute top-4 right-4 p-2 bg-slate-900 rounded-xl text-slate-500 hover:text-white"
                                        >
                                            <Copy size={16}/>
                                        </button>
                                    </div>

                                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                                        <ShieldCheck size={20} className="text-amber-500 shrink-0"/>
                                        <p className="text-[11px] text-amber-200 leading-snug">Una vez realizado el pago, envíe el comprobante al administrador para activar su membresía o recarga.</p>
                                    </div>

                                    <button 
                                        onClick={() => setShowPaymentModal(false)}
                                        className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em]"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
