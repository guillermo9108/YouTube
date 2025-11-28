
import React, { useState } from 'react';
import { DownloadCloud, Search, Check, Loader2, Server, Globe, Clock, Trash2, Youtube, Image as ImageIcon } from 'lucide-react';
import { db, VideoResult } from '../services/db';
import { ContentRequest, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/Router';
import { generateThumbnail } from './Upload';

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'INSTANT' | 'QUEUE'>('INSTANT');
  const [source, setSource] = useState<'STOCK' | 'YOUTUBE'>('STOCK');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const [queueQuery, setQueueQuery] = useState('');
  const [myRequests, setMyRequests] = useState<ContentRequest[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoadingSearch(true);
    setResults([]);
    setError('');
    
    try {
        const hits = await db.searchExternal(query, source);
        if (hits && hits.length > 0) setResults(hits);
        else setError("No results found. Please check Admin API Keys configuration.");
    } catch (e: any) {
        setError("Search failed: " + e.message);
    } finally {
        setLoadingSearch(false);
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

            // YOUTUBE SERVER SIDE IMPORT
            if (source === 'YOUTUBE') {
                setProgressMsg(`(${count}/${total}) Requesting server download...`);
                await db.serverImportVideo(videoData.downloadUrl);
                count++;
                continue;
            }

            // STOCK CLIENT SIDE IMPORT
            const safeTitle = (query + ' ' + count).replace(/[^a-z0-9 ]/gi, '');
            setUploadPercent(0);
            setProgressMsg(`(${count}/${total}) Downloading source...`);
            
            const response = await fetch(videoData.downloadUrl);
            if (!response.ok) throw new Error(`Failed to download video file`);
            const blob = await response.blob();
            const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });
            
            setProgressMsg(`(${count}/${total}) Generating Thumbnail...`);
            // generateThumbnail now returns { thumbnail, duration }
            const { thumbnail, duration } = await generateThumbnail(file);

            setProgressMsg(`(${count}/${total}) Uploading to server...`);
            await db.uploadVideo(
                videoData.title || safeTitle, 
                `Imported from ${videoData.source}. By ${videoData.author}.`, 
                1, 
                VideoCategory.OTHER, // Default category for imports
                duration,
                user, 
                file, 
                thumbnail,
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

  const loadMyRequests = async () => {
      setLoadingQueue(true);
      try {
          const all = await db.getRequests();
          if (user) setMyRequests(all.filter(r => r.userId === user.id));
      } finally { setLoadingQueue(false); }
  };

  React.useEffect(() => { if (activeTab === 'QUEUE') loadMyRequests(); }, [activeTab]);

  const handleQueueSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !queueQuery.trim()) return;
      try {
          await db.requestContent(user.id, queueQuery, false);
          setQueueQuery('');
          loadMyRequests();
          alert("Request added to server queue!");
      } catch (e: any) { alert("Failed to request: " + e.message); }
  };

  const handleDeleteRequest = async (id: string) => {
      if (!confirm("Remove this request?")) return;
      await db.deleteRequest(id);
      loadMyRequests();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <DownloadCloud className="text-indigo-400" /> Content Center
            </h2>
            <p className="text-slate-400 text-sm">Import content via Client or Server</p>
         </div>
      </div>

      <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
          <button onClick={() => setActiveTab('INSTANT')} className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'INSTANT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
             <Globe size={16}/> Instant Import
          </button>
          <button onClick={() => setActiveTab('QUEUE')} className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'QUEUE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
             <Server size={16}/> Server Queue
          </button>
      </div>

      {activeTab === 'INSTANT' && (
      <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
             <div className="flex gap-4 mb-4">
                 <button onClick={() => setSource('STOCK')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${source === 'STOCK' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <ImageIcon size={16}/> Stock (Pexels/Pixabay)
                 </button>
                 <button onClick={() => setSource('YOUTUBE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${source === 'YOUTUBE' ? 'bg-red-600/20 text-red-400 border border-red-500/50' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Youtube size={16}/> YouTube
                 </button>
             </div>
             
             <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={source === 'YOUTUBE' ? "Search YouTube..." : "Search Stock Videos..."} />
                <button type="submit" disabled={loadingSearch} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-lg font-bold disabled:opacity-50">
                    {loadingSearch ? <Loader2 className="animate-spin" /> : 'Search'}
                </button>
            </form>
          </div>

          {error && <div className="bg-red-900/20 text-red-400 p-4 rounded-xl text-sm border border-red-500/20 mb-6">{error}</div>}

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
                         <div key={vid.id} onClick={() => toggleSelection(vid.id)} className={`group relative aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 shadow-lg' : 'border-slate-800 hover:border-slate-600'}`}>
                            <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-3">
                               <div className="flex justify-between items-end">
                                  <div><span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${vid.source === 'YouTube' ? 'bg-red-600 text-white' : (vid.source === 'Pexels' ? 'bg-emerald-500 text-emerald-950' : 'bg-blue-500 text-blue-950')}`}>{vid.source}</span></div>
                                  {isSelected ? <div className="bg-indigo-600 text-white p-1 rounded-full"><Check size={14} /></div> : <div className="border border-white/30 rounded-full w-6 h-6"></div>}
                               </div>
                            </div>
                         </div>
                      );
                   })}
                </div>
                <div className="sticky bottom-4 z-30">
                   <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4">
                      <div className="text-sm text-slate-300">Ready to import <strong className="text-white">{selectedVideos.length}</strong> videos.</div>
                      <button onClick={processDownloads} disabled={selectedVideos.length === 0 || processing} className={`px-6 py-3 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 text-white ${source === 'YOUTUBE' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                         {processing ? <Loader2 className="animate-spin" size={20} /> : (source === 'YOUTUBE' ? <Server size={20}/> : <DownloadCloud size={20} />)}
                         {processing ? 'Processing...' : (source === 'YOUTUBE' ? 'Server Import' : 'Start Import')}
                      </button>
                   </div>
                </div>
             </div>
          )}
      </div>
      )}

      {activeTab === 'QUEUE' && (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
           <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
             <form onSubmit={handleQueueSubmit} className="flex gap-2">
                <input type="text" value={queueQuery} onChange={e => setQueueQuery(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Request Topic..." />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl font-bold">Add to Queue</button>
            </form>
          </div>
          <div className="space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18}/> My Pending Requests</h3>
              {loadingQueue ? <Loader2 className="animate-spin text-indigo-500" /> : (
                  myRequests.length === 0 ? <div className="text-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 text-slate-500">No pending requests.</div> : (
                      <div className="space-y-3">
                          {myRequests.map(req => (
                              <div key={req.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                  <div>
                                      <h4 className="font-bold text-white text-lg">{req.query}</h4>
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{req.status}</span>
                                  </div>
                                  <button onClick={() => handleDeleteRequest(req.id)} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={18} /></button>
                              </div>
                          ))}
                      </div>
                  )
              )}
          </div>
      </div>
      )}

      {processing && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full">
               <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-6" />
               <h3 className="text-xl font-bold text-white mb-2">{source === 'YOUTUBE' ? 'Server Download' : 'Importing'}</h3>
               <p className="text-emerald-400 font-mono text-sm mb-4">{progressMsg}</p>
               {uploadPercent > 0 && <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mb-2"><div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div></div>}
            </div>
         </div>
      )}
    </div>
  );
}
