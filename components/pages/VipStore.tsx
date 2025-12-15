
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { VipPlan, SystemSettings } from '../../types';
import { Crown, Check, Star, Zap, Loader2, ArrowLeft, X, Copy, CreditCard, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useLocation } from '../Router';

export default function VipStore() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<VipPlan[]>([]);
    const [instructions, setInstructions] = useState('');
    const [conversionRate, setConversionRate] = useState(1);
    
    // Modal State
    const [selectedPlan, setSelectedPlan] = useState<VipPlan | null>(null);
    const [paymentRef, setPaymentRef] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        db.getSystemSettings().then((s: SystemSettings) => {
            if (s.vipPlans) setPlans(s.vipPlans);
            if (s.paymentInstructions) setInstructions(s.paymentInstructions);
            if (s.currencyConversion) setConversionRate(s.currencyConversion);
            setLoading(false);
        });
    }, []);

    // Check for payment return URL
    useEffect(() => {
        // Parsing Hash URL: #/vip?status=success&ref=VP-xyz
        // Simple manual parsing since it's a hash router
        if (location.pathname === '/vip' && window.location.href.includes('status=success') && !verifying) {
            const params = new URLSearchParams(window.location.href.split('?')[1]);
            const ref = params.get('ref');
            if (ref && user) {
                verifyAutoPayment(ref);
            }
        }
    }, [location, user]);

    const verifyAutoPayment = async (ref: string) => {
        if (!user) return;
        setVerifying(true);
        toast.info("Verificando pago con Tropipay...");
        try {
            await db.verifyPayment(user.id, ref);
            toast.success("¡Pago confirmado! VIP Activado.");
            refreshUser();
            // Clear URL
            window.location.hash = '/vip';
        } catch (e: any) {
            toast.error("Error verificando pago: " + e.message);
        } finally {
            setVerifying(false);
        }
    };

    const handleConfirmRequest = async () => {
        if (!user || !selectedPlan) return;
        setSubmitting(true);
        try {
            await db.requestVip(user.id, selectedPlan, paymentRef);
            toast.success("Solicitud manual enviada.");
            setSelectedPlan(null);
            setPaymentRef('');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleTropipay = async () => {
        if (!user || !selectedPlan) return;
        setSubmitting(true);
        try {
            const url = await db.createPaymentLink(user.id, selectedPlan);
            window.location.href = url; // Redirect to Payment Gateway
        } catch (e: any) {
            toast.error("Error creando link: " + e.message);
            setSubmitting(false);
        }
    };

    const isVip = user?.vipExpiry && user.vipExpiry > (Date.now() / 1000);

    return (
        <div className="pb-24 pt-4 px-4 max-w-5xl mx-auto min-h-screen relative">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
                <ArrowLeft size={20}/> Volver
            </button>

            <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 mb-2">Membresía VIP & Recargas</h1>
                <p className="text-slate-400">Obtén acceso ilimitado o bonificaciones exclusivas.</p>
                {isVip && (
                    <div className="mt-4 inline-block bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border border-amber-500/50 rounded-full px-4 py-2 text-amber-300 font-bold text-sm animate-pulse">
                        <Crown size={16} className="inline mr-2 -mt-1"/> 
                        Tu VIP expira: {new Date(user.vipExpiry! * 1000).toLocaleDateString()}
                    </div>
                )}
            </div>

            {loading || verifying ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Loader2 className="animate-spin text-amber-500" size={40}/>
                    {verifying && <p className="text-amber-400 animate-pulse">Verificando transacción...</p>}
                </div>
            ) : (
                <>
                    {/* ACCESS PLANS */}
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Crown className="text-amber-400"/> Acceso Total</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {plans.filter(p => p.type === 'ACCESS').map(plan => (
                            <div key={plan.id} className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-amber-500/50 transition-all group overflow-hidden">
                                {plan.highlight && (
                                    <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                                        Recomendado
                                    </div>
                                )}
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">{plan.name}</h3>
                                    <div className="text-3xl font-black text-amber-400 mt-2">{plan.price} <span className="text-sm font-normal text-slate-500">Saldo</span></div>
                                </div>
                                
                                <ul className="space-y-3 mb-8 flex-1">
                                    <li className="flex items-start gap-3 text-sm text-slate-300">
                                        <Check size={16} className="text-emerald-400 mt-0.5 shrink-0"/>
                                        <span>Acceso a <strong>TODOS</strong> los videos</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-sm text-slate-300">
                                        <Check size={16} className="text-emerald-400 mt-0.5 shrink-0"/>
                                        <span>Duración: <strong>{plan.durationDays} días</strong></span>
                                    </li>
                                    {plan.description && (
                                        <li className="flex items-start gap-3 text-sm text-slate-400 italic">
                                            <Star size={14} className="text-amber-600 mt-0.5 shrink-0"/>
                                            <span>{plan.description}</span>
                                        </li>
                                    )}
                                </ul>

                                <button 
                                    onClick={() => setSelectedPlan(plan)}
                                    className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-lg shadow-amber-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Zap size={18}/> Solicitar Ahora
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* BALANCE PLANS */}
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Zap className="text-indigo-400"/> Recargas con Bono</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.filter(p => p.type === 'BALANCE').map(plan => (
                            <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-indigo-500/50 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-white">{plan.name}</h3>
                                    <span className="bg-indigo-900/50 text-indigo-300 text-xs font-bold px-2 py-1 rounded border border-indigo-500/30">+{plan.bonusPercent}% Extra</span>
                                </div>
                                
                                <div className="text-center py-6 bg-slate-950 rounded-xl mb-6 border border-slate-800">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Pagas</div>
                                    <div className="text-2xl font-bold text-white mb-2">{plan.price} Saldo</div>
                                    <div className="w-full h-px bg-slate-800 my-2"></div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Recibes</div>
                                    <div className="text-3xl font-black text-emerald-400">
                                        {(plan.price + (plan.price * ((plan.bonusPercent||0)/100))).toFixed(0)} <span className="text-sm text-emerald-600">Saldo</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setSelectedPlan(plan)}
                                    className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Solicitar Recarga
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* PAYMENT INSTRUCTIONS MODAL */}
            {selectedPlan && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <CreditCard size={20} className="text-emerald-400"/> Método de Pago
                            </h3>
                            <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30 mb-6 text-center">
                                <div className="text-sm text-indigo-300 uppercase font-bold mb-1">Total a Pagar</div>
                                <div className="text-4xl font-black text-white">{selectedPlan.price} <span className="text-sm">Saldo</span></div>
                                <div className="text-xs text-slate-400 mt-2">Aprox: { (selectedPlan.price / conversionRate).toFixed(2) } EUR</div>
                            </div>

                            {/* Auto Payment Option */}
                            <button 
                                onClick={handleTropipay}
                                disabled={submitting}
                                className="w-full mb-6 py-4 bg-white hover:bg-slate-200 text-black font-bold rounded-xl flex items-center justify-center gap-2 shadow-xl transition-transform active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin"/> : <img src="https://www.tropipay.com/img/logos/tropipay-logo-color.svg" className="h-6" alt="Tropipay" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                                {submitting ? 'Creando Link...' : 'Pagar Ahora con Tropipay'}
                            </button>

                            <div className="relative flex py-5 items-center">
                                <div className="flex-grow border-t border-slate-700"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase font-bold">O Pago Manual</span>
                                <div className="flex-grow border-t border-slate-700"></div>
                            </div>

                            <div className="mb-6 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Instrucciones:</label>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap font-mono">
                                    {instructions || "El administrador no ha configurado instrucciones de pago aún. Contacta soporte."}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Referencia de Pago Manual</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="Ej: Transferencia #123456"
                                    value={paymentRef}
                                    onChange={e => setPaymentRef(e.target.value)}
                                />
                                <button 
                                    onClick={handleConfirmRequest}
                                    disabled={submitting || !paymentRef.trim()}
                                    className="w-full mt-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
                                >
                                    Enviar Comprobante Manual
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
