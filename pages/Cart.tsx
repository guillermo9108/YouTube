
import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Trash2, Plus, Minus, ArrowRight, Loader2, CreditCard } from 'lucide-react';

export default function Cart() {
  const { items, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'REVIEW' | 'SHIPPING'>('REVIEW');
  const [processing, setProcessing] = useState(false);

  // Form State
  const [name, setName] = useState(user?.username || '');
  const [bank, setBank] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const handleCheckout = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (items.length === 0) return;
      
      setProcessing(true);
      try {
          const shippingData = {
              name,
              bankAccount: bank,
              phoneNumber: phone,
              notes
          };
          
          await db.checkoutCart(user.id, items.map(i => ({ id: i.id, quantity: i.cartQuantity })), shippingData);
          
          alert("Order Placed Successfully!");
          clearCart();
          refreshUser();
          navigate('/profile');
      } catch (e: any) {
          alert("Checkout failed: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  if (items.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
              <h2 className="text-xl font-bold text-white mb-2">Your Cart is Empty</h2>
              <p className="mb-6">Browse the marketplace to find items.</p>
              <button onClick={() => navigate('/marketplace')} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold">Go Shopping</button>
          </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
       <h1 className="text-2xl font-bold text-white mb-6">Shopping Cart</h1>

       {step === 'REVIEW' && (
           <>
               <div className="space-y-4 mb-8">
                   {items.map(item => (
                       <div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex gap-4 items-center">
                           <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden shrink-0">
                               {item.media[0].type === 'image' ? (
                                   <img src={item.media[0].url} className="w-full h-full object-cover"/>
                               ) : (
                                   <div className="w-full h-full bg-slate-900"></div>
                               )}
                           </div>
                           <div className="flex-1 min-w-0">
                               <h3 className="font-bold text-white truncate">{item.title}</h3>
                               <p className="text-xs text-slate-400">@{item.sellerName}</p>
                               <div className="text-emerald-400 font-bold mt-1">{item.price} Saldo</div>
                           </div>
                           <div className="flex items-center gap-3">
                               <div className="flex items-center bg-slate-800 rounded-lg">
                                   <button onClick={() => updateQuantity(item.id, -1)} className="p-2 text-slate-400 hover:text-white"><Minus size={14}/></button>
                                   <span className="font-mono w-8 text-center">{item.cartQuantity}</span>
                                   <button onClick={() => updateQuantity(item.id, 1)} className="p-2 text-slate-400 hover:text-white"><Plus size={14}/></button>
                               </div>
                               <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg"><Trash2 size={18}/></button>
                           </div>
                       </div>
                   ))}
               </div>
               
               <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                   <div className="flex justify-between items-center mb-4">
                       <span className="text-slate-400">Total</span>
                       <span className="text-2xl font-bold text-emerald-400">{cartTotal.toFixed(2)} Saldo</span>
                   </div>
                   <button onClick={() => setStep('SHIPPING')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                       Proceed to Checkout <ArrowRight size={18}/>
                   </button>
               </div>
           </>
       )}

       {step === 'SHIPPING' && (
           <form onSubmit={handleCheckout} className="space-y-6">
               <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                   <h3 className="font-bold text-white flex items-center gap-2"><CreditCard size={18}/> Shipping & Payment</h3>
                   
                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                       <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" />
                   </div>

                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Bank Account (Optional)</label>
                       <input type="text" value={bank} onChange={e => setBank(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" placeholder="For refunds if needed" />
                   </div>

                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Mobile Number (Optional)</label>
                       <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" placeholder="+1 234..." />
                   </div>

                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Order Notes</label>
                       <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" placeholder="Special instructions for seller..."></textarea>
                   </div>
               </div>

               <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Total to Pay</span>
                    <span className="text-xl font-bold text-emerald-400">{cartTotal.toFixed(2)} Saldo</span>
               </div>

               <div className="flex gap-4">
                   <button type="button" onClick={() => setStep('REVIEW')} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl">Back</button>
                   <button type="submit" disabled={processing} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                       {processing ? <Loader2 className="animate-spin"/> : 'Confirm Payment'}
                   </button>
               </div>
           </form>
       )}
    </div>
  );
}
