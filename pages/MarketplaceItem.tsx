


import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../components/Router';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Loader2, ArrowLeft, User, ShieldCheck, ShoppingCart, Edit2, Save } from 'lucide-react';

export default function MarketplaceItemView() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(0);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);

  useEffect(() => {
    if (!id) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    db.getMarketplaceItem(id).then(i => {
        setItem(i);
        setEditPrice(i.price);
        setEditStock(i.stock);
        setEditDiscount(i.discountPercent);
        setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
      if (item) {
          addToCart(item);
          alert("Añadido al carrito");
      }
  };

  const handleSaveEdit = async () => {
      if (!user || !item) return;
      try {
          await db.editListing(item.id, user.id, {
              price: editPrice,
              stock: editStock,
              discountPercent: editDiscount
          });
          setItem({ ...item, price: editPrice, stock: editStock, discountPercent: editDiscount });
          setIsEditing(false);
          alert("Actualizado exitosamente");
      } catch(e: any) {
          alert("Fallo al actualizar: " + e.message);
      }
  };

  if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>;
  if (!item) return <div className="text-center p-10 text-slate-500">Artículo no encontrado.</div>;

  const isSeller = user && user.id === item.sellerId;
  const isSoldOut = item.stock <= 0;
  const originalPrice = item.price / (1 - (item.discountPercent / 100));

  return (
    <div className="max-w-4xl mx-auto pb-20">
        <button onClick={() => navigate('/marketplace')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
            <ArrowLeft size={18} /> Volver a la Tienda
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Media Gallery */}
            <div className="space-y-4">
                <div className="aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative">
                     {item.media.length > 0 && (
                         item.media[activeMedia].type === 'image' ? (
                             <img src={item.media[activeMedia].url} className="w-full h-full object-cover" />
                         ) : (
                             <video src={item.media[activeMedia].url} className="w-full h-full object-cover" controls />
                         )
                     )}
                     {isSoldOut && (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                             <span className="bg-slate-700 text-white font-black text-2xl px-6 py-2 transform -rotate-12 border-4 border-white">AGOTADO</span>
                         </div>
                     )}
                </div>
                {item.media.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {item.media.map((m, i) => (
                            <div key={i} onClick={() => setActiveMedia(i)} className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 ${activeMedia === i ? 'border-emerald-500' : 'border-transparent'}`}>
                                {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">{item.title}</h1>
                
                {isEditing ? (
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                 <label className="text-xs text-slate-500 uppercase font-bold">Precio</label>
                                 <input type="number" value={editPrice} onChange={e=>setEditPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                             </div>
                             <div>
                                 <label className="text-xs text-slate-500 uppercase font-bold">Stock</label>
                                 <input type="number" value={editStock} onChange={e=>setEditStock(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                             </div>
                        </div>
                        <div>
                             <label className="text-xs text-slate-500 uppercase font-bold">Descuento %</label>
                             <input type="number" value={editDiscount} onChange={e=>setEditDiscount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <button onClick={handleSaveEdit} className="w-full bg-emerald-600 text-white font-bold py-2 rounded flex items-center justify-center gap-2"><Save size={16}/> Guardar Cambios</button>
                    </div>
                ) : (
                    <div className="mb-6">
                        {item.discountPercent > 0 && (
                             <div className="text-sm text-slate-400 line-through font-mono">{originalPrice.toFixed(2)} $</div>
                        )}
                        <div className="text-4xl font-mono font-bold text-emerald-400">{item.price} <span className="text-lg text-emerald-700">Saldo</span></div>
                        
                        {item.discountPercent > 0 && (
                            <span className="inline-block mt-1 bg-red-600/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded border border-red-500/20">
                                {item.discountPercent}% OFF
                            </span>
                        )}
                        {item.stock < 3 && item.stock > 0 && (
                             <span className="inline-block mt-1 ml-2 bg-amber-600/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded border border-amber-500/20">
                                ¡Solo quedan {item.stock}!
                            </span>
                        )}
                    </div>
                )}

                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        {item.sellerAvatarUrl ? <img src={item.sellerAvatarUrl} className="w-full h-full object-cover"/> : <User size={24} className="m-3 text-slate-500"/>}
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500 font-bold uppercase">Vendedor</div>
                        <div className="font-bold text-white text-lg">{item.sellerName}</div>
                    </div>
                    {isSeller && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="p-2 bg-slate-800 text-slate-400 rounded-full hover:text-white"><Edit2 size={16}/></button>
                    )}
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 mb-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Descripción</h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{item.description}</p>
                </div>

                {!isSoldOut && !isSeller && (
                    <button 
                        onClick={handleAddToCart}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <ShoppingCart size={20} /> Añadir al Carrito
                    </button>
                )}

                {isSeller && (
                    <div className="bg-indigo-900/20 text-indigo-300 p-4 rounded-xl text-center font-bold border border-indigo-500/30">
                        Estás vendiendo este artículo. Stock: {item.stock}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}