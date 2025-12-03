
import React, { useEffect, useState, useLayoutEffect } from 'react';
import { useParams, useNavigate } from '../components/Router';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Loader2, ArrowLeft, User, ShoppingCart, Edit2, Save, ArrowRightLeft } from 'lucide-react';

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
  const [editListPrice, setEditListPrice] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editFinalPrice, setEditFinalPrice] = useState(0);

  useLayoutEffect(() => {
      window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    db.getMarketplaceItem(id).then(i => {
        setItem(i);
        setEditListPrice(i.price);
        setEditStock(i.stock);
        setEditDiscount(i.discountPercent);
        // Calculate initial final price
        const final = i.price * (1 - i.discountPercent / 100);
        setEditFinalPrice(parseFloat(final.toFixed(2)));
        setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleEditListPriceChange = (val: number) => {
      setEditListPrice(val);
      const final = val * (1 - editDiscount / 100);
      setEditFinalPrice(parseFloat(final.toFixed(2)));
  };

  const handleEditDiscountChange = (val: number) => {
      const d = Math.max(0, Math.min(99, val));
      setEditDiscount(d);
      const final = editListPrice * (1 - d / 100);
      setEditFinalPrice(parseFloat(final.toFixed(2)));
  };

  const handleEditFinalPriceChange = (val: number) => {
      setEditFinalPrice(val);
      if (editListPrice > 0) {
          const d = (1 - val / editListPrice) * 100;
          setEditDiscount(parseFloat(Math.max(0, d).toFixed(1)));
      }
  };

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
              price: editListPrice,
              stock: editStock,
              discountPercent: editDiscount
          });
          setItem({ ...item, price: editListPrice, stock: editStock, discountPercent: editDiscount });
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
  
  // Calculate display price (Final Price)
  const finalDisplayPrice = item.price * (1 - (item.discountPercent / 100));

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
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 space-y-4 animate-in fade-in">
                        <div className="text-xs font-bold text-emerald-400 uppercase border-b border-slate-800 pb-2">Editar Precio</div>
                        <div className="grid grid-cols-3 gap-2 items-end">
                             <div>
                                 <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Lista</label>
                                 <input type="number" step="0.01" value={editListPrice} onChange={e=>handleEditListPriceChange(parseFloat(e.target.value)||0)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-right" />
                             </div>
                             <div className="relative">
                                 <label className="text-xs text-slate-500 uppercase font-bold flex justify-between mb-1">Desc % <ArrowRightLeft size={10}/></label>
                                 <input type="number" step="0.1" value={editDiscount} onChange={e=>handleEditDiscountChange(parseFloat(e.target.value)||0)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-amber-400 text-right" />
                             </div>
                             <div>
                                 <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Final</label>
                                 <input type="number" step="0.01" value={editFinalPrice} onChange={e=>handleEditFinalPriceChange(parseFloat(e.target.value)||0)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-emerald-400 font-bold text-right" />
                             </div>
                        </div>
                        
                        <div>
                             <label className="text-xs text-slate-500 uppercase font-bold">Stock</label>
                             <input type="number" value={editStock} onChange={e=>setEditStock(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div className="flex gap-2 pt-2">
                             <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-2 rounded">Cancelar</button>
                             <button onClick={handleSaveEdit} className="flex-[2] bg-emerald-600 text-white font-bold py-2 rounded flex items-center justify-center gap-2"><Save size={16}/> Guardar</button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        {item.discountPercent > 0 && (
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg text-slate-500 line-through font-mono decoration-red-500/50">{item.price.toFixed(2)} $</span>
                                <span className="bg-red-600/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded border border-red-500/20">
                                    -{item.discountPercent}%
                                </span>
                             </div>
                        )}
                        <div className="text-4xl font-mono font-bold text-emerald-400">
                            {finalDisplayPrice.toFixed(2)} <span className="text-lg text-emerald-700">Saldo</span>
                        </div>
                        
                        {item.stock < 3 && item.stock > 0 && (
                             <span className="inline-block mt-2 bg-amber-600/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded border border-amber-500/20">
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
