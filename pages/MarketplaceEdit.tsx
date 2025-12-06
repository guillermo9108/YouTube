
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate, useParams } from '../components/Router';
import { Save, Tag, Percent, Archive, ArrowLeft, AlertCircle } from 'lucide-react';
import { MarketplaceItem } from '../types';

export default function MarketplaceEdit() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState<MarketplaceItem | null>(null);

    // Form State
    const [basePrice, setBasePrice] = useState<number | string>(0); 
    const [stock, setStock] = useState<number | string>(1);
    const [discount, setDiscount] = useState<number | string>(0);
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');

    useEffect(() => {
        if (id) {
            db.getMarketplaceItem(id).then(data => {
                if (data) {
                    setItem(data);
                    // Use originalPrice if set (showing discount logic was used), else price
                    const initialPrice = (data.originalPrice && data.originalPrice > 0) ? data.originalPrice : data.price;
                    setBasePrice(initialPrice);
                    setStock(data.stock ?? 1);
                    setDiscount(data.discountPercent ?? 0);
                    setTitle(data.title);
                    setDesc(data.description);
                }
                setLoading(false);
            });
        }
    }, [id]);

    const handleSave = async () => {
        if (!user || !item || !id) return;
        
        try {
            await db.editListing(id, user.id, {
                title: title,
                description: desc,
                originalPrice: Number(basePrice),
                discountPercent: Number(discount),
                stock: Number(stock),
            });
            alert("Artículo actualizado correctamente");
            navigate(`/marketplace/${id}`);
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Cargando...</div>;
    if (!item || (user && item.sellerId !== user.id)) return <div className="p-10 text-center text-red-500">No autorizado</div>;

    // Calculate preview of final price
    const numBase = Number(basePrice) || 0;
    const numDisc = Number(discount) || 0;
    const finalPrice = numBase - (numBase * (numDisc / 100));

    return (
        <div className="max-w-md mx-auto px-4 pt-6 pb-20">
            <button onClick={() => navigate(`/marketplace/${id}`)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
                <ArrowLeft size={20}/> Volver al Artículo
            </button>
            
            <h1 className="text-2xl font-bold text-white mb-6">Editar Artículo</h1>
            
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                    {item.images && item.images[0] && <img src={item.images[0]} className="w-16 h-16 rounded object-cover" alt="" />}
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Editando</div>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white font-bold mb-1"
                        />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.status === 'ACTIVO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>{item.status}</span>
                    </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Tag size={16}/> Gestión de Precio</h3>
                    
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio Base ($)</label>
                        <input 
                            type="number" 
                            min="0"
                            value={basePrice} 
                            onChange={e => setBasePrice(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono font-bold focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="mb-2">
                        <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Percent size={12}/> Descuento</label>
                            <span className="text-xs font-bold text-indigo-400">{numDisc}% OFF</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="90" 
                            step="5"
                            value={numDisc} 
                            onChange={e => setDiscount(e.target.value)} 
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20 mt-4">
                        <span className="text-xs text-indigo-300">Precio Final al Cliente</span>
                        <span className="text-xl font-black text-white">{finalPrice.toFixed(2)} $</span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Archive size={14}/> Stock Disponible
                    </label>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStock(Math.max(0, Number(stock) - 1))} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">-</button>
                        <input 
                            type="number" 
                            min="0"
                            value={stock} 
                            onChange={e => setStock(e.target.value)} 
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-center text-white font-bold"
                        />
                        <button onClick={() => setStock(Number(stock) + 1)} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">+</button>
                    </div>
                    {Number(stock) === 0 && <div className="text-[10px] text-red-400 mt-2 flex items-center gap-1"><AlertCircle size={10}/> Se marcará como AGOTADO</div>}
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Descripción</label>
                    <textarea 
                        rows={4}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:border-indigo-500 outline-none"
                    />
                </div>

                <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-transform active:scale-95">
                    <Save size={18}/> Guardar Cambios
                </button>
            </div>
        </div>
    );
}
