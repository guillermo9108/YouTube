import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { Link } from '../components/Router';
import { Plus, Tag, Search, ShoppingBag, Loader2, Image as ImageIcon } from 'lucide-react';

export default function Marketplace() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    db.getMarketplaceItems().then(data => {
        setItems(data);
        setLoading(false);
    });
  }, []);

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(search.toLowerCase()) || 
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-24">
       <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                   <ShoppingBag className="text-emerald-400" /> Marketplace
               </h2>
               <p className="text-slate-400 text-sm">Buy and sell items with Saldo</p>
           </div>
           <Link to="/marketplace/create" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
               <Plus size={18} /> Sell Item
           </Link>
       </div>

       {/* Search Bar */}
       <div className="relative mb-8">
           <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
           <input 
             type="text" 
             placeholder="Search items..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" 
           />
       </div>

       {loading ? (
           <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>
       ) : filteredItems.length === 0 ? (
           <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-4">
               <Tag size={48} className="opacity-50" />
               <p>No active listings found.</p>
           </div>
       ) : (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {filteredItems.map(item => (
                   <Link to={`/marketplace/${item.id}`} key={item.id} className="group bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-emerald-500/50 transition-colors">
                       <div className="aspect-square bg-slate-950 relative overflow-hidden">
                           {item.media.length > 0 ? (
                               item.media[0].type === 'image' ? (
                                   <img src={item.media[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                               ) : (
                                   <video src={item.media[0].url} className="w-full h-full object-cover" muted />
                               )
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-700">
                                   <ImageIcon size={32} />
                               </div>
                           )}
                           <div className="absolute top-2 right-2 bg-emerald-500 text-emerald-950 font-black text-xs px-2 py-1 rounded shadow-sm">
                               {item.price} $
                           </div>
                       </div>
                       <div className="p-3">
                           <h3 className="font-bold text-white text-sm truncate">{item.title}</h3>
                           <div className="flex items-center gap-2 mt-2">
                               {item.sellerAvatarUrl ? (
                                   <img src={item.sellerAvatarUrl} className="w-5 h-5 rounded-full object-cover" />
                               ) : (
                                   <div className="w-5 h-5 rounded-full bg-slate-700"></div>
                               )}
                               <span className="text-xs text-slate-400 truncate">@{item.sellerName}</span>
                           </div>
                       </div>
                   </Link>
               ))}
           </div>
       )}
    </div>
  );
}