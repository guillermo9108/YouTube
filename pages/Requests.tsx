
import React, { useState } from 'react';
import { DownloadCloud, Search, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { db, VideoResult } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/Router';
import { generateThumbnail } from './Upload';

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // -- Search State --
  const [mode, setMode] = useState<'SEARCH' | 'LINK'>('SEARCH');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // -- Processing State --
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  // -- Search Logic (Server Proxy) --
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResults([]);
    setError('');
    
    try {
        // Use DB service to proxy search to backend
        const hits = await db.searchExternal(query);
        if (hits && hits.length > 0) {
            setResults(hits);
        } else {
            setError("No results found. Ensure Admin has configured API Keys.");
        }
    } catch (e: any) {
        setError("Search failed: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
      setSelectedVideos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const processDownloads = async () => {
     if (!user || selectedVideos.length === 0) return;
     
     setProcessing(true);
     setUploadPercent(0);
     try {
        let count = 1;
        const total = selectedVideos.length;

        for (const id of selectedVideos) {
            const videoData = results.find(r => r.id === id);
            if (!videoData) continue;

            // Simple sanitation
            const safeTitle = (query + ' ' + count).replace(/[^a-z0-9 ]/gi, '');
            
            setUploadPercent(0);
            setProgressMsg(`(${count}/${total}) Downloading source...`);
            
            // Download from Pexels/Pixabay via Browser
            const response = await fetch(videoData.downloadUrl);
            if (!response.ok) throw new Error(`Failed to download video file`);
            const blob = await response.blob();
            
            // Create File object
            const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });
            
            setProgressMsg(`(${count}/${total}) Generating Thumbnail...`);
            const thumb = await generateThumbnail(file);

            setProgressMsg(`(${count}/${total}) Uploading to server...`);
            await db.uploadVideo(
                videoData.title || safeTitle, 
                `Imported from ${videoData.source}. By ${videoData.author}.`, 
                1, 
                user, 
                file, 
                thumb,
                (pct) => setUploadPercent(pct)
            );
            
            count++;
        }

        alert("Import successful!");
        navigate('/');

     } catch (e: any) {
         alert("Error during import: " + e.message);
     } finally {
         setProcessing(false);
         setProgressMsg('');
     }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <DownloadCloud className="text-emerald-400" /> Content Import
            </h2>
            <p className="text-slate-400 text-sm">Download stock footage using your connection</p>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800">
          <button 
            onClick={() => setMode('SEARCH')} 
            className={`pb-2 text-sm font-bold flex items-center gap-2 ${mode === 'SEARCH' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Search size={16}/> Search Pexels/Pixabay
          </button>
      </div>

      {mode === 'SEARCH' && (
      <>
      <form onSubmit={handleSearch} className="relative">
         <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
         <input 
            type="text" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search (e.g. 'Ocean')..."
         />
         <button type="submit" disabled={loading} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-lg font-bold disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" /> : 'Search'}
         </button>
      </form>

      {error && <div className="bg-red-900/20 text-red-400 p-4 rounded-xl text-sm border border-red-500/20">{error}</div>}

      {results.length > 0 && (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
               <span className="text-slate-400 text-sm">Found {results.length} results</span>
               {selectedVideos.length > 0 && <span className="text-indigo-400 font-bold text-sm">{selectedVideos.length} selected</span>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {results.map(vid => {
                  const isSelected = selectedVideos.includes(vid.id);
                  return (
                     <div 
                        key={vid.id}
                        onClick={() => toggleSelection(vid.id)}
                        className={`group relative aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 shadow-lg' : 'border-slate-800 hover:border-slate-600'}`}
                     >
                        <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-3">
                           <div className="flex justify-between items-end">
                              <div>
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${vid.source === 'Pexels' ? 'bg-emerald-500 text-emerald-950' : 'bg-blue-500 text-blue-950'}`}>
                                    {vid.source}
                                 </span>
                              </div>
                              {isSelected ? <div className="bg-indigo-600 text-white p-1 rounded-full"><Check size={14} /></div> : <div className="border border-white/30 rounded-full w-6 h-6"></div>}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>

            <div className="sticky bottom-4 z-30">
               <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-300">
                     Import <strong className="text-white">{selectedVideos.length}</strong> videos via your network.
                  </div>
                  <button 
                     onClick={processDownloads}
                     disabled={selectedVideos.length === 0 || processing}
                     className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                  >
                     {processing ? <Loader2 className="animate-spin" size={20} /> : <DownloadCloud size={20} />}
                     {processing ? 'Processing...' : 'Import Selected'}
                  </button>
               </div>
            </div>
         </div>
      )}
      </>
      )}

      {processing && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full">
               <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-6" />
               <h3 className="text-xl font-bold text-white mb-2">Importing</h3>
               <p className="text-emerald-400 font-mono text-sm mb-4">{progressMsg}</p>
               {uploadPercent > 0 && (
                 <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mb-2">
                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div>
                 </div>
               )}
               {uploadPercent > 0 && <p className="text-xs text-emerald-300 font-mono">{uploadPercent}% uploaded</p>}
               <p className="text-xs text-slate-500 mt-6">Searching for SD/Medium quality (Audio Safe).</p>
            </div>
         </div>
      )}

    </div>
  );
}
