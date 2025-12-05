import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { Link } from '../components/Router';
import { ShoppingBag, Tag, Loader2, Search } from 'lucide-react';

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
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-indigo-400"/> Marketplace</h1>
                    <p className="text-slate-400 text-sm">Buy and sell equipment with other users</p>
                </div>
                <Link to="/sell" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold">Sell Item</Link>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-slate-500" size={18}/>
                <input 
                    type="text" 
                    placeholder="Search items..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filtered.map(item => (
                    <Link key={item.id} to={`/marketplace/${item.id}`} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-indigo-500 transition-colors group">
                        <div className="aspect-square bg-black relative">
                            {item.images && item.images.length > 0 ? (
                                <img src={item.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700"><ShoppingBag size={48}/></div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">
                                {item.condition}
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-bold text-white mb-1 truncate">{item.title}</h3>
                            <div className="flex justify-between items-end">
                                <span className="text-xl font-black text-amber-400">{item.price} $</span>
                                <span className="text-xs text-slate-500 flex items-center gap-1"><Tag size={12}/> {item.category}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
            
            {filtered.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-50"/>
                    <p>No items found</p>
                </div>
            )}
        </div>
    );
}