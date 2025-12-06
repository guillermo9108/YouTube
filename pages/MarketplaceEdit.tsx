import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate, useParams } from '../components/Router';
import { Save, Tag, Percent, Archive, ArrowLeft } from 'lucide-react';
import { MarketplaceItem } from '../types';

export default function MarketplaceEdit() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState<MarketplaceItem | null>(null);

    // Form State
    const [price, setPrice] = useState(0);
    const [stock, setStock] = useState(1);
    const [discount, setDiscount] = useState(0);

    useEffect(() => {
        if (id) {
            db.getMarketplaceItem(id).then(data => {
                if (data) {
                    setItem(data);
                    setPrice(data.originalPrice || data.price);
                    setStock(data.stock || 1);
                    setDiscount(data.discountPercent || 0);
                }
                setLoading(false);
            });
        }
    }, [id]);

    const handleSave = async () => {
        if (!user || !item || !id) return;
        
        try {
            await db.editListing(id, user.id, {
                originalPrice: price,
                discountPercent: discount,
                stock: stock
            });
            alert("Artículo actualizado correctamente");
            navigate(`/marketplace/${id}`);
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Cargando...</div>;
    if (!item || (user && item.sellerId !== user.id)) return <div className="p-10 text-center text-red-500">No autorizado</div>;

    const finalPrice = price - (price * (discount / 100));

    return (
        <div className="max-w-md mx-auto px-4 pt-6 pb-20">
            <button onClick={() => navigate(`/marketplace/${id}`)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
                <ArrowLeft size={20}/> Volver al Artículo
            </button>
            
            <h1 className="text-2xl font-bold text-white mb-6">Gestionar Inventario</h1>
            
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                    <img src={item.images[0]} className="w-16 h-16 rounded object-cover" alt="" />
                    <div>
                        <h3 className="font-bold text-white truncate w-48">{item.title}</h3>
                        <p className="text-xs text-slate-500">{item.status}</p>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Archive size={14}/> Stock (Cantidad)
                    </label>
                    <input 
                        type="number" 
                        min="0"
                        value={stock} 
                        onChange={e => setStock(parseInt(e.target.value))} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Si llega a 0, se marcará como AGOTADO.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Tag size={14}/> Precio Base ($)
                    </label>
                    <input 
                        type="number" 
                        min="0"
                        value={price} 
                        onChange={e => setPrice(parseFloat(e.target.value))} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white font-bold"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Percent size={14}/> Descuento (%)
                    </label>
                    <input 
                        type="range" 
                        min="0" 
                        max="90" 
                        step="5"
                        value={discount} 
                        onChange={e => setDiscount(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-2"
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-indigo-400 font-bold text-lg">-{discount}% OFF</span>
                        <div className="text-right">
                             <div className="text-xs text-slate-500">Precio Final</div>
                             <div className="text-xl font-black text-white">{finalPrice.toFixed(2)} $</div>
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    <Save size={18}/> Guardar Cambios
                </button>
            </div>
        </div>
    );
}