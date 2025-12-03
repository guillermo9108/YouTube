import React, { useState, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FileVideo, X, Plus, Image as ImageIcon, Tag, Layers, Loader2, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useNavigate } from '../components/Router';
import { VideoCategory } from '../types';
import { db } from '../services/db';

// Helper to calculate image brightness
const getBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let r, g, b, avg;
        let colorSum = 0;

        for (let x = 0, len = data.length; x < len; x += 4) {
            r = data[x];
            g = data[x + 1];
            b = data[x + 2];
            avg = Math.floor((r + g + b) / 3);
            colorSum += avg;
        }

        return Math.floor(colorSum / (width * height));
    } catch(e) {
        return 255; // If fails, assume bright enough to avoid infinite seek loop
    }
};

export const generateThumbnail = async (file: File): Promise<{ thumbnail: File | null, duration: number }> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    
    // Safety Timeout (8 seconds max per file)
    const timeout = setTimeout(() => {
        // CRITICAL: Clean up memory even on timeout
        URL.revokeObjectURL(objectUrl);
        video.remove();
        resolve({ thumbnail: null, duration: 0 });
    }, 8000);

    video.preload = 'metadata';
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    // Checkpoints to try if the frame is too dark (in percentage of duration)
    const attemptPoints = [0.05, 0.20, 0.50]; 
    let currentAttempt = 0;
    let isSeeking = false;

    const captureFrame = () => {
        if (isSeeking) return; // Prevent double capture
        try {
            const width = video.videoWidth;
            const height = video.videoHeight;
            
            if (!width || !height) {
                 // Metadata loaded but dimensions missing? Retrigger
                 return; 
            }

            const canvas = document.createElement('canvas');
            
            // OPTIMIZATION: Scale down to 640px max width.
            if (width > 640) { 
                const scale = 640 / width;
                canvas.width = 640;
                canvas.height = height * scale;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // SMART CHECK: Is the image too dark/black?
            const brightness = getBrightness(ctx, canvas.width, canvas.height);
            const duration = video.duration || 0;

            // Threshold: 20 out of 255. If darker, try next seek point.
            if (brightness < 20 && currentAttempt < attemptPoints.length - 1) {
                currentAttempt++;
                if (duration > 0) {
                    isSeeking = true;
                    video.currentTime = Math.max(0.1, duration * attemptPoints[currentAttempt]);
                    return; // Wait for seeked event again
                }
            }

            canvas.toBlob((blob) => {
                clearTimeout(timeout);
                if (blob) {
                    const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    resolve({ thumbnail: thumbFile, duration });
                } else {
                    resolve({ thumbnail: null, duration: duration || 0 });
                }
                // CRITICAL: Cleanup immediately to free RAM
                URL.revokeObjectURL(objectUrl);
                video.remove();
            }, 'image/jpeg', 0.70); // Lower quality for speed

        } catch (e) {
            console.error("Frame capture error", e);
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            video.remove();
            resolve({ thumbnail: null, duration: video.duration || 0 });
        }
    };

    video.onloadedmetadata = () => {
        // Safe seek for very short videos
        const seekPoint = Math.min(Math.max(0.1, video.duration * 0.05), 1.0);
        isSeeking = true;
        video.currentTime = seekPoint;
    };

    video.onseeked = () => {
        isSeeking = false;
        captureFrame();
    };

    video.onerror = (e) => {
        console.error("Video load error", e);
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        video.remove();
        resolve({ thumbnail: null, duration: 0 });
    };
  });
};

// Internal Component to handle Object URL lifecycle and prevent memory leaks
const ThumbPreview = ({ file }: { file: File }) => {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file]);

    if (!src) return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />;
    return <img src={src} alt="Thumb" className="w-full h-full object-cover" />;
};

interface PendingUploadItem {
    id: string; // Unique ID to track item regardless of array index
    file: File;
    title: string;
    thumbnail: File | null;
    duration: number;
    category: string;
    price: number;
    processed: boolean;
}

export default function Upload() {
  const { user } = useAuth();
  const { addToQueue, isUploading } = useUpload();
  const navigate = useNavigate();
  
  // Single Source of Truth
  const [uploads, setUploads] = useState<PendingUploadItem[]>([]);
  
  // Configuration Data
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));
  const [systemCategoryPrices, setSystemCategoryPrices] = useState<Record<string, number>>({});
  const [serverUploadLimit, setServerUploadLimit] = useState<number>(0);

  // Queue Processing State
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const processingRef = useRef(false);
  // We store IDs to process, not objects, to avoid stale state
  const processingQueueIds = useRef<string[]>([]);

  // Global Settings
  const [desc, setDesc] = useState('');

  useEffect(() => {
      // Load Custom Categories and Default Prices
      const loadConfig = async () => {
          try {
              const settings = await db.getSystemSettings();
              
              // Merge standard categories with custom ones
              const standard = Object.values(VideoCategory) as string[];
              const custom = settings.customCategories || [];
              setAvailableCategories([...standard, ...custom]);

              setSystemCategoryPrices(settings.categoryPrices || {});
              setServerUploadLimit(settings.serverUploadLimit || 0);
          } catch(e) { console.error(e); }
      };
      loadConfig();
  }, []);

  const getPriceForCategory = (cat: string) => {
      // 1. Check User Preference Override
      if (user?.defaultPrices && user.defaultPrices[cat] !== undefined) {
          return user.defaultPrices[cat];
      }
      // 2. Check System Default
      if (systemCategoryPrices[cat] !== undefined) {
          return systemCategoryPrices[cat];
      }
      // 3. Fallback
      return 1;
  };

  const detectCategory = (duration: number): string => {
      if (duration <= 120) return VideoCategory.SHORTS;
      if (duration <= 300) return VideoCategory.MUSIC;
      if (duration <= 1500) return VideoCategory.SHORT_FILM;
      if (duration <= 2700) return VideoCategory.SERIES;
      if (duration > 2700) return VideoCategory.MOVIE;
      return VideoCategory.OTHER;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      const validFiles: File[] = [];
      const rejectedFiles: string[] = [];

      newFiles.forEach(f => {
          if (serverUploadLimit > 0 && f.size > serverUploadLimit) {
              rejectedFiles.push(f.name);
          } else {
              validFiles.push(f);
          }
      });

      if (rejectedFiles.length > 0) {
          alert(`Algunos archivos son demasiado grandes para el servidor y fueron ignorados:\n${rejectedFiles.join('\n')}\n\nLímite: ${(serverUploadLimit/1024/1024).toFixed(0)}MB`);
      }

      if (validFiles.length > 0) {
          const newItems: PendingUploadItem[] = validFiles.map(file => {
              const id = Math.random().toString(36).substr(2, 9); // Simple unique ID
              return {
                  id,
                  file,
                  title: file.name.replace(/\.[^/.]+$/, ""),
                  thumbnail: null,
                  duration: 0,
                  category: VideoCategory.OTHER,
                  price: getPriceForCategory(VideoCategory.OTHER),
                  processed: false
              };
          });

          setUploads(prev => [...prev, ...newItems]);
          setQueueProgress(prev => ({ ...prev, total: prev.total + validFiles.length }));
      }
      
      // Reset input value to allow re-selection of same file if needed
      e.target.value = '';
    }
  };

  // RE-IMPLEMENTED QUEUE PROCESSOR
  // We use a useEffect that watches for "unprocessed" items in the list
  useEffect(() => {
      const unprocessed = uploads.find(u => !u.processed);
      if (unprocessed && !processingRef.current) {
          processItem(unprocessed);
      }
  }, [uploads]);

  const processItem = async (item: PendingUploadItem) => {
      processingRef.current = true;
      setIsProcessingQueue(true);
      
      try {
          const { thumbnail, duration } = await generateThumbnail(item.file);
          const cat = detectCategory(duration);
          const price = getPriceForCategory(cat);
          
          setUploads(prev => prev.map(u => {
              if (u.id !== item.id) return u;
              // Only update category if user hasn't touched it (still default)
              const finalCat = u.category === VideoCategory.OTHER ? cat : u.category;
              return {
                  ...u,
                  thumbnail,
                  duration,
                  category: finalCat,
                  price: u.category === VideoCategory.OTHER ? price : u.price,
                  processed: true
              };
          }));
          
          setQueueProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (e) {
          console.error("Processing failed for", item.title);
          // Mark as processed anyway to avoid infinite loop
          setUploads(prev => prev.map(u => u.id === item.id ? { ...u, processed: true } : u));
      }

      await new Promise(r => setTimeout(r, 200)); // GC Pause
      processingRef.current = false;
      
      // The useEffect will trigger next item automatically
      if (uploads.every(u => u.processed)) setIsProcessingQueue(false);
  };

  const removeUpload = (id: string) => {
      setUploads(prev => prev.filter(u => u.id !== id));
      // If we remove an item, total in queue progress should decrease conceptually, 
      // but simpler to just leave it as is visually or reset if empty.
      if (uploads.length <= 1) {
          setQueueProgress({ current: 0, total: 0 });
          setIsProcessingQueue(false);
          processingRef.current = false;
      }
  };

  const updateField = (id: string, field: keyof PendingUploadItem, value: any) => {
      setUploads(prev => prev.map(u => {
          if (u.id !== id) return u;
          if (field === 'category') {
             // Auto update price
             const newPrice = getPriceForCategory(value as string);
             return { ...u, category: value, price: newPrice };
          }
          return { ...u, [field]: value };
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || uploads.length === 0) return;

    const queue = uploads.map(u => ({
        title: u.title,
        description: desc,
        price: u.price,
        category: u.category as VideoCategory,
        duration: u.duration,
        file: u.file,
        thumbnail: u.thumbnail
    }));

    addToQueue(queue, user);
    
    // Reset
    setUploads([]);
    setQueueProgress({ current: 0, total: 0 });
    navigate('/'); 
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UploadIcon className="text-indigo-500" />
        Subir Contenido
      </h2>

      {isUploading && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-6 flex items-center gap-3">
              <Loader2 className="animate-spin" />
              <div>
                  <div className="font-bold">Subida en progreso</div>
                  <div className="text-xs opacity-80">Puedes añadir más archivos a la cola.</div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
           {/* Add Button */}
           <div className={`relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer aspect-square flex flex-col items-center justify-center bg-slate-900/50 ${isProcessingQueue ? 'opacity-80' : ''}`}>
            <input type="file" accept="video/*" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {isProcessingQueue ? (
                    <>
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <span className="text-slate-400 text-xs mt-2 font-bold">Procesando...</span>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                        <Plus size={24} className="text-indigo-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Añadir Videos</span>
                        <span className="text-slate-600 text-xs">Cola Inteligente Activa</span>
                    </>
                )}
            </div>
          </div>
          
          {/* Global Settings */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Layers size={14}/> Descripción Masiva</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
              <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white resize-none" placeholder="Aplica para todos..." />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">Nota: Los precios se ajustan automáticamente según la categoría. Puedes editarlos individualmente.</p>
          </div>
        </div>

        <div className="md:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                 <h3 className="font-bold text-slate-200">Seleccionados ({uploads.length})</h3>
                 {uploads.length > 0 && <button type="button" onClick={() => { setUploads([]); setQueueProgress({current:0, total:0}); }} className="text-xs text-red-400 hover:text-red-300">Borrar Todo</button>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {uploads.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 py-10">
                     <FileVideo size={48} className="mb-2" />
                     <p>No hay videos seleccionados</p>
                  </div>
                ) : (
                  uploads.map((item) => (
                    <div key={item.id} className="flex gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 items-start">
                       <div className="w-20 h-14 rounded bg-slate-800 shrink-0 overflow-hidden relative border border-slate-700 group">
                         {item.thumbnail ? (
                           <ThumbPreview file={item.thumbnail} />
                         ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                               <Loader2 className="w-4 h-4 text-indigo-500 animate-spin mb-1" />
                               <span className="text-[8px] text-slate-500">GEN</span>
                           </div>
                         )}
                         <div className="absolute bottom-0 right-0 bg-black/70 text-[9px] px-1 text-white font-mono">
                            {Math.floor(item.duration/60)}:{(item.duration%60).toFixed(0).padStart(2,'0')}
                         </div>
                       </div>
                       <div className="flex-1 min-w-0 space-y-2">
                          <input type="text" value={item.title} onChange={(e) => updateField(item.id, 'title', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none text-sm font-bold text-slate-200 p-0 pb-1 transition-colors" placeholder="Título" required />
                          
                          <div className="flex items-center gap-2">
                             <div className="relative">
                                <Tag size={12} className="absolute left-2 top-1.5 text-slate-500" />
                                <select 
                                    value={item.category} 
                                    onChange={(e) => updateField(item.id, 'category', e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 py-1 pl-6 pr-2 outline-none focus:border-indigo-500 uppercase font-bold"
                                >
                                    {availableCategories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                                </select>
                             </div>
                             
                             {/* Individual Price Input */}
                             <div className="relative w-20">
                                <DollarSign size={10} className="absolute left-2 top-2 text-slate-500" />
                                <input 
                                    type="number" 
                                    min="0"
                                    value={item.price}
                                    onChange={(e) => updateField(item.id, 'price', parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-amber-400 font-bold py-1 pl-5 pr-1 outline-none focus:border-indigo-500"
                                />
                             </div>

                             <span className="text-[10px] text-slate-500">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                       </div>
                       <button type="button" onClick={() => removeUpload(item.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1"><X size={16}/></button>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <button 
                    type="submit" 
                    disabled={isProcessingQueue || uploads.length === 0} 
                    className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${isProcessingQueue || uploads.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}
                >
                  {isProcessingQueue ? <><Loader2 className="animate-spin" size={20} /> Procesando Miniaturas...</> : `Publicar ${uploads.length} Video${uploads.length !== 1 ? 's' : ''} en Segundo Plano`}
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
}