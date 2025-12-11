import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../components/Router';
import { db } from '../services/db';
import { MarketplaceItem, MarketplaceReview } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, ChevronLeft, User, Tag, ShieldCheck, ShoppingCart, Star, Edit3, Send, AlertTriangle, Check } from 'lucide-react';

export default function MarketplaceItemView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToCart, cart } = useCart();
    
    const [item, setItem] = useState<MarketplaceItem | null>(null);
    const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeImg, setActiveImg] = useState(0);

    // Review Form
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        if(id) {
            db.getMarketplaceItem(id).then(data => {
                if (data) setItem(data);
                setLoading(false);
            });
            db.getReviews(id).then(setReviews);
        }
    }, [id]);

    const handleAddReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id || !comment.trim()) return;
        setSubmittingReview(true);
        try {
            await db.addReview(id, user.id, rating, comment);
            // Refresh
            const newReviews = await db.getReviews(id);
            setReviews(newReviews);
            setComment('');
        } catch(e) { alert("Error al enviar reseña"); }
        finally { setSubmittingReview(false); }
    };

    if (loading) return <div className="text-center p-10 text-slate-500">Cargando...</div>;
    if (!item) return <div className="text-center p-10 text-slate-500">Artículo no encontrado</div>;

    const isInCart = cart.some(c => c.id === item.id);
    const isSeller = user?.id === item.sellerId;

    return (
        <div className="pb-20 max-w-5xl mx-auto md:pt-6">
            <button onClick={() => navigate('/marketplace')} className="flex items-center gap-1 text-slate-400 hover:text-white px-4 py-2 mb-2">
                <ChevronLeft size={20}/> Volver
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                {/* Gallery */}
                <div className="space-y-4">
                    <div className="aspect-square bg-black rounded-xl overflow-hidden border border-slate-800 relative">
                        {item.images && item.images.length > 0 ? (
                            <img src={item.images[activeImg]} className={`w-full h-full object-contain ${item.status === 'AGOTADO' ? 'grayscale opacity-50' : ''}`} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700"><ShoppingBag size={64}/></div>
                        )}
                        
                        {item.discountPercent && item.discountPercent > 0 && item.status !== 'AGOTADO' && (
                            <div className="absolute top-4 left-4 bg-red-600 text-white font-black px-3 py-1 text-lg rounded shadow-lg transform -rotate-2">
                                -{item.discountPercent}% OFF
                            </div>
                        )}

                        {item.status === 'AGOTADO' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <span className="bg-black text-white px-6 py-2 font-bold text-xl border-2 border-white transform -rotate-12">AGOTADO</span>
                            </div>
                        )}
                    </div>
                    {item.images && item.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {item.images.map((img, i) => (
                                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${activeImg === i ? 'border-indigo-500' : 'border-slate-800 opacity-60'}`}>
                                    <img src={img} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="space-y-6">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                            <h1 className="text-2xl font-bold text-white leading-tight">{item.title}</h1>
                            {isSeller && (
                                <button onClick={() => navigate(`/marketplace/edit/${item.id}`)} className="text-indigo-400 hover:text-white flex items-center gap-1 text-xs font-bold border border-indigo-500/30 px-2 py-1 rounded">
                                    <Edit3 size={12}/> Editar
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex text-amber-400">
                                {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={s <= (item.rating || 0) ? "currentColor" : "none"} className={s <= (item.rating || 0) ? "" : "text-slate-600"} />)}
                            </div>
                            <span className="text-xs text-slate-400 underline">{reviews.length} reseñas</span>
                        </div>

                        <div className="mb-6">
                            {item.discountPercent && item.discountPercent > 0 ? (
                                <div>
                                    <span className="text-slate-500 line-through text-lg font-bold mr-2">{item.originalPrice} $</span>
                                    <span className="text-4xl font-black text-red-500">{item.price} $</span>
                                </div>
                            ) : (
                                <span className="text-4xl font-black text-amber-400">{item.price} $</span>
                            )}
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                <span className="bg-slate-800 px-2 py-0.5 rounded">{item.condition}</span>
                                {item.stock !== undefined && item.stock < 5 && item.stock > 0 && <span className="text-red-400 font-bold animate-pulse">¡Solo quedan {item.stock}!</span>}
                            </div>
                        </div>

                        <button 
                            onClick={() => !isInCart && item.status === 'ACTIVO' && addToCart(item)}
                            disabled={isInCart || item.status !== 'ACTIVO'}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-lg shadow-xl transition-transform active:scale-95 ${isInCart ? 'bg-slate-700 text-slate-400 cursor-default' : (item.status === 'ACTIVO' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed')}`}
                        >
                            {isInCart ? <><Check size={24}/> En Carrito</> : (item.status === 'ACTIVO' ? <><ShoppingCart size={24}/> Añadir al Carrito</> : 'No Disponible')}
                        </button>
                    </div>

                    <div className="prose prose-invert text-sm text-slate-400">
                        <h3 className="text-white font-bold mb-2">Descripción</h3>
                        <p className="whitespace-pre-wrap">{item.description}</p>
                    </div>

                    <div className="border-t border-slate-800 pt-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden">
                            {item.sellerAvatarUrl ? <img src={item.sellerAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-500"><User size={24}/></div>}
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Vendido por {item.sellerName}</div>
                            <div className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck size={12}/> Vendedor Verificado</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div className="mt-12 px-4">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Star className="text-amber-400" fill="currentColor"/> Reseñas de Clientes</h3>
                
                {user && (
                    <form onSubmit={handleAddReview} className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-8">
                        <div className="flex gap-2 mb-3">
                            {[1,2,3,4,5].map(s => (
                                <button key={s} type="button" onClick={() => setRating(s)} className="focus:outline-none">
                                    <Star size={24} className={s <= rating ? "text-amber-400" : "text-slate-600"} fill={s <= rating ? "currentColor" : "none"} />
                                </button>
                            ))}
                        </div>
                        <textarea 
                            value={comment} 
                            onChange={e => setComment(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm mb-3 focus:border-indigo-500 outline-none" 
                            rows={3}
                            placeholder="Comparte tu opinión sobre este producto..."
                        />
                        <button disabled={submittingReview || !comment.trim()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <Send size={16}/> Publicar Reseña
                        </button>
                    </form>
                )}

                <div className="space-y-4">
                    {reviews.length === 0 && <p className="text-slate-500 italic">Aún no hay reseñas.</p>}
                    {reviews.map(r => (
                        <div key={r.id} className="border-b border-slate-800 pb-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden">
                                        {r.userAvatarUrl ? <img src={r.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center w-full h-full text-xs font-bold text-slate-500">{r.username[0]}</div>}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white">{r.username}</div>
                                        <div className="flex text-amber-400">
                                            {[1,2,3,4,5].map(s => <Star key={s} size={10} fill={s <= r.rating ? "currentColor" : "none"} className={s <= r.rating ? "" : "text-slate-700"} />)}
                                        </div>
                                    </div>
                                </div>
                                {/* Corrected Date display for PHP timestamp (seconds -> ms) */}
                                <span className="text-[10px] text-slate-600">{new Date(r.timestamp * 1000).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-300 pl-10">{r.comment}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}