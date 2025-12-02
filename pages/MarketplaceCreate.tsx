import React, { useState } from 'react';
import { useNavigate } from '../components/Router';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';

export default function MarketplaceCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

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
      if (files.length === 0) { alert("Add at least one photo or video."); return; }
      
      setLoading(true);
      try {
          await db.createListing(user.id, title, desc, price, files);
          alert("Listing created!");
          navigate('/marketplace');
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
        <h2 className="text-2xl font-bold text-white mb-6">Sell an Item</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Title</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="What are you selling?" />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Price (Saldo)</label>
                <input type="number" required min="1" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="0.00" />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Description</label>
                <textarea required rows={5} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="Describe condition, details, pickup info..."></textarea>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase">Photos & Videos</label>
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
                        <span className="text-xs font-bold">Add Media</span>
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>
            </div>

            <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" /> : 'Create Listing'}
                </button>
            </div>
        </form>
    </div>
  );
}