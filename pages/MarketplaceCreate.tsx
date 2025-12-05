import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { useNavigate } from '../components/Router';
import { Upload, X, Tag, DollarSign, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function MarketplaceCreate() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [price, setPrice] = useState('');
    const [condition, setCondition] = useState('NEW');
    const [category, setCategory] = useState('ELECTRONICS');
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
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
        if (images.length === 0) { alert("Please add at least one image"); return; }
        
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', desc);
            formData.append('price', price);
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
            <h1 className="text-2xl font-bold text-white mb-6">Sell an Item</h1>
            
            <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                {/* Images */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Photos</label>
                    <div className="grid grid-cols-4 gap-2">
                        {previews.map((src, i) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 group">
                                <img src={src} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                            </div>
                        ))}
                        <label className="aspect-square bg-slate-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors border border-dashed border-slate-600">
                            <ImageIcon className="text-slate-500 mb-1" />
                            <span className="text-[10px] text-slate-400">Add Photo</span>
                            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Details */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="What are you selling?" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                         <div className="relative">
                             <DollarSign size={14} className="absolute left-3 top-3 text-slate-500"/>
                             <input required type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white font-bold" />
                         </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Condition</label>
                         <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                             <option value="NEW">New</option>
                             <option value="USED">Used</option>
                             <option value="REFURBISHED">Refurbished</option>
                         </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                        <option value="ELECTRONICS">Electronics</option>
                        <option value="CLOTHING">Clothing</option>
                        <option value="HOME">Home</option>
                        <option value="TOYS">Toys</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea required rows={4} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Describe your item..." />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                    List Item
                </button>
            </form>
        </div>
    );
}