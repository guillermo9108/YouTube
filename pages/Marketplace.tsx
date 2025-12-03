


import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { Link } from '../components/Router';
import { Plus, Tag, Search, ShoppingBag, Loader2, Image as ImageIcon, Zap, TrendingUp, Percent } from 'lucide-react';

type FilterType = 'ALL' | 'FLASH_SALE' | 'BEST_SELLER' | 'SUPER_OFFER';

export default function Marketplace() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');

  useEffect(() => {
    db.getMarketplaceItems().then(data => {
        setItems(data);
        setLoading(false);
    });
  }, []);

  const getFilteredItems = () => {
      let filtered = items.filter(i => 
        (i.title.toLowerCase().includes(search.toLowerCase()) || 
        i.description.toLowerCase().includes(search.toLowerCase())) &&
        i.status !== 'OUT_OF_STOCK'
      );

      switch(filter) {
          case 'FLASH_SALE':
              return filtered.filter(i => i.discountPercent >= 20);
          case 'SUPER_OFFER':
              return filtered.filter(i => i.discountPercent >= 50);
          case 'BEST_SELLER':
              return filtered.filter(i => (i.salesCount || 0) > 2); // Simple logic
          default:
              return filtered;
      }
  };

  const displayedItems = getFilteredItems();

  return (
    <div className="pb-24">
       <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                   <ShoppingBag className="text-emerald-400" /> Tienda
               </h2>
               <p className="text-slate-400 text-sm">Compra y vende artículos con Saldo</p>
           </div>
           <Link to="/marketplace/create" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
               <Plus size={18} /> Vender Artículo
           </Link>
       </div>

       {/* Smart Filters */}
       <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
           <button onClick={() => setFilter('ALL')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors border ${filter === 'ALL' ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>Todos</button>
           <button onClick={() => setFilter('FLASH_SALE')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors border flex items-center gap-1 ${filter === 'FLASH_SALE' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}><Zap size={12}/> Ventas Flash</button>
           <button onClick={() => setFilter('BEST_SELLER')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors border flex items-center gap-1 ${filter === 'BEST_SELLER' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}><TrendingUp size={12}/> Más Vendidos</button>
           <button onClick={() => setFilter('SUPER_OFFER')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors border flex items-center gap-1 ${filter === 'SUPER_OFFER' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}><Percent size={12}/> Super Ofertas</button>
       </div>

       {/* Search Bar */}
       <div className="relative mb-8">
           <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
           <input 
             type="text" 
             placeholder="Buscar artículos..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" 
           />
       </div>

       {loading ? (
           <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>
       ) : displayedItems.length === 0 ? (
           <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-4">
               <Tag size={48} className="opacity-50" />
               <p>No se encontraron artículos activos para este filtro.</p>
           </div>
       ) : (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {displayedItems.map(item => (
                   <Link to={`/marketplace/${item.id}`} key={item.id} className="group bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-emerald-500/50 transition-colors relative">
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
                           
                           {/* Discount Badge */}
                           {item.discountPercent > 0 && (
                               <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg shadow-sm z-10">
                                   -{item.discountPercent}%
                               </div>
                           )}

                           {/* Price Badge */}
                           <div className="absolute top-2 right-2 bg-emerald-500 text-emerald-950 font-black text-xs px-2 py-1 rounded shadow-sm">
                               {item.price} $
                           </div>
                           
                           {/* Sold Out Overlay (if status logic changes in backend to keep displayed) */}
                           {item.stock === 0 && (
                               <div className="absolute inset-0 bg-black/70 flex items-center justify-center font-bold text-white uppercase tracking-widest z-20">
                                   Agotado
                               </div>
                           )}
                       </div>
                       <div className="p-3">
                           <h3 className="font-bold text-white text-sm truncate">{item.title}</h3>
                           <div className="flex justify-between items-center mt-2">
                               <div className="flex items-center gap-2">
                                   {item.sellerAvatarUrl ? (
                                       <img src={item.sellerAvatarUrl} className="w-5 h-5 rounded-full object-cover" />
                                   ) : (
                                       <div className="w-5 h-5 rounded-full bg-slate-700"></div>
                                   )}
                                   <span className="text-xs text-slate-400 truncate max-w-[80px]">@{item.sellerName}</span>
                               </div>
                               {item.stock < 3 && item.stock > 0 && (
                                   <span className="text-[9px] text-red-400 font-bold bg-red-900/20 px-1.5 rounded">Quedan pocos</span>
                               )}
                           </div>
                       </div>
                   </Link>
               ))}
           </div>
       )}
    </div>
  );
}