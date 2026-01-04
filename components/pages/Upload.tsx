
import React, { useState, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FileVideo, X, Plus, Image as ImageIcon, Tag, Loader2, DollarSign, Settings, Save, Edit3, Wand2, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUpload } from '../../context/UploadContext';
import { useNavigate } from '../Router';
import { db } from '../../services/db';
import { useToast } from '../../context/ToastContext';
import { generateThumbnail } from '../../utils/videoGenerator';
import { aiService } from '../../services/ai';
import { Category } from '../../types';

const ThumbnailPreview = ({ file }: { file: File }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return <img src={src} alt="Thumb" className="w-full h-full object-cover animate-in fade-in" />;
};

export default function Upload() {
  const { user } = useAuth();
  const { addToQueue } = useUpload();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [files, setFiles] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<(File | null)[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [prices, setPrices] = useState<number[]>([]); 
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [bulkDesc, setBulkDesc] = useState('');
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkPrice, setBulkPrice] = useState<string>('');

  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const processingRef = useRef(false); 
  const queueRef = useRef<{file: File, index: number}[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
      isMounted.current = true;
      db.getSystemSettings().then(s => {
          if (isMounted.current) setAvailableCategories(s.categories || []);
      });
      return () => { isMounted.current = false; };
  }, []);

  const getPriceForCategory = (catName: string) => {
      const cat = availableCategories.find(c => c.name === catName);
      return cat ? cat.price : 1.00;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      const startIndex = files.length;
      const newTitles = newFiles.map(f => f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      
      setFiles(prev => [...prev, ...newFiles]);
      setTitles(prev => [...prev, ...newTitles]);
      setThumbnails(prev => [...prev, ...new Array(newFiles.length).fill(null)]);
      setDurations(prev => [...prev, ...new Array(newFiles.length).fill(0)]);
      
      const defaultCat = availableCategories[0]?.name || 'GENERAL';
      const defaultPrice = getPriceForCategory(defaultCat);

      setCategories(prev => [...prev, ...new Array(newFiles.length).fill(defaultCat)]);
      setPrices(prev => [...prev, ...new Array(newFiles.length).fill(defaultPrice)]);

      newFiles.forEach((file, i) => {
          queueRef.current.push({ file, index: startIndex + i });
      });

      setQueueProgress(prev => ({ ...prev, total: prev.total + newFiles.length }));
      if (!processingRef.current) processQueue();
    }
  };

  const processQueue = async () => {
      if (!isMounted.current || queueRef.current.length === 0) {
          processingRef.current = false;
          setIsProcessingQueue(false);
          return;
      }
      processingRef.current = true;
      setIsProcessingQueue(true);

      const task = queueRef.current.shift(); 
      if (task) {
          setQueueProgress(prev => ({ ...prev, current: prev.current + 1 }));
          try {
              const result = await generateThumbnail(task.file);
              if (isMounted.current) {
                  setThumbnails(prev => { const n = [...prev]; n[task.index] = result.thumbnail; return n; });
                  setDurations(prev => { const n = [...prev]; n[task.index] = result.duration; return n; });
              }
          } catch (e) { console.error(e); }
          processQueue();
      }
  };

  const handleAIEnrich = async (index: number) => {
      if (isAiLoading) return;
      setIsAiLoading(true);
      try {
          const suggestions = await aiService.suggestMetadata(files[index].name);
          if (suggestions) {
              setTitles(prev => { const n = [...prev]; n[index] = suggestions.title; return n; });
              toast.success("Metadatos generados");
          }
      } catch (e) { toast.error("IA no disponible"); }
      finally { setIsAiLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || files.length === 0) return;
    const queue = files.map((file, i) => ({
        title: titles[i],
        description: bulkDesc || "Subida desde PWA",
        price: prices[i],
        category: categories[i] as any,
        duration: durations[i] || 0,
        file: file,
        thumbnail: thumbnails[i]
    }));
    addToQueue(queue, user);
    toast.success("Archivos en cola de subida");
    navigate('/'); 
  };

  return (
    <div className="max-w-6xl mx-auto px-2 pb-20 pt-4">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black flex items-center gap-2 text-white uppercase italic">
            <UploadIcon className="text-indigo-500" /> Publicar Contenido
          </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
           <div className={`relative border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer h-40 flex flex-col items-center justify-center bg-slate-900/50 ${isProcessingQueue ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="video/*" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {isProcessingQueue ? (
                    <>
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <span className="text-slate-400 text-xs mt-2 font-bold uppercase">Analizando Lote...</span>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                            <Plus size={24} className="text-indigo-400" />
                        </div>
                        <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Añadir Archivos</span>
                    </>
                )}
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
                <Wand2 size={16} className="text-indigo-400"/>
                <h3 className="font-black text-xs text-white uppercase tracking-widest">Ajustes Masivos</h3>
            </div>
            
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">Categoría</label>
                    <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none">
                        <option value="">-- Sin cambio --</option>
                        {availableCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">Precio ($)</label>
                    <input type="number" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white" placeholder="Ej: 5.00"/>
                </div>
                <button type="button" onClick={() => {
                    if(bulkCategory) setCategories(prev => prev.map(() => bulkCategory));
                    if(bulkPrice) setPrices(prev => prev.map(() => parseFloat(bulkPrice)));
                    toast.success("Cambios aplicados");
                }} className="w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Aplicar a todos
                </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[75vh]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                 <h3 className="font-black text-xs text-slate-200 uppercase tracking-widest">Cola de publicación ({files.length})</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-950/30 custom-scrollbar">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
                     <FileVideo size={64} strokeWidth={1} className="mb-4" />
                     <p className="text-xs font-black uppercase tracking-widest italic">Bandeja de entrada vacía</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <div key={idx} className="flex gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-center group">
                       <div className="w-28 h-16 rounded-xl bg-black shrink-0 overflow-hidden relative border border-slate-700 shadow-lg">
                         {thumbnails[idx] ? <ThumbnailPreview file={thumbnails[idx]!} /> : <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>}
                       </div>
                       <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                              <input type="text" value={titles[idx]} onChange={(e) => { const n = [...titles]; n[idx] = e.target.value; setTitles(n); }} className="flex-1 bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-sm font-black text-white py-1" required />
                              <button type="button" onClick={() => handleAIEnrich(idx)} className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">
                                 <Sparkles size={14}/>
                              </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                                <select value={categories[idx]} onChange={(e) => { const n = [...categories]; n[idx] = e.target.value; setCategories(n); const p = [...prices]; p[idx] = getPriceForCategory(e.target.value); setPrices(p); }} className="bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 py-2 px-2 outline-none font-black uppercase">
                                    {availableCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                                <input type="number" step="0.1" value={prices[idx]} onChange={(e) => { const n = [...prices]; n[idx] = parseFloat(e.target.value); setPrices(n); }} className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-amber-400 font-bold py-2 px-2" />
                          </div>
                       </div>
                       <button type="button" onClick={() => setFiles(files.filter((_,i)=>i!==idx))} className="text-slate-600 hover:text-red-500 p-2"><X size={20} /></button>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800">
                <button type="submit" disabled={files.length === 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 active:scale-95 uppercase tracking-widest text-xs">
                  <UploadIcon size={20}/> Publicar {files.length} videos
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
}
