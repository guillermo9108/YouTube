
import React, { useState, useEffect } from 'react';
import { DownloadCloud, Search, Check, AlertCircle, Loader2, Settings, Key, Image as ImageIcon, ExternalLink, Layers, Link as LinkIcon } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/Router';
import { generateThumbnail } from './Upload';

interface VideoResult {
  id: string;
  source: 'Pexels' | 'Pixabay';
  thumbnail: string;
  title: string;
  duration?: number;
  downloadUrl: string;
  author: string;
  originalUrl: string;
}

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // -- Settings State --
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    pexels: localStorage.getItem('sp_pexels_key') || '',
    pixabay: localStorage.getItem('sp_pixabay_key') || ''
  });

  const saveKeys = () => {
     localStorage.setItem('sp_pexels_key', apiKeys.pexels);
     localStorage.setItem('sp_pixabay_key', apiKeys.pixabay);
     setShowSettings(false);
     alert("Keys saved!");
  };

  // -- Search State --
  const [mode, setMode] = useState<'SEARCH' | 'LINK'>('SEARCH');
  const [query, setQuery] = useState('');
  const [directLink, setDirectLink] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // -- Processing State --
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  // -- Search Logic --
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResults([]);
    setError('');
    
    const hits: VideoResult[] = [];
    const errors: string[] = [];

    // 1. Search Pexels
    if (apiKeys.pexels) {
       try {
         const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12`, {
            headers: { Authorization: apiKeys.pexels }
         });
         if (res.ok) {
            const data = await res.json();
            if (data.videos) {
                hits.push(...data.videos.map((v: any) => {
                    // Filter for SD/HD quality to ensure audio, avoid "tiny"
                    const files = v.video_files || [];
                    let chosen = files.find((f: any) => f.quality === 'sd') || 
                                 files.find((f: any) => f.quality === 'hd' && f.width < 1300) ||
                                 files[0];

                    return {
                        id: `pex-${v.id}`,
                        source: 'Pexels',
                        thumbnail: v.image,
                        title: `Video ${v.id}`,
                        duration: v.duration,
                        author: v.user.name,
                        downloadUrl: chosen?.link,
                        originalUrl: v.url
                    } as VideoResult;
                }));
            }
         }
       } catch (e: any) { console.error(e); }
    }

    // 2. Search Pixabay
    if (apiKeys.pixabay) {
       try {
         const res = await fetch(`https://pixabay.com/api/videos/?key=${apiKeys.pixabay}&q=${encodeURIComponent(query)}&per_page=12`);
         if (res.ok) {
             const data = await res.json();
             if (data.hits) {
                hits.push(...data.hits.map((v: any) => {
                    // Prefer Medium or Small over Tiny (Tiny is usually silent)
                    const variant = v.videos.medium || v.videos.small || v.videos.tiny;
                    return {
                        id: `pix-${v.id}`,
                        source: 'Pixabay',
                        thumbnail: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`,
                        title: v.tags || `Pixabay ${v.id}`,
                        duration: v.duration,
                        author: v.user,
                        downloadUrl: variant.url,
                        originalUrl: v.pageURL
                    } as VideoResult;
                }));
             }
         }
       } catch (e: any) { console.error(e); }
    }

    if (!apiKeys.pexels && !apiKeys.pixabay) {
        setError("Please configure API Keys in settings.");
    }

    setResults(hits.sort(() => Math.random() - 0.5));
    setLoading(false);
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

            const safeTitle = (query + ' ' + count).replace(/[^a-z0-9 ]/gi, '');
            
            setUploadPercent(0);
            setProgressMsg(`(${count}/${total}) Downloading...`);
            
            const response = await fetch(videoData.downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch video`);
            const blob = await response.blob();
            
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
         alert("Error: " + e.message);
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
            <p className="text-slate-400 text-sm">Download stock footage (Pexels/Pixabay)</p>
         </div>
         <button 
           onClick={() => setShowSettings(!showSettings)}
           className={`p-2 rounded-lg border transition-colors ${showSettings ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
         >
            <Settings size={20} />
         </button>
      </div>

      {showSettings && (
         <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
               <Key size={18} /> Browser API Configuration
            </h3>
            <p className="text-xs text-slate-500 mb-4">These keys are used for the browser-based downloader below.</p>
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pexels Key</label>
                  <input type="text" value={apiKeys.pexels} onChange={e => setApiKeys({...apiKeys, pexels: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm font-mono" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pixabay Key</label>
                  <input type="text" value={apiKeys.pixabay} onChange={e => setApiKeys({...apiKeys, pixabay: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm font-mono" />
               </div>
               <button onClick={saveKeys} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg">Save Configuration</button>
            </div>
         </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800">
          <button 
            onClick={() => setMode('SEARCH')} 
            className={`pb-2 text-sm font-bold flex items-center gap-2 ${mode === 'SEARCH' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Search size={16}/> Search APIs
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
                     Import <strong className="text-white">{selectedVideos.length}</strong> videos.
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
               <p className="text-xs text-slate-500 mt-6">Searching for SD/Medium quality (with Audio).</p>
            </div>
         </div>
      )}

    </div>
  );
}
