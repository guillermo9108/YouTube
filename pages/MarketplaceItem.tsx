import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../components/Router';
import { db } from '../services/db';
import { MarketplaceItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Loader2, ArrowLeft, User, ShieldCheck, Check } from 'lucide-react';

export default function MarketplaceItemView() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [activeMedia, setActiveMedia] = useState(0);

  useEffect(() => {
    if (!id) return;
    db.getMarketplaceItem(id).then(i => {
        setItem(i);
        setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleBuy = async () => {
      if (!user || !item) return;
      if (item.sellerId === user.id) return;
      if (!confirm(`Confirm purchase for ${item.price} Saldo?`)) return;

      setBuying(true);
      try {
          await db.buyMarketplaceItem(user.id, item.id);
          alert("Purchase Successful!");
          refreshUser();
          navigate('/marketplace');
      } catch (e: any) {
          alert("Failed: " + e.message);
      } finally {
          setBuying(false);
      }
  };

  if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>;
  if (!item) return <div className="text-center p-10 text-slate-500">Item not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
        <button onClick={() => navigate('/marketplace')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
            <ArrowLeft size={18} /> Back to Market
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
                     {item.status === 'SOLD' && (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                             <span className="bg-red-600 text-white font-black text-2xl px-6 py-2 transform -rotate-12 border-4 border-white">SOLD</span>
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
                <div className="text-4xl font-mono font-bold text-emerald-400 mb-6">{item.price} <span className="text-lg text-emerald-700">Saldo</span></div>

                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        {item.sellerAvatarUrl ? <img src={item.sellerAvatarUrl} className="w-full h-full object-cover"/> : <User size={24} className="m-3 text-slate-500"/>}
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">Seller</div>
                        <div className="font-bold text-white text-lg">{item.sellerName}</div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 mb-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Description</h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{item.description}</p>
                </div>

                {item.status === 'ACTIVE' && user && user.id !== item.sellerId && (
                    <button 
                        onClick={handleBuy} 
                        disabled={buying}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {buying ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                        {buying ? 'Processing...' : 'Buy Now Securely'}
                    </button>
                )}

                {user && user.id === item.sellerId && (
                    <div className="bg-indigo-900/20 text-indigo-300 p-4 rounded-xl text-center font-bold border border-indigo-500/30">
                        You are selling this item.
                    </div>
                )}

                {item.status === 'SOLD' && (
                    <div className="bg-slate-800 text-slate-400 p-4 rounded-xl text-center font-bold">
                        This item has been sold.
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}