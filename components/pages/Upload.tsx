
import React, { useState, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FileVideo, X, Plus, Image as ImageIcon, Tag, Layers, Loader2, DollarSign, Settings, Save, Edit3, Wand2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUpload } from '../../context/UploadContext';
import { useNavigate } from '../Router';
import { VideoCategory } from '../../types';
import { db } from '../../services/db';
import { useToast } from '../../context/ToastContext';
import { generateThumbnail } from '../../utils/videoGenerator';

// Helper component to manage object URL lifecycle
const ThumbnailPreview = ({ file }: { file: File }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return <img src={src} alt="Thumb" className="w-full h-full object-cover transition-opacity duration-500 animate-in fade-in" />;
};

export default function Upload() {
  const { user, refreshUser } = useAuth();
  const { addToQueue, isUploading } = useUpload();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Data State
  const [files, setFiles] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<(File | null)[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [prices, setPrices] = useState<number[]>([]); 
  
  // Bulk Edit State
  const [bulkDesc, setBulkDesc] = useState('');
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkPrice, setBulkPrice] = useState<string>('');

  // Configuration Data
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));
  const [systemCategoryPrices, setSystemCategoryPrices] = useState<Record<string, number>>({});
  
  // Queue Processing State
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const processingRef = useRef(false); 
  const queueRef = useRef<{file: File, index: number}[]>([]);
  const isMounted = useRef(true);
  
  // Modals
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  const [localDefaultPrices, setLocalDefaultPrices] = useState<Record<string, number>>({});

  useEffect(() => {
      isMounted.current = true;
      const loadConfig = async () => {
          try {
              const settings = await db.getSystemSettings();
              if (isMounted.current) {
                const standard = Object.values(VideoCategory) as string[];
                const custom = settings.customCategories || [];
                setAvailableCategories([...standard, ...custom]);
                setSystemCategoryPrices(settings.categoryPrices || {});
              }
          } catch(e) { console.error(e); }
      };
      loadConfig();
      return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (user?.defaultPrices) {
        setLocalDefaultPrices(user.defaultPrices);
    }
  }, [user]);

  const handleSaveDefaults = async () => {
      if (!user) return;
      try {
          await db.updateUserProfile(user.id, { defaultPrices: localDefaultPrices });
          await refreshUser();
          setShowPriceConfig(false);
          toast.success("Precios guardados");
      } catch (e: any) {
          toast.error("Error al guardar");
      }
  };

  const getPriceForCategory = (cat: string) => {
      if (user?.defaultPrices && user.defaultPrices[cat] !== undefined) return user.defaultPrices[cat];
      if (systemCategoryPrices[cat] !== undefined) return systemCategoryPrices[cat];
      return 1;
  };

  const detectCategory = (duration: number): string => {
      if (duration <= 180) return VideoCategory.SHORTS;
      if (duration <= 300) return VideoCategory.MUSIC;
      if (duration <= 1500) return VideoCategory.SHORT_FILM;
      if (duration <= 2700) return VideoCategory.SERIES;
      if (duration > 2700) return VideoCategory.MOVIE;
      return VideoCategory.OTHER;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      const startIndex = files.length;

      // Initialize placeholders
      const newTitles = newFiles.map(f => f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      
      setFiles(prev => [...prev, ...newFiles]);
      setTitles(prev => [...prev, ...newTitles]);
      setThumbnails(prev => [...prev, ...new Array(newFiles.length).fill(null)]);
      setDurations(prev => [...prev, ...new Array(newFiles.length).fill(0)]);
      
      // Default initial state (will be refined by processor)
      const defaultCat = VideoCategory.OTHER;
      const defaultPrice = getPriceForCategory(defaultCat);

      setCategories(prev => [...prev, ...new Array(newFiles.length).fill(defaultCat)]);
      setPrices(prev => [...prev, ...new Array(newFiles.length).fill(defaultPrice)]);

      // Add to processor
      newFiles.forEach((file, i) => {
          queueRef.current.push({ file, index: startIndex + i });
      });

      setQueueProgress(prev => ({ ...prev, total: prev.total + newFiles.length }));
      
      if (!processingRef.current) processQueue();
    }
  };

  // Background Processor for Thumbnails & Metadata
  const processQueue = async () => {
      if (!isMounted.current) return;

      if (queueRef.current.length === 0) {
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
              // Analyze
              const result = await generateThumbnail(task.file);
              const duration = result.duration || 0;
              const thumbnail = result.thumbnail; // Can be null
              
              if (isMounted.current) {
                  // Intelligent Logic
                  const cat = detectCategory(duration);
                  const price = getPriceForCategory(cat);

                  setThumbnails(prev => {
                      if (prev.length <= task.index) return prev;
                      const n = [...prev]; n[task.index] = thumbnail; return n;
                  });
                  setDurations(prev => {
                      if (prev.length <= task.index) return prev;
                      const n = [...prev]; n[task.index] = duration; return n;
                  });
                  
                  // Only auto-update if user hasn't touched it (still 'OTHER')
                  setCategories(prev => {
                      if (prev.length <= task.index) return prev;
                      if (prev[task.index] !== VideoCategory.OTHER) return prev;
                      const n = [...prev]; n[task.index] = cat; return n;
                  });

                  setPrices(prev => {
                      if (prev.length <= task.index) return prev;
                      const n = [...prev]; n[task.index] = price; return n;
                  });
              }
          } catch (e) {
              console.error("Analysis failed for file:", task.file.name, e);
              // Continue processing other files even if one fails
          }

          await new Promise(r => setTimeout(r, 100)); // Small delay
          processQueue();
      }
  };

  // --- ACTIONS ---

  const removeFile = (index: number) => {
    if (isProcessingQueue) { toast.error("Espera a que termine el análisis"); return; }
    const filterFn = (_: any, i: number) => i !== index;
    setFiles(prev => prev.filter(filterFn));
    setTitles(prev => prev.filter(filterFn));
    setThumbnails(prev => prev.filter(filterFn));
    setDurations(prev => prev.filter(filterFn));
    setCategories(prev => prev.filter(filterFn));
    setPrices(prev => prev.filter(filterFn));
  };

  const updateTitle = (index: number, val: string) => {
    setTitles(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const updateCategory = (index: number, val: string) => {
    setCategories(prev => { const next = [...prev]; next[index] = val; return next; });
    // Auto-update price on manual category change
    const newPrice = getPriceForCategory(val);
    updatePrice(index, newPrice);
  };
  
  const updatePrice = (index: number, val: number) => {
    setPrices(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  // --- BULK ACTIONS ---

  const applyBulkChanges = () => {
      if (files.length === 0) return;
      
      let changed = false;

      // 1. Apply Category (if selected)
      if (bulkCategory) {
          setCategories(prev => prev.map(() => bulkCategory));
          // Also update prices based on new category default if price not manually overridden in bulk
          if (bulkPrice === '') {
              const newDefaultPrice = getPriceForCategory(bulkCategory);
              setPrices(prev => prev.map(() => newDefaultPrice));
          }
          changed = true;
      }

      // 2. Apply Price (if set)
      if (bulkPrice !== '') {
          const p = parseFloat(bulkPrice);
          if (!isNaN(p)) {
              setPrices(prev => prev.map(() => p));
              changed = true;
          }
      }

      // 3. Description is global state, just toast
      if (changed || bulkDesc) {
          toast.success("Cambios aplicados a todos los videos");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || files.length === 0) return;

    const queue = files.map((file, i) => ({
        title: titles[i],
        description: bulkDesc, // Use bulk description
        price: prices[i],
        category: categories[i] as VideoCategory,
        duration: durations[i] || 0, // Fallback to 0
        file: file,
        thumbnail: thumbnails[i] // Can be null, provider handles default
    }));

    addToQueue(queue, user);
    toast.success("Añadido a cola de subida");
    navigate('/'); 
  };

  return (
    <div className="max-w-6xl mx-auto px-2 pb-20">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <UploadIcon className="text-indigo-500" />
            Subir Contenido
          </h2>
      </div>

      {isUploading && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-6 flex items-center gap-3 animate-in slide-in-from-top-4">
              <Loader2 className="animate-spin" />
              <div>
                  <div className="font-bold">Subida en progreso</div>
                  <div className="text-xs opacity-80">Puedes añadir más archivos a la cola.</div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Controls & Mass Edit */}
        <div className="lg:col-span-1 space-y-4">
           {/* Upload Button */}
           <div className={`relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer h-40 flex flex-col items-center justify-center bg-slate-900/50 ${isProcessingQueue ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="video/*" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isProcessingQueue} />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {isProcessingQueue ? (
                    <>
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <span className="text-slate-400 text-xs mt-2 font-bold">Analizando...</span>
                        <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                           <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${queueProgress.total > 0 ? (queueProgress.current / queueProgress.total) * 100 : 0}%`}}></div>
                        </div>
                        <span className="text-[10px] text-slate-500">{queueProgress.current}/{queueProgress.total}</span>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                            <Plus size={24} className="text-indigo-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-bold">Añadir Videos</span>
                    </>
                )}
            </div>
          </div>
          
          {/* MASS EDIT PANEL */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
                <Edit3 size={16} className="text-indigo-400"/>
                <h3 className="font-bold text-sm text-white">Edición Masiva</h3>
            </div>
            
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción (Para Todos)</label>
                    <textarea 
                        rows={3} 
                        value={bulkDesc} 
                        onChange={e => setBulkDesc(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 outline-none text-white resize-none" 
                        placeholder="Descripción común..." 
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoría</label>
                        <select 
                            value={bulkCategory} 
                            onChange={e => setBulkCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="">-- No cambiar --</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Precio ($)</label>
                        <input 
                            type="number" 
                            min="0"
                            step="0.1"
                            value={bulkPrice}
                            onChange={e => setBulkPrice(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                            placeholder="-- --"
                        />
                    </div>
                </div>

                <button 
                    type="button" 
                    onClick={applyBulkChanges}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Wand2 size={14}/> Aplicar a Todos
                </button>
            </div>
          </div>

          {/* Configuration Link */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Precios por Defecto</span>
                <span className="text-[10px] text-slate-500">Configura tus precios base</span>
             </div>
             <button type="button" onClick={() => setShowPriceConfig(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors">
                <Settings size={16}/>
             </button>
          </div>
        </div>

        {/* RIGHT COLUMN: File List */}
        <div className="lg:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[70vh]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                 <h3 className="font-bold text-slate-200 text-sm">Archivos Seleccionados ({files.length})</h3>
                 {files.length > 0 && !isProcessingQueue && (
                     <button type="button" onClick={() => { setFiles([]); setTitles([]); setThumbnails([]); setDurations([]); setCategories([]); setPrices([]); }} className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1 rounded hover:bg-red-900/20 transition-colors">
                         Limpiar Todo
                     </button>
                 )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/30">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
                     <FileVideo size={48} className="mb-4" />
                     <p className="text-sm font-medium">No hay videos seleccionados</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 items-center group hover:border-slate-600 transition-colors">
                       {/* Thumbnail */}
                       <div className="w-24 h-16 rounded-lg bg-black shrink-0 overflow-hidden relative border border-slate-700">
                         {thumbnails[idx] ? (
                           <ThumbnailPreview file={thumbnails[idx]!} />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center">
                               <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                           </div>
                         )}
                         <div className="absolute bottom-0.5 right-0.5 bg-black/80 backdrop-blur text-[9px] px-1.5 py-0.5 rounded text-white font-mono font-bold">
                            {Math.floor((durations[idx]||0)/60)}:{((durations[idx]||0)%60).toFixed(0).padStart(2,'0')}
                         </div>
                       </div>

                       {/* Inputs */}
                       <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-6">
                              <input 
                                type="text" 
                                value={titles[idx]} 
                                onChange={(e) => updateTitle(idx, e.target.value)} 
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 outline-none text-sm font-bold text-white p-1 transition-colors placeholder-slate-600" 
                                placeholder="Título del video" 
                                required 
                              />
                              <div className="text-[10px] text-slate-500 mt-0.5 pl-1">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                          </div>
                          
                          <div className="md:col-span-3">
                                <div className="relative">
                                    <Tag size={10} className="absolute left-2 top-2.5 text-slate-500 pointer-events-none"/>
                                    <select 
                                        value={categories[idx]} 
                                        onChange={(e) => updateCategory(idx, e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-[10px] text-slate-300 py-1.5 pl-6 pr-2 outline-none focus:border-indigo-500 uppercase font-bold appearance-none cursor-pointer hover:bg-slate-800"
                                    >
                                        {availableCategories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                                    </select>
                                </div>
                          </div>

                          <div className="md:col-span-3">
                                <div className="relative">
                                    <DollarSign size={10} className="absolute left-2 top-2.5 text-amber-500 pointer-events-none"/>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.1"
                                        value={prices[idx]}
                                        onChange={(e) => updatePrice(idx, parseFloat(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-amber-400 font-bold py-1.5 pl-6 pr-2 outline-none focus:border-indigo-500"
                                    />
                                </div>
                          </div>
                       </div>

                       <button type="button" onClick={() => removeFile(idx)} disabled={isProcessingQueue} className={`text-slate-600 hover:text-red-400 transition-colors p-2 hover:bg-slate-800 rounded-full ${isProcessingQueue ? 'opacity-30 cursor-not-allowed' : ''}`}><X size={18} /></button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-900 border-t border-slate-800">
                <button 
                    type="submit" 
                    disabled={isProcessingQueue || files.length === 0} 
                    className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${isProcessingQueue || files.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}
                >
                  {isProcessingQueue ? <><Loader2 className="animate-spin" size={18} /> Procesando...</> : <><UploadIcon size={20}/> Publicar {files.length} Videos</>}
                </button>
              </div>
           </form>
        </div>
      </div>

      {/* Default Prices Modal */}
      {showPriceConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h3 className="font-bold text-white flex items-center gap-2"><Tag size={18} className="text-indigo-400"/> Configuración de Precios</h3>
                    <button onClick={() => setShowPriceConfig(false)} className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800"><X size={20}/></button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-900">
                    <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">Define tus precios base por categoría. Estos valores se aplicarán automáticamente al detectar la categoría del video.</p>
                    {availableCategories.map(cat => (
                        <div key={cat} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                             <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
                                 {cat.replace('_', ' ')}
                             </span>
                             <div className="relative w-24">
                                 <span className="absolute left-3 top-2 text-slate-500 text-xs">$</span>
                                 <input 
                                    type="number" 
                                    min="0"
                                    value={localDefaultPrices[cat] !== undefined ? localDefaultPrices[cat] : (systemCategoryPrices[cat] ?? '')}
                                    onChange={(e) => setLocalDefaultPrices(prev => ({...prev, [cat]: parseFloat(e.target.value) || 0}))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-6 pr-2 text-right text-white font-mono text-sm focus:border-indigo-500 outline-none"
                                    placeholder={systemCategoryPrices[cat]?.toString()}
                                 />
                             </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                    <button onClick={handleSaveDefaults} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg">
                        <Save size={16}/> Guardar Preferencias
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
