import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Upload, X, Tag, DollarSign, Image as ImageIcon, Loader2, Archive } from 'lucide-react';

export default function MarketplaceCreate() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('1');
    const [condition, setCondition] = useState('NUEVO');
    const [category, setCategory] = useState('ELECTRONICA');
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files) as File[];
            setImages([...images, ...newFiles]);
            
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
        setPreviews(previews.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (images.length === 0) { alert("Por favor añade al menos una imagen"); return; }
        
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', desc);
            formData.append('price', price);
            formData.append('stock', stock);
            formData.append('category', category);
            formData.append('condition', condition);
            formData.append('sellerId', user.id);
            images.forEach(img => formData.append('images[]', img));
            
            await db.createListing(formData);
            navigate('/marketplace');
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
            <h1 className="text-2xl font-bold text-white mb-6">Vender Artículo</h1>
            
            <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                {/* Images */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fotos</label>
                    <div className="grid grid-cols-4 gap-2">
                        {previews.map((src, i) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 group">
                                <img src={src} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                            </div>
                        ))}
                        <label className="aspect-square bg-slate-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors border border-dashed border-slate-600">
                            <ImageIcon className="text-slate-500 mb-1" />
                            <span className="text-[10px] text-slate-400">Añadir</span>
                            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Details */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="¿Qué estás vendiendo?" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio ($)</label>
                         <div className="relative">
                             <DollarSign size={14} className="absolute left-3 top-3 text-slate-500"/>
                             <input required type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white font-bold" />
                         </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Archive size={12}/> Cantidad</label>
                         <input required type="number" min="1" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                         <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                            <option value="ELECTRONICA">Electrónica</option>
                            <option value="ROPA">Ropa</option>
                            <option value="HOGAR">Hogar</option>
                            <option value="JUGUETES">Juguetes</option>
                            <option value="OTRO">Otro</option>
                         </select>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Condición</label>
                         <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                             <option value="NUEVO">Nuevo</option>
                             <option value="USADO">Usado</option>
                             <option value="REACONDICIONADO">Reacondicionado</option>
                         </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                    <textarea required rows={4} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Describe tu artículo..." />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                    Publicar
                </button>
            </form>
        </div>
    );
}