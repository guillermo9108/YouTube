import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../components/Router';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { useCart } from '../context/CartContext';
import { ShoppingBag, ChevronLeft, User, Tag, ShieldCheck, ShoppingCart } from 'lucide-react';

export default function MarketplaceItemView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart, cart } = useCart();
    
    const [item, setItem] = useState<MarketplaceItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImg, setActiveImg] = useState(0);

    useEffect(() => {
        if(id) db.getMarketplaceItem(id).then(setItem).finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="text-center p-10 text-slate-500">Loading...</div>;
    if (!item) return <div className="text-center p-10 text-slate-500">Item not found</div>;

    const isInCart = cart.some(c => c.id === item.id);

    return (
        <div className="pb-20 max-w-4xl mx-auto md:pt-6">
            <button onClick={() => navigate('/marketplace')} className="flex items-center gap-1 text-slate-400 hover:text-white px-4 py-2 mb-2">
                <ChevronLeft size={20}/> Back
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                {/* Gallery */}
                <div className="space-y-4">
                    <div className="aspect-square bg-black rounded-xl overflow-hidden border border-slate-800">
                        {item.images && item.images.length > 0 ? (
                            <img src={item.images[activeImg]} className="w-full h-full object-contain" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700"><ShoppingBag size={64}/></div>
                        )}
                    </div>
                    {item.images && item.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {item.images.map((img, i) => (
                                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${activeImg === i ? 'border-indigo-500' : 'border-slate-800'}`}>
                                    <img src={img} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">{item.title}</h1>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded font-bold uppercase text-xs">{item.condition}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="text-3xl font-black text-amber-400 mb-1">{item.price} $</div>
                        <div className="text-xs text-slate-500 mb-4">+ Shipping calculated at checkout</div>
                        
                        <button 
                            onClick={() => !isInCart && addToCart(item)}
                            disabled={isInCart}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${isInCart ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        >
                            <ShoppingCart size={20}/> {isInCart ? 'In Cart' : 'Add to Cart'}
                        </button>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-300 mb-2">Description</h3>
                        <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{item.description}</p>
                    </div>

                    <div className="border-t border-slate-800 pt-4">
                        <h3 className="font-bold text-slate-300 mb-3 text-xs uppercase">Seller Info</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden">
                                {item.sellerAvatarUrl ? <img src={item.sellerAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-500"><User size={20}/></div>}
                            </div>
                            <div>
                                <div className="font-bold text-white">{item.sellerName}</div>
                                <div className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck size={12}/> Verified Seller</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}