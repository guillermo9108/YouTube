import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Trash2, ShoppingBag, Truck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function Cart() {
    const { cart, removeFromCart, clearCart, total } = useCart();
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
             alert("Please fill in shipping details");
             return;
        }

        setLoading(true);
        try {
            await db.checkoutCart(user.id, cart, shipping);
            clearCart();
            refreshUser();
            alert("Order placed successfully!");
            navigate('/profile');
        } catch (e: any) {
            alert("Checkout Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
                <ShoppingBag size={48} className="mb-4 opacity-50"/>
                <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
                <button onClick={() => navigate('/marketplace')} className="text-indigo-400 hover:underline">Browse Marketplace</button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-20">
            <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><ShoppingBag className="text-indigo-400"/> Checkout</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Items List */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2">Items ({cart.length})</h3>
                    {cart.map((item) => (
                        <div key={item.cartId} className="flex gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
                            <div className="w-20 h-20 bg-black rounded-lg overflow-hidden shrink-0">
                                {item.images && item.images[0] && <img src={item.images[0]} className="w-full h-full object-cover"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate">{item.title}</h4>
                                <p className="text-xs text-slate-400 mb-2">{item.condition}</p>
                                <div className="text-amber-400 font-bold">{item.price} $</div>
                            </div>
                            <button onClick={() => item.cartId && removeFromCart(item.cartId)} className="text-slate-500 hover:text-red-400 self-center p-2"><Trash2 size={18}/></button>
                        </div>
                    ))}
                    
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mt-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-white">Total</span>
                            <span className="text-amber-400">{total} $</span>
                        </div>
                        {user && user.balance < total && (
                            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle size={12}/> Insufficient Balance ({user.balance} $)
                            </div>
                        )}
                    </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit">
                    <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-4 flex items-center gap-2"><Truck size={18}/> Shipping Details</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                            <input type="text" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                                <input type="text" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zip Code</label>
                                <input type="text" value={shipping.zipCode} onChange={e => setShipping({...shipping, zipCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                            <input type="text" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                    </div>

                    <button 
                        onClick={handleCheckout}
                        disabled={loading || (user ? user.balance < total : true)}
                        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                        Confirm Order
                    </button>
                </div>
            </div>
        </div>
    );
}