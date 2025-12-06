import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { Link } from '../components/Router';
import { ShoppingBag, Tag, Loader2, Search, Star } from 'lucide-react';

export default function Marketplace() {
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        db.getMarketplaceItems().then(setItems).finally(() => setLoading(false));
    }, []);

    const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500"/></div>;

    return (
        <div className="pb-20 max-w-6xl mx-auto px-4 pt-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-indigo-400"/> Tienda</h1>
                    <p className="text-slate-400 text-sm">Compra y vende artículos</p>
                </div>
                <Link to="/sell" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Vender</Link>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-slate-500" size={18}/>
                <input 
                    type="text" 
                    placeholder="Buscar artículos..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filtered.map(item => (
                    <Link key={item.id} to={`/marketplace/${item.id}`} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-indigo-500 transition-colors group relative">
                        {item.discountPercent && item.discountPercent > 0 ? (
                            <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                -{item.discountPercent}%
                            </div>
                        ) : null}

                        <div className="aspect-square bg-black relative">
                            {item.images && item.images.length > 0 ? (
                                <img src={item.images[0]} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${item.status === 'AGOTADO' ? 'grayscale opacity-50' : ''}`} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700"><ShoppingBag size={48}/></div>
                            )}
                            {item.status === 'AGOTADO' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="bg-black/80 text-white font-bold px-3 py-1 rounded border border-white/20">AGOTADO</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <h3 className="font-bold text-white mb-1 truncate text-sm">{item.title}</h3>
                            <div className="flex items-center gap-1 mb-2">
                                <Star size={10} className="text-amber-400" fill="currentColor"/>
                                <span className="text-xs text-slate-400">{item.rating || 0} ({item.reviewCount || 0})</span>
                            </div>
                            
                            <div className="flex justify-between items-end">
                                <div>
                                    {item.discountPercent && item.discountPercent > 0 ? (
                                        <>
                                            <div className="text-xs text-slate-500 line-through font-bold">{item.originalPrice} $</div>
                                            <div className="text-lg font-black text-red-500">{item.price} $</div>
                                        </>
                                    ) : (
                                        <div className="text-lg font-black text-amber-400">{item.price} $</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
            
            {filtered.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-50"/>
                    <p>No se encontraron artículos</p>
                </div>
            )}
        </div>
    );
}