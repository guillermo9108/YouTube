
import React, { useState, useEffect } from 'react';
import { DownloadCloud, Search, Check, AlertCircle, Loader2, Settings, Key, Image as ImageIcon, ExternalLink, Layers } from 'lucide-react';
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
  downloadUrl: string; // URL to the smallest video file
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // -- Processing State --
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]); // Array of IDs
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
                    // Find smallest file (sort by size: width * height)
                    const sortedFiles = v.video_files.sort((a: any, b: any) => (a.width * a.height) - (b.width * b.height));
                    const smallest = sortedFiles[0];
                    return {
                        id: `pex-${v.id}`,
                        source: 'Pexels',
                        thumbnail: v.image,
                        title: `Video ${v.id}`, // Pexels doesn't always have titles
                        duration: v.duration,
                        author: v.user.name,
                        downloadUrl: smallest.link,
                        originalUrl: v.url
                    } as VideoResult;
                }));
            }
         } else {
             errors.push(`Pexels Error: ${res.status}`);
         }
       } catch (e: any) {
           errors.push(`Pexels: ${e.message}`);
       }
    }

    // 2. Search Pixabay
    if (apiKeys.pixabay) {
       try {
         const res = await fetch(`https://pixabay.com/api/videos/?key=${apiKeys.pixabay}&q=${encodeURIComponent(query)}&per_page=12`);
         if (res.ok) {
             const data = await res.json();
             if (data.hits) {
                hits.push(...data.hits.map((v: any) => {
                    // Pixabay structure: v.videos.tiny, v.videos.small, etc.
                    // Prefer tiny, then small.
                    const variant = v.videos.tiny || v.videos.small || v.videos.medium;
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
         } else {
             errors.push(`Pixabay Error: ${res.status}`);
         }
       } catch (e: any) {
           errors.push(`Pixabay: ${e.message}`);
       }
    }

    if (!apiKeys.pexels && !apiKeys.pixabay) {
        setError("Please configure at least one API Key in settings.");
    } else if (hits.length === 0 && errors.length > 0) {
        setError(errors.join(', '));
    }

    // Shuffle results slightly to mix sources
    setResults(hits.sort(() => Math.random() - 0.5));
    setLoading(false);
  };

  // -- Selection --
  const toggleSelection = (id: string) => {
      setSelectedVideos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // -- Download & Upload --
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
            
            // 1. Download Blob
            setUploadPercent(0);
            setProgressMsg(`(${count}/${total}) Downloading: ${videoData.source}...`);
            
            const response = await fetch(videoData.downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${videoData.downloadUrl}`);
            const blob = await response.blob();
            
            // 2. Create File
            const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });
            
            // 3. Generate Thumbnail
            setProgressMsg(`(${count}/${total}) Generating Thumbnail...`);
            const thumb = await generateThumbnail(file);

            // 4. Upload
            setProgressMsg(`(${count}/${total}) Uploading to server...`);
            await db.uploadVideo(
                videoData.title || safeTitle, 
                `Imported from ${videoData.source}. By ${videoData.author}.`, 
                1, // Default Price
                user, 
                file, 
                thumb,
                (pct) => setUploadPercent(pct) // Update progress bar
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
         setUploadPercent(0);
     }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
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

      {/* Settings Panel */}
      {showSettings && (
         <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl animate-in slide-in-from-top-2">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
               <Key size={18} /> API Configuration
            </h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pexels API Key</label>
                  <input 
                     type="text" 
                     value={apiKeys.pexels}
                     onChange={e => setApiKeys({...apiKeys, pexels: e.target.value})}
                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                     placeholder="Your Pexels Key"
                  />
                  <a href="https://www.pexels.com/api/" target="_blank" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1">Get Key <ExternalLink size={10}/></a>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pixabay API Key</label>
                  <input 
                     type="text" 
                     value={apiKeys.pixabay}
                     onChange={e => setApiKeys({...apiKeys, pixabay: e.target.value})}
                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                     placeholder="Your Pixabay Key"
                  />
                  <a href="https://pixabay.com/api/docs/" target="_blank" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1">Get Key <ExternalLink size={10}/></a>
               </div>
               <button onClick={saveKeys} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg">
                  Save Configuration
               </button>
            </div>
         </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
         <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
         <input 
            type="text" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg placeholder:text-slate-600"
            placeholder="Search for videos (e.g. 'Ocean', 'City')..."
         />
         <button type="submit" disabled={loading} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-lg font-bold disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="animate-spin" /> : 'Search'}
         </button>
      </form>

      {/* Error Message */}
      {error && (
         <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={18} /> {error}
         </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
               <span className="text-slate-400 text-sm">Found {results.length} results</span>
               {selectedVideos.length > 0 && (
                  <span className="text-indigo-400 font-bold text-sm">{selectedVideos.length} selected</span>
               )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {results.map(vid => {
                  const isSelected = selectedVideos.includes(vid.id);
                  return (
                     <div 
                        key={vid.id}
                        onClick={() => toggleSelection(vid.id)}
                        className={`group relative aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                     >
                        <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        
                        {/* Overlay Info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 flex flex-col justify-end p-3">
                           <div className="flex justify-between items-end">
                              <div>
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${vid.source === 'Pexels' ? 'bg-emerald-500 text-emerald-950' : 'bg-blue-500 text-blue-950'}`}>
                                    {vid.source}
                                 </span>
                                 <h4 className="text-xs font-bold text-white mt-1 line-clamp-1">{vid.title}</h4>
                                 <p className="text-[10px] text-slate-400">{vid.author}</p>
                              </div>
                              {isSelected ? (
                                 <div className="bg-indigo-600 text-white p-1 rounded-full shadow-lg scale-110 transition-transform"><Check size={14} /></div>
                              ) : (
                                 <div className="border border-white/30 rounded-full w-6 h-6"></div>
                              )}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>

            {/* Action Bar */}
            <div className="sticky bottom-4 z-30">
               <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-300">
                     Ready to import <strong className="text-white">{selectedVideos.length}</strong> videos using local network.
                  </div>
                  <button 
                     onClick={processDownloads}
                     disabled={selectedVideos.length === 0 || processing}
                     className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform"
                  >
                     {processing ? <Loader2 className="animate-spin" size={20} /> : <DownloadCloud size={20} />}
                     {processing ? 'Processing...' : 'Import Selected'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Processing Full Screen Overlay */}
      {processing && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full shadow-2xl">
               <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-6" />
               <h3 className="text-xl font-bold text-white mb-2">Importing Content</h3>
               <p className="text-emerald-400 font-mono text-sm mb-4">{progressMsg}</p>
               
               {uploadPercent > 0 && (
                 <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mb-2 border border-slate-700">
                    <div 
                       className="h-full bg-emerald-500 transition-all duration-300 ease-out flex items-center justify-center" 
                       style={{ width: `${uploadPercent}%` }}
                    >
                    </div>
                 </div>
               )}
               {uploadPercent > 0 && <p className="text-xs text-emerald-300 font-mono">{uploadPercent}% uploaded</p>}

               <p className="text-xs text-slate-500 mt-6">
                  Downloading lowest resolution for speed.<br/>Do not close this window.
               </p>
            </div>
         </div>
      )}

    </div>
  );
}
