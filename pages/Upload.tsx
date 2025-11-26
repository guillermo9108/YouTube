import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileVideo, X, Plus } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../App';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Batch State
  const [files, setFiles] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]); // Synced with files index
  
  // Shared State
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      setFiles(prev => [...prev, ...newFiles]);
      
      // Initialize titles for new files
      const newTitles = newFiles.map(f => f.name.replace(/\.[^/.]+$/, ""));
      setTitles(prev => [...prev, ...newTitles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setTitles(prev => prev.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, val: string) => {
    setTitles(prev => {
       const next = [...prev];
       next[index] = val;
       return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || files.length === 0) return;
    
    setIsSubmitting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);
        await db.uploadVideo(titles[i], desc, price, user, files[i]);
      }
      navigate('/');
    } catch (error) {
      console.error(error);
      alert("Failed to upload one or more videos");
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UploadIcon className="text-indigo-500" />
        Upload Content
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Upload Area */}
        <div className="md:col-span-1 space-y-4">
           <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-slate-800/50 transition-colors group cursor-pointer aspect-square flex flex-col items-center justify-center bg-slate-900/50">
            <input 
              type="file" 
              accept="video/*" 
              multiple
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                  <Plus size={24} className="text-indigo-400" />
                </div>
                <span className="text-slate-400 text-sm font-medium">Add Videos</span>
                <span className="text-slate-600 text-xs">Supports multiple files</span>
            </div>
          </div>
          
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Global Settings</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description (Shared)</label>
                <textarea 
                  rows={3}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white resize-none"
                  placeholder="Applies to all videos..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Price (Saldo)</label>
                <div className="flex items-center">
                  <span className="bg-slate-800 border border-slate-700 border-r-0 rounded-l-lg px-3 py-1.5 text-slate-400 font-bold text-sm">
                    $
                  </span>
                  <input 
                    type="number" 
                    min="1"
                    value={price}
                    onChange={e => setPrice(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-r-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: File List */}
        <div className="md:col-span-2">
           <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                 <h3 className="font-bold text-slate-200">Selected Videos ({files.length})</h3>
                 {files.length > 0 && <button type="button" onClick={() => { setFiles([]); setTitles([]); }} className="text-xs text-red-400 hover:text-red-300">Clear All</button>}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 py-10">
                     <FileVideo size={48} className="mb-2" />
                     <p>No videos selected</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 items-start animate-in fade-in slide-in-from-bottom-2">
                       <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center shrink-0">
                         <FileVideo size={20} className="text-indigo-400" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <input 
                            type="text" 
                            value={titles[idx]}
                            onChange={(e) => updateTitle(idx, e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none text-sm font-medium text-slate-200 p-0 pb-1 mb-1 transition-colors"
                            placeholder="Video Title"
                            required
                          />
                          <p className="text-xs text-slate-500 truncate">{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                       </div>
                       <button 
                         type="button" 
                         onClick={() => removeFile(idx)}
                         className="text-slate-500 hover:text-red-400 transition-colors p-1"
                       >
                         <X size={16} />
                       </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <button 
                  type="submit" 
                  disabled={isSubmitting || files.length === 0}
                  className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${isSubmitting || files.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'}`}
                >
                  {isSubmitting ? (
                    <>
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       {uploadProgress}
                    </>
                  ) : (
                    `Publish ${files.length} Video${files.length !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
           </form>
        </div>

      </div>
    </div>
  );
}