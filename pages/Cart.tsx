
import React, { useState, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Trash2, ShoppingBag, Truck, CheckCircle, AlertCircle, Loader2, Minus, Plus, Tag, ArrowRight, Wallet } from 'lucide-react';

export default function Cart() {
    const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    
    // Shipping Form
    const [shipping, setShipping] = useState(user?.shippingDetails || {
        fullName: '',
        address: '',
        city: '',
        zipCode: '',
        country: '',
        phoneNumber: ''
    });

    // Advanced Calculations
    const totals = useMemo(() => {
        return cart.reduce((acc, item) => {
            const qty = item.quantity;
            const price = Number(item.price);
            // Fallback to price if originalPrice is missing or 0
            const originalPrice = (item.originalPrice && item.originalPrice > 0) ? Number(item.originalPrice) : price;
            
            acc.subtotal += originalPrice * qty;
            acc.total += price * qty;
            acc.itemCount += qty;
            return acc;
        }, { subtotal: 0, total: 0, itemCount: 0 });
    }, [cart]);

    const savings = totals.subtotal - totals.total;
    const savingsPercent = totals.subtotal > 0 ? Math.round((savings / totals.subtotal) * 100) : 0;

    const handleCheckout = async () => {
        if (!user) return;
        if (cart.length === 0) return;
        if (!shipping.address || !shipping.fullName) {
             toast.error("Por favor completa los datos de envío");
             return;
        }

        setLoading(true);
        try {
            await db.checkoutCart(user.id, cart, shipping);
            clearCart();
            refreshUser();
            toast.success("¡Pedido realizado con éxito!");
            navigate('/profile');
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 animate-in fade-in">
                <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
                    <ShoppingBag size={48} className="opacity-50"/>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Tu carrito está vacío</h2>
                <p className="text-slate-400 mb-6">Parece que no has añadido nada aún.</p>
                <button onClick={() => navigate('/marketplace')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg active:scale-95">
                    Ir a la Tienda
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-32 md:pb-20 animate-in fade-in">
            <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <ShoppingBag className="text-indigo-400"/> Tu Carrito 
                <span className="text-sm font-normal text-slate-500 ml-2">({totals.itemCount} artículos)</span>
            </h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Items */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                        {cart.map((item, index) => {
                            const original = (item.originalPrice && item.originalPrice > 0) ? item.originalPrice : item.price;
                            const hasDiscount = original > item.price;

                            return (
                                <div key={item.id} className={`flex gap-4 p-4 ${index !== cart.length - 1 ? 'border-b border-slate-800' : ''}`}>
                                    {/* Image */}
                                    <div className="w-24 h-28 bg-black rounded-xl overflow-hidden shrink-0 border border-slate-800 relative group">
                                        {item.images && item.images[0] && <img src={item.images[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105"/>}
                                        {hasDiscount && (
                                            <div className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br shadow-sm">
                                                -{item.discountPercent}%
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <h4 className="font-bold text-white text-base leading-tight line-clamp-2">{item.title}</h4>
                                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                    <span className="bg-slate-800 px-1.5 rounded">{item.condition}</span>
                                                </p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400 p-1 transition-colors bg-slate-800/50 rounded-full">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-end mt-4">
                                            <div>
                                                {hasDiscount && (
                                                    <div className="text-xs text-slate-500 line-through mb-0.5">{original} $</div>
                                                )}
                                                <div className={`font-mono font-bold text-xl ${hasDiscount ? 'text-red-400' : 'text-amber-400'}`}>
                                                    {item.price} $
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded text-slate-300 transition-colors"><Minus size={14}/></button>
                                                <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded text-slate-300 transition-colors"><Plus size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Checkout Panel */}
                <div className="space-y-6">
                    {/* Order Summary */}
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                        <h3 className="font-bold text-white mb-4 text-lg">Resumen del Pedido</h3>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>Subtotal</span>
                                <span>{totals.subtotal.toFixed(2)} $</span>
                            </div>
                            
                            {savings > 0 && (
                                <div className="flex justify-between text-emerald-400 text-sm font-medium bg-emerald-900/10 p-2 rounded-lg border border-emerald-500/20">
                                    <span className="flex items-center gap-1"><Tag size={14}/> Descuento ({savingsPercent}%)</span>
                                    <span>-{savings.toFixed(2)} $</span>
                                </div>
                            )}

                            <div className="border-t border-slate-800 my-4"></div>

                            <div className="flex justify-between items-end">
                                <span className="text-white font-bold">Total a Pagar</span>
                                <span className="text-3xl font-black text-amber-400 tracking-tight">{totals.total.toFixed(2)} <span className="text-sm text-amber-600">$</span></span>
                            </div>
                        </div>

                        {user && Number(user.balance) < totals.total ? (
                            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl text-center space-y-2 mb-4">
                                <div className="text-red-400 font-bold flex items-center justify-center gap-2"><AlertCircle size={18}/> Saldo Insuficiente</div>
                                <div className="text-slate-400 text-xs">Tienes <strong>{Number(user.balance).toFixed(2)} $</strong> disponibles.</div>
                                <button onClick={() => navigate('/profile')} className="text-xs text-indigo-400 hover:text-white underline mt-1">Recargar Saldo</button>
                            </div>
                        ) : (
                            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 mb-4 flex items-center justify-between">
                                <div className="text-xs text-slate-400">Saldo Disponible</div>
                                <div className="text-sm font-bold text-white flex items-center gap-1"><Wallet size={14} className="text-indigo-400"/> {Number(user?.balance || 0).toFixed(2)} $</div>
                            </div>
                        )}

                        <button 
                            onClick={handleCheckout}
                            disabled={loading || (user ? Number(user.balance) < totals.total : true)}
                            className="hidden md:flex w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-900/20"
                        >
                            {loading ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                            Confirmar Compra
                        </button>
                    </div>

                    {/* Shipping Form (Simplified in Accordion style or Clean Card) */}
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wide text-slate-500"><Truck size={16}/> Datos de Envío</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Nombre Completo" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-colors" />
                            <input type="text" placeholder="Dirección" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-colors" />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Ciudad" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-colors" />
                                <input type="text" placeholder="C.P." value={shipping.zipCode} onChange={e => setShipping({...shipping, zipCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-colors" />
                            </div>
                            <input type="text" placeholder="Teléfono" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-colors" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Checkout Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 safe-area-bottom z-40">
                <div className="flex gap-4 items-center">
                    <div className="flex-1">
                        <div className="text-xs text-slate-400">Total a Pagar</div>
                        <div className="text-xl font-bold text-amber-400">{totals.total.toFixed(2)} $</div>
                    </div>
                    <button 
                        onClick={handleCheckout}
                        disabled={loading || (user ? Number(user.balance) < totals.total : true)}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : 'Pagar'} <ArrowRight size={18}/>
                    </button>
                </div>
            </div>
        </div>
    );
}
