
import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Trash2, ShoppingBag, Truck, CheckCircle, AlertCircle, Loader2, Minus, Plus } from 'lucide-react';

export default function Cart() {
    const { cart, removeFromCart, updateQuantity, clearCart, total } = useCart();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
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

    const handleCheckout = async () => {
        if (!user) return;
        if (cart.length === 0) return;
        if (!shipping.address || !shipping.fullName) {
             alert("Por favor completa los datos de envío");
             return;
        }

        setLoading(true);
        try {
            await db.checkoutCart(user.id, cart, shipping);
            clearCart();
            refreshUser();
            alert("¡Pedido realizado con éxito!");
            navigate('/profile');
        } catch (e: any) {
            alert("Error en la compra: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
                <ShoppingBag size={48} className="mb-4 opacity-50"/>
                <h2 className="text-xl font-bold text-white mb-2">Tu carrito está vacío</h2>
                <button onClick={() => navigate('/marketplace')} className="text-indigo-400 hover:underline">Ir a la Tienda</button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-20">
            <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><ShoppingBag className="text-indigo-400"/> Finalizar Compra</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Items List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2">Artículos ({cart.length})</h3>
                    {cart.map((item) => (
                        <div key={item.id} className="flex gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
                            <div className="w-20 h-24 bg-black rounded-lg overflow-hidden shrink-0">
                                {item.images && item.images[0] && <img src={item.images[0]} className="w-full h-full object-cover"/>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-white truncate">{item.title}</h4>
                                    <p className="text-xs text-slate-400 mb-2">{item.condition}</p>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-amber-400 font-bold">{item.price} $</div>
                                    <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-300"><Minus size={14}/></button>
                                        <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-700 rounded text-slate-300"><Plus size={14}/></button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400 self-start p-1"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mt-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-white">Total a Pagar</span>
                            <span className="text-amber-400 font-mono text-xl">{total.toFixed(2)} $</span>
                        </div>
                        {user && Number(user.balance) < total && (
                            <div className="mt-2 text-xs text-red-400 flex items-center gap-1 bg-red-900/20 p-2 rounded">
                                <AlertCircle size={12}/> Saldo Insuficiente (Tienes {user.balance} $)
                            </div>
                        )}
                    </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit">
                    <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-4 flex items-center gap-2"><Truck size={18}/> Datos de Envío</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                            <input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                            <input type="text" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ciudad</label>
                                <input type="text" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código Postal</label>
                                <input type="text" value={shipping.zipCode} onChange={e => setShipping({...shipping, zipCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                            <input type="text" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                    </div>

                    <button 
                        onClick={handleCheckout}
                        disabled={loading || (user ? Number(user.balance) < total : true)}
                        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                        Confirmar Pedido ({total.toFixed(2)} $)
                    </button>
                </div>
            </div>
        </div>
    );
}
