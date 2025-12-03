
import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Trash2, Plus, Minus, ArrowRight, Loader2, CreditCard, History, ShoppingBag } from 'lucide-react';

export default function Cart() {
  const { items, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'REVIEW' | 'SHIPPING'>('REVIEW');
  const [processing, setProcessing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-fill from Profile
  useEffect(() => {
      if (user) {
          setName(user.shippingDetails?.fullName || user.username || '');
          setBank(user.shippingDetails?.bankAccount || '');
          setPhone(user.shippingDetails?.phoneNumber || '');
          setAddress(user.shippingDetails?.address || '');
          setNotes(user.shippingDetails?.notes || '');
      }
  }, [user]);

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
              address,
              notes
          };
          
          await db.checkoutCart(user.id, items.map(i => ({ id: i.id, quantity: i.cartQuantity })), shippingData);
          
          alert("Pedido realizado con éxito!");
          clearCart();
          refreshUser();
          navigate('/profile?tab=ORDERS');
      } catch (e: any) {
          alert("Falló el pago: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const EmptyState = () => (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={40} className="opacity-50" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Tu carrito está vacío</h2>
          <p className="mb-6 text-center max-w-xs">Parece que aún no has añadido nada. Explora la tienda para encontrar ofertas.</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => navigate('/marketplace')} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-500 transition-all">
                  Ir a la Tienda
              </button>
              <button onClick={() => navigate('/profile?tab=ORDERS')} className="bg-slate-800 text-slate-300 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                  <History size={18} /> Ver Mis Pedidos Pasados
              </button>
          </div>
      </div>
  );

  if (items.length === 0) return <div className="max-w-2xl mx-auto pb-24"><EmptyState /></div>;

  return (
    <div className="max-w-2xl mx-auto pb-24">
       <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-white">Carrito de Compras</h1>
           <button 
              onClick={() => navigate('/profile?tab=ORDERS')} 
              className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-white bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
           >
               <History size={14} /> Historial
           </button>
       </div>

       {step === 'REVIEW' && (
           <>
               <div className="space-y-4 mb-8">
                   {items.map(item => (
                       <div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex gap-4 items-center animate-in slide-in-from-bottom-2 duration-300">
                           <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden shrink-0 relative group">
                               {item.media[0].type === 'image' ? (
                                   <img src={item.media[0].url} className="w-full h-full object-cover"/>
                               ) : (
                                   <div className="w-full h-full bg-slate-900 flex items-center justify-center"><ShoppingBag size={20} className="text-slate-600"/></div>
                               )}
                           </div>
                           <div className="flex-1 min-w-0">
                               <h3 className="font-bold text-white truncate text-sm md:text-base">{item.title}</h3>
                               <p className="text-xs text-slate-400 mb-1">@{item.sellerName}</p>
                               <div className="text-emerald-400 font-bold font-mono">{item.price} Saldo</div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                               <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                               <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800">
                                   <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 text-slate-400 hover:text-white"><Minus size={12}/></button>
                                   <span className="font-mono w-6 text-center text-sm">{item.cartQuantity}</span>
                                   <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 text-slate-400 hover:text-white"><Plus size={12}/></button>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
               
               <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
                   <div className="flex justify-between items-center mb-4">
                       <span className="text-slate-400 text-sm font-bold uppercase">Total Estimado</span>
                       <span className="text-3xl font-bold text-emerald-400 font-mono">{cartTotal.toFixed(2)}</span>
                   </div>
                   <button onClick={() => setStep('SHIPPING')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                       Proceder al Pago <ArrowRight size={18}/>
                   </button>
               </div>
           </>
       )}

       {step === 'SHIPPING' && (
           <form onSubmit={handleCheckout} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 shadow-xl">
                   <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2"><CreditCard size={18} className="text-emerald-400"/> Datos de Envío</h3>
                   
                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre del Destinatario</label>
                       <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Ej: Juan Pérez" />
                   </div>

                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dirección Exacta</label>
                       <input type="text" required value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Ciudad, Barrio, Casa..." />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Móvil / WhatsApp</label>
                           <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500" placeholder="+505..." />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cta. Reembolso (Opcional)</label>
                           <input type="text" value={bank} onChange={e => setBank(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Banco/Wallet" />
                       </div>
                   </div>

                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Notas Adicionales</label>
                       <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Instrucciones de entrega..."></textarea>
                   </div>
               </div>

               <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400 text-sm font-bold">Total a Debitar</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">{cartTotal.toFixed(2)} Saldo</span>
               </div>

               <div className="flex gap-4">
                   <button type="button" onClick={() => setStep('REVIEW')} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors">Atrás</button>
                   <button type="submit" disabled={processing} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95 transition-all">
                       {processing ? <Loader2 className="animate-spin"/> : 'Confirmar Compra'}
                   </button>
               </div>
           </form>
       )}
    </div>
  );
}
