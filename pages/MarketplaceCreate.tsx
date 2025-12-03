import React, { useState, useEffect } from 'react';
import { useNavigate } from '../components/Router';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Loader2, Upload, X, Calculator, ArrowRightLeft } from 'lucide-react';

export default function MarketplaceCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [stock, setStock] = useState<number>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Bidirectional Pricing State
  const [listPrice, setListPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);

  const handleListPriceChange = (val: number) => {
      setListPrice(val);
      // Keep discount, update final
      const final = val * (1 - discount / 100);
      setFinalPrice(parseFloat(final.toFixed(2)));
  };

  const handleDiscountChange = (val: number) => {
      let d = Math.max(0, Math.min(99, val));
      setDiscount(d);
      // Keep list price, update final
      const final = listPrice * (1 - d / 100);
      setFinalPrice(parseFloat(final.toFixed(2)));
  };

  const handleFinalPriceChange = (val: number) => {
      setFinalPrice(val);
      // Keep list price, update discount
      // final = list * (1 - d/100)  =>  final/list = 1 - d/100  =>  d/100 = 1 - final/list  => d = (1 - final/list)*100
      if (listPrice > 0) {
          const d = (1 - val / listPrice) * 100;
          setDiscount(parseFloat(Math.max(0, d).toFixed(1)));
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files);
          setFiles(prev => [...prev, ...newFiles]);
          
          newFiles.forEach(f => {
              setPreviews(prev => [...prev, URL.createObjectURL(f)]);
          });
      }
  };

  const removeFile = (idx: number) => {
      setFiles(prev => prev.filter((_, i) => i !== idx));
      setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (files.length === 0) { alert("Añade al menos una foto o video."); return; }
      
      setLoading(true);
      try {
          await db.createListing(user.id, title, desc, listPrice, stock, discount, files);
          alert("Venta creada!");
          navigate('/marketplace');
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
        <h2 className="text-2xl font-bold text-white mb-6">Vender un Artículo</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Título</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="¿Qué estás vendiendo?" />
            </div>

            {/* Smart Pricing Calculator */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold border-b border-slate-800 pb-2 mb-2">
                    <Calculator size={16}/> Calculadora de Precio
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Precio Lista</label>
                        <input 
                            type="number" 
                            required 
                            min="0" 
                            step="0.01"
                            value={listPrice || ''} 
                            onChange={e => handleListPriceChange(parseFloat(e.target.value) || 0)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-right focus:border-emerald-500 outline-none" 
                            placeholder="0.00" 
                        />
                    </div>

                    <div className="space-y-1 relative">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                            Descuento
                            <ArrowRightLeft size={10} className="text-slate-600"/>
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                min="0" 
                                max="99" 
                                step="0.1"
                                value={discount || ''} 
                                onChange={e => handleDiscountChange(parseFloat(e.target.value) || 0)} 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-amber-400 font-mono text-right focus:border-amber-500 outline-none" 
                                placeholder="0" 
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">%</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Precio Final</label>
                        <input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            value={finalPrice || ''} 
                            onChange={e => handleFinalPriceChange(parseFloat(e.target.value) || 0)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold font-mono text-right focus:border-emerald-500 outline-none" 
                            placeholder="0.00" 
                        />
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 text-center bg-slate-950/50 py-1 rounded">
                    El cliente pagará <strong className="text-emerald-400">{finalPrice} Saldo</strong>.
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Stock (Cant.)</label>
                <input type="number" required min="1" value={stock} onChange={e => setStock(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Descripción</label>
                <textarea required rows={5} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Describe la condición, detalles, información de entrega..."></textarea>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Fotos y Videos</label>
                <div className="grid grid-cols-3 gap-4">
                    {previews.map((src, i) => (
                        <div key={i} className="relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-800 group">
                            {files[i].type.startsWith('video') ? (
                                <video src={src} className="w-full h-full object-cover" />
                            ) : (
                                <img src={src} className="w-full h-full object-cover" />
                            )}
                            <button type="button" onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                        </div>
                    ))}
                    <label className="aspect-square bg-slate-900 rounded-lg border-2 border-dashed border-slate-800 hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-500 hover:text-emerald-500">
                        <Upload size={24} className="mb-2"/>
                        <span className="text-xs font-bold">Añadir</span>
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>
            </div>

            <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" /> : 'Crear Venta'}
                </button>
            </div>
        </form>
    </div>
  );
}