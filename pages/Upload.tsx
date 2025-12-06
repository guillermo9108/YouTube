
import React, { useState, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FileVideo, X, Plus, Image as ImageIcon, Tag, Layers, Loader2, DollarSign, Settings, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useNavigate } from '../components/Router';
import { VideoCategory } from '../types';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';

// Helper component to manage object URL lifecycle and prevent memory leaks
const ThumbnailPreview = ({ file }: { file: File }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return <img src={src} alt="Thumb" className="w-full h-full object-cover" />;
};

// Helper to calculate image brightness
const getBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
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
};

export const generateThumbnail = async (file: File): Promise<{ thumbnail: File | null, duration: number }> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    
    // Safety Timeout (5 seconds max per file)
    const timeout = setTimeout(() => {
        // CRITICAL: Clean up memory even on timeout
        URL.revokeObjectURL(objectUrl);
        video.remove();
        resolve({ thumbnail: null, duration: 0 });
    }, 5000);

    video.preload = 'metadata';
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    // Checkpoints to try if the frame is too dark (in percentage of duration)
    const attemptPoints = [0, 0.15, 0.50]; 
    let currentAttempt = 0;

    const captureFrame = () => {
        try {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const canvas = document.createElement('canvas');
            
            // OPTIMIZATION: Scale down to 640px max width.
            // This saves ~75% RAM compared to 1280px, critical for mobile bulk uploads.
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
                    const nextTime = Math.max(1.0, duration * attemptPoints[currentAttempt]);
                    video.currentTime = nextTime;
                    return; // Wait for seeked event again
                }
            }

            canvas.toBlob((blob) => {
                clearTimeout(timeout);
                if (blob) {
                    const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    resolve({ thumbnail: thumbFile, duration });
                } else {
                    resolve({ thumbnail: null, duration: 0 });
                }
                // CRITICAL: Cleanup immediately to free RAM
                URL.revokeObjectURL(objectUrl);
                video.remove();
            }, 'image/jpeg', 0.70); // Lower quality for speed

        } catch (e) {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            video.remove();
            resolve({ thumbnail: null, duration: 0 });
        }
    };

    video.onloadedmetadata = () => {
        video.currentTime = 1.0;
    };

    video.onseeked = captureFrame;
    video.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        video.remove();
        resolve({ thumbnail: null, duration: 0 });
    };
  });
};

export default function Upload() {
  const { user, refreshUser } = useAuth();
  const { addToQueue, isUploading } = useUpload();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [files, setFiles] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<(File | null)[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  
  // Important: categories is now string[] to support custom ones
  const [categories, setCategories] = useState<string[]>([]);
  const [prices, setPrices] = useState<number[]>([]); // New: Individual prices
  
  // Configuration Data
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));
  const [systemCategoryPrices, setSystemCategoryPrices] = useState<Record<string, number>>({});
  
  // Queue Processing State
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const processingRef = useRef(false); 
  const queueRef = useRef<{file: File, index: number}[]>([]);
  const isMounted = useRef(true);

  // Global Settings
  const [desc, setDesc] = useState('');
  
  // Default Prices Modal
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  const [localDefaultPrices, setLocalDefaultPrices] = useState<Record<string, number>>({});

  useEffect(() => {
      isMounted.current = true;
      // Load Custom Categories and Default Prices
      const loadConfig = async () => {
          try {
              const settings = await db.getSystemSettings();
              
              if (isMounted.current) {
                // Merge standard categories with custom ones
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

  // Sync local default prices with user profile when user loads
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
      } catch (e) {
          console.error(e);
          toast.error("Error al guardar");
      }
  };

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
      const startIndex = files.length;

      // 1. Update UI placeholders immediately
      const newTitles = newFiles.map(f => f.name.replace(/\.[^/.]+$/, ""));
      
      setFiles(prev => [...prev, ...newFiles]);
      setTitles(prev => [...prev, ...newTitles]);
      setThumbnails(prev => [...prev, ...new Array(newFiles.length).fill(null)]); // Null means "pending"
      setDurations(prev => [...prev, ...new Array(newFiles.length).fill(0)]);
      
      // Default to 'OTHER' initially, will be refined by duration later
      const defaultCat = VideoCategory.OTHER;
      const defaultPrice = getPriceForCategory(defaultCat);

      setCategories(prev => [...prev, ...new Array(newFiles.length).fill(defaultCat)]);
      setPrices(prev => [...prev, ...new Array(newFiles.length).fill(defaultPrice)]);

      // 2. Add to processing queue
      newFiles.forEach((file, i) => {
          queueRef.current.push({ file, index: startIndex + i });
      });

      setQueueProgress(prev => ({ ...prev, total: prev.total + newFiles.length }));
      
      // 3. Trigger processor if idle
      if (!processingRef.current) {
          processQueue();
      }
    }
  };

  // The Queue Processor - Recursive with Delays
  const processQueue = async () => {
      if (!isMounted.current) return;

      if (queueRef.current.length === 0) {
          processingRef.current = false;
          setIsProcessingQueue(false);
          return;
      }

      processingRef.current = true;
      setIsProcessingQueue(true);

      // Get next task
      const task = queueRef.current.shift(); 
      if (task) {
          setQueueProgress(prev => ({ ...prev, current: prev.current + 1 }));
          
          try {
              // Generate Thumbnail
              const { thumbnail, duration } = await generateThumbnail(task.file);
              
              if (!isMounted.current) return;

              // Smart Category Detection
              const cat = detectCategory(duration);
              const price = getPriceForCategory(cat);

              // Update State for this specific index
              // Check if index still valid (user might have deleted items)
              setThumbnails(prev => {
                  if (prev.length <= task.index) return prev;
                  const n = [...prev]; n[task.index] = thumbnail; return n;
              });
              setDurations(prev => {
                  if (prev.length <= task.index) return prev;
                  const n = [...prev]; n[task.index] = duration; return n;
              });
              
              // Only auto-set category if it is currently 'OTHER' (user hasn't manually changed it yet)
              setCategories(prev => {
                  if (prev.length <= task.index) return prev;
                  // If user changed it while processing, don't overwrite
                  if (prev[task.index] !== VideoCategory.OTHER) return prev;
                  const n = [...prev]; n[task.index] = cat; return n;
              });

              setPrices(prev => {
                  if (prev.length <= task.index) return prev;
                  const n = [...prev]; n[task.index] = price; return n;
              });

          } catch (e) {
              console.error("Thumb gen failed", e);
          }

          // CRITICAL: Delay to allow Garbage Collector to free RAM from the large video blob
          await new Promise(r => setTimeout(r, 300));
          
          // Next iteration
          processQueue();
      }
  };

  const removeFile = (index: number) => {
    if (isProcessingQueue) {
        toast.error("Espera a que termine el análisis");
        return;
    }

    setFiles(prev => prev.filter((_, i) => i !== index));
    setTitles(prev => prev.filter((_, i) => i !== index));
    setThumbnails(prev => prev.filter((_, i) => i !== index));
    setDurations(prev => prev.filter((_, i) => i !== index));
    setCategories(prev => prev.filter((_, i) => i !== index));
    setPrices(prev => prev.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, val: string) => {
    setTitles(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const updateCategory = (index: number, val: string) => {
    setCategories(prev => { const next = [...prev]; next[index] = val; return next; });
    // Auto-update price when category changes manually
    const newPrice = getPriceForCategory(val);
    updatePrice(index, newPrice);
  };
  
  const updatePrice = (index: number, val: number) => {
    setPrices(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || files.length === 0) return;

    const queue = files.map((file, i) => ({
        title: titles[i],
        description: desc,
        price: prices[i],
        category: categories[i] as VideoCategory, // Cast string to VideoCategory (DB supports string actually)
        duration: durations[i],
        file: file,
        thumbnail: thumbnails[i]
    }));

    addToQueue(queue, user);
    toast.success("Añadido a cola de subida");
    
    // Reset
    setFiles([]);
    setTitles([]);
    setThumbnails([]);
    setDurations([]);
    setCategories([]);
    setPrices([]);
    setQueueProgress({ current: 0, total: 0 });
    navigate('/'); 
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UploadIcon className="text-indigo-500" />
        Upload Content
      </h2>

      {isUploading && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-6 flex items-center gap-3">
              <Loader2 className="animate-spin" />
              <div>
                  <div className="font-bold">Upload in progress</div>
                  <div className="text-xs opacity-80">You can add more files to the queue.</div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
           {/* Add Button */}
           <div className={`relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer aspect-square flex flex-col items-center justify-center bg-slate-900/50 ${isProcessingQueue ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="video/*" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isProcessingQueue} />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {isProcessingQueue ? (
                    <>
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <span className="text-slate-400 text-xs mt-2 font-bold">Processing...</span>
                        <span className="text-slate-500 text-[10px]">Queue: {queueProgress.current} / {queueProgress.total}</span>
                        <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                           <div className="h-full bg-indigo-500 transition-all" style={{ width: `${queueProgress.total > 0 ? (queueProgress.current / queueProgress.total) * 100 : 0}%`}}></div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                        <Plus size={24} className="text-indigo-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Add Videos</span>
                        <span className="text-slate-600 text-xs">Smart Queue Active</span>
                    </>
                )}
            </div>
          </div>
          
          {/* Global Settings */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Layers size={14}/> Bulk Description</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white resize-none" placeholder="Applies to all..." />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">Note: Prices are auto-set based on category. You can adjust them individually.</p>
          </div>

          {/* Default Prices */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mt-4">
             <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><DollarSign size={14}/> Default Prices</h3>
                <button type="button" onClick={() => setShowPriceConfig(true)} className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 transition-colors">
                    <Settings size={12}/> Configure
                </button>
             </div>
             <p className="text-[10px] text-slate-500">Auto-fill prices by category.</p>
          </div>
        </div>

        <div className="md:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                 <h3 className="font-bold text-slate-200">Selected ({files.length})</h3>
                 {files.length > 0 && !isProcessingQueue && <button type="button" onClick={() => { setFiles([]); setTitles([]); setThumbnails([]); setDurations([]); setCategories([]); setPrices([]); }} className="text-xs text-red-400 hover:text-red-300">Clear All</button>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 py-10">
                     <FileVideo size={48} className="mb-2" />
                     <p>No videos selected</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 items-start">
                       <div className="w-20 h-14 rounded bg-slate-800 shrink-0 overflow-hidden relative border border-slate-700 group">
                         {thumbnails[idx] ? (
                           <ThumbnailPreview file={thumbnails[idx]!} />
                         ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                               <Loader2 className="w-4 h-4 text-indigo-500 animate-spin mb-1" />
                               <span className="text-[8px] text-slate-500">GEN</span>
                           </div>
                         )}
                         <div className="absolute bottom-0 right-0 bg-black/70 text-[9px] px-1 text-white font-mono">
                            {Math.floor(durations[idx]/60)}:{(durations[idx]%60).toFixed(0).padStart(2,'0')}
                         </div>
                       </div>
                       <div className="flex-1 min-w-0 space-y-2">
                          <input type="text" value={titles[idx]} onChange={(e) => updateTitle(idx, e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none text-sm font-bold text-slate-200 p-0 pb-1 transition-colors" placeholder="Title" required />
                          
                          <div className="flex items-center gap-2">
                             <div className="relative">
                                <Tag size={12} className="absolute left-2 top-1.5 text-slate-500" />
                                <select 
                                    value={categories[idx]} 
                                    onChange={(e) => updateCategory(idx, e.target.value)}
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
                                    value={prices[idx]}
                                    onChange={(e) => updatePrice(idx, parseInt(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded text-xs text-amber-400 font-bold py-1 pl-5 pr-1 outline-none focus:border-indigo-500"
                                />
                             </div>

                             <span className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                       </div>
                       <button type="button" onClick={() => removeFile(idx)} disabled={isProcessingQueue} className={`text-slate-500 hover:text-red-400 transition-colors p-1 ${isProcessingQueue ? 'opacity-30 cursor-not-allowed' : ''}`}><X size={16} /></button>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <button 
                    type="submit" 
                    disabled={isProcessingQueue || files.length === 0} 
                    className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${isProcessingQueue || files.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}
                >
                  {isProcessingQueue ? <><Loader2 className="animate-spin" size={20} /> Processing Thumbnails ({queueProgress.current}/{queueProgress.total})...</> : `Publish ${files.length} Video${files.length !== 1 ? 's' : ''} in Background`}
                </button>
              </div>
           </form>
        </div>
      </div>

      {/* Default Prices Modal */}
      {showPriceConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-md rounded-xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h3 className="font-bold text-white flex items-center gap-2"><Tag size={18}/> Category Price Defaults</h3>
                    <button onClick={() => setShowPriceConfig(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    <p className="text-xs text-slate-400 mb-4">Set your preferred price for each category. These values will be automatically applied when you select a category during upload.</p>
                    {availableCategories.map(cat => (
                        <div key={cat} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                             <span className="text-sm font-bold text-slate-300 uppercase">{cat.replace('_', ' ')}</span>
                             <div className="flex items-center gap-2">
                                 <span className="text-xs text-slate-500">$</span>
                                 <input 
                                    type="number" 
                                    min="0"
                                    value={localDefaultPrices[cat] !== undefined ? localDefaultPrices[cat] : (systemCategoryPrices[cat] ?? '')}
                                    onChange={(e) => setLocalDefaultPrices(prev => ({...prev, [cat]: parseInt(e.target.value) || 0}))}
                                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-indigo-500 outline-none"
                                    placeholder={systemCategoryPrices[cat]?.toString()}
                                 />
                             </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                    <button onClick={handleSaveDefaults} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <Save size={16}/> Save Defaults
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
