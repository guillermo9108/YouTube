
import React, { useState } from 'react';
import { Upload as UploadIcon, FileVideo, X, Plus, Image as ImageIcon, Tag, Layers, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useNavigate } from '../components/Router';
import { VideoCategory } from '../types';

export const generateThumbnail = async (file: File): Promise<{ thumbnail: File | null, duration: number }> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 1.0; 

      video.onloadedmetadata = () => {
         // Duration available here
      };

      video.onseeked = () => {
        try {
          const duration = video.duration || 0;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          if (canvas.width > 1280) {
              const scale = 1280 / canvas.width;
              canvas.width = 1280;
              canvas.height = video.videoHeight * scale;
          }
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
              resolve({ thumbnail: thumbFile, duration });
            } else {
              resolve({ thumbnail: null, duration: 0 });
            }
            URL.revokeObjectURL(video.src);
          }, 'image/jpeg', 0.75);
        } catch (e) {
          resolve({ thumbnail: null, duration: 0 });
        }
      };
      video.onerror = () => resolve({ thumbnail: null, duration: 0 });
    } catch (e) {
       resolve({ thumbnail: null, duration: 0 });
    }
  });
};

export default function Upload() {
  const { user } = useAuth();
  const { addToQueue, isUploading } = useUpload();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<(File | null)[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  
  // Processing State
  const [processingFiles, setProcessingFiles] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Global Settings
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState(1);
  const [globalCategory, setGlobalCategory] = useState<VideoCategory>(VideoCategory.OTHER);

  const detectCategory = (duration: number): VideoCategory => {
      if (duration <= 120) return VideoCategory.SHORTS;
      if (duration <= 300) return VideoCategory.MUSIC;
      if (duration <= 1500) return VideoCategory.SHORT_FILM;
      if (duration <= 2700) return VideoCategory.SERIES; // Up to 45 mins
      if (duration > 2700) return VideoCategory.MOVIE;
      return VideoCategory.OTHER;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProcessingFiles(true);
      const newFiles = Array.from(e.target.files) as File[];
      const newTitles = newFiles.map(f => f.name.replace(/\.[^/.]+$/, ""));

      setFiles(prev => [...prev, ...newFiles]);
      setTitles(prev => [...prev, ...newTitles]);
      
      const startIdx = files.length;
      
      // Init placeholders
      setThumbnails(prev => [...prev, ...new Array(newFiles.length).fill(null)]);
      setDurations(prev => [...prev, ...new Array(newFiles.length).fill(0)]);
      setCategories(prev => [...prev, ...new Array(newFiles.length).fill(globalCategory !== VideoCategory.OTHER ? globalCategory : VideoCategory.OTHER)]);

      // Process sequentially to update UI
      for (let i = 0; i < newFiles.length; i++) {
         const { thumbnail, duration } = await generateThumbnail(newFiles[i]);
         
         // Only use auto-detect if global category isn't set
         const cat = globalCategory !== VideoCategory.OTHER ? globalCategory : detectCategory(duration);
         
         setThumbnails(prev => { const n = [...prev]; n[startIdx + i] = thumbnail; return n; });
         setDurations(prev => { const n = [...prev]; n[startIdx + i] = duration; return n; });
         setCategories(prev => { const n = [...prev]; n[startIdx + i] = cat; return n; });
         
         setProcessedCount(prev => prev + 1);
      }
      setProcessingFiles(false);
      setProcessedCount(0);
    }
  };

  const applyGlobalCategory = (cat: VideoCategory) => {
      setGlobalCategory(cat);
      // Update all existing videos
      setCategories(prev => prev.map(() => cat));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setTitles(prev => prev.filter((_, i) => i !== index));
    setThumbnails(prev => prev.filter((_, i) => i !== index));
    setDurations(prev => prev.filter((_, i) => i !== index));
    setCategories(prev => prev.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, val: string) => {
    setTitles(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const updateCategory = (index: number, val: VideoCategory) => {
    setCategories(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || files.length === 0) return;

    // Build the queue items
    const queue = files.map((file, i) => ({
        title: titles[i],
        description: desc,
        price: price,
        category: categories[i],
        duration: durations[i],
        file: file,
        thumbnail: thumbnails[i]
    }));

    // Send to background context
    addToQueue(queue, user);
    
    // Reset and redirect
    setFiles([]);
    setTitles([]);
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
           <div className={`relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer aspect-square flex flex-col items-center justify-center bg-slate-900/50 ${processingFiles ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="video/*" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={processingFiles} />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {processingFiles ? (
                    <>
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <span className="text-slate-400 text-xs mt-2">Generating Thumbnails...</span>
                        <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                           <div className="h-full bg-indigo-500 transition-all" style={{ width: `${files.length > 0 ? (processedCount / files.length) * 100 : 0}%`}}></div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                        <Plus size={24} className="text-indigo-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Add Videos</span>
                        <span className="text-slate-600 text-xs">Auto-categorization active</span>
                    </>
                )}
            </div>
          </div>
          
          {/* Global Settings */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Layers size={14}/> Bulk Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white resize-none" placeholder="Applies to all..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Price (Saldo)</label>
                <input type="number" min="1" value={price} onChange={e => setPrice(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white font-mono" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Global Category</label>
                  <select 
                      value={globalCategory} 
                      onChange={(e) => applyGlobalCategory(e.target.value as VideoCategory)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                      <option value={VideoCategory.OTHER}>Auto / Mixed</option>
                      {Object.values(VideoCategory).filter(c => c !== VideoCategory.OTHER).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                 <h3 className="font-bold text-slate-200">Selected ({files.length})</h3>
                 {files.length > 0 && <button type="button" onClick={() => { setFiles([]); setTitles([]); setThumbnails([]); setDurations([]); setCategories([]); }} className="text-xs text-red-400 hover:text-red-300">Clear All</button>}
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
                           <img src={URL.createObjectURL(thumbnails[idx]!)} alt="Thumb" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center"><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
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
                                    onChange={(e) => updateCategory(idx, e.target.value as VideoCategory)}
                                    className="bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 py-1 pl-6 pr-2 outline-none focus:border-indigo-500 uppercase font-bold"
                                >
                                    {Object.values(VideoCategory).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                                </select>
                             </div>
                             <span className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                       </div>
                       <button type="button" onClick={() => removeFile(idx)} className="text-slate-500 hover:text-red-400 transition-colors p-1"><X size={16} /></button>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <button 
                    type="submit" 
                    disabled={processingFiles || files.length === 0} 
                    className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${processingFiles || files.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}
                >
                  {processingFiles ? <Loader2 className="animate-spin" size={20} /> : `Publish ${files.length} Video${files.length !== 1 ? 's' : ''} in Background`}
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
}
