
import React, { useState, useEffect } from 'react';
import { DownloadCloud, Wifi, Search, Check, Clock, AlertCircle, Trash2, Upload, Play, Loader2, Link as LinkIcon, Youtube } from 'lucide-react';
import { db } from '../services/db';
import { ContentRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/Router';
import { generateThumbnail } from './Upload'; // Reuse logic

interface PipedVideo {
  url: string; // /watch?v=ID
  title: string;
  thumbnail: string;
  uploaderName: string;
  duration: number;
}

// List of Piped instances to try in case one is down
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.otton.uk',
  'https://pipedapi.drgns.space'
];

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [directLink, setDirectLink] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [searchMode, setSearchMode] = useState<'SEARCH' | 'LINK'>('SEARCH');
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Local Processing State
  const [searchResults, setSearchResults] = useState<PipedVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]); // URLs
  const [activeInstance, setActiveInstance] = useState(PIPED_INSTANCES[0]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = () => {
    setLoading(true);
    db.getRequests().then(res => {
      setRequests(res);
      setLoading(false);
    });
  };

  const handleServerRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;
    try {
      await db.requestContent(user.id, query, false); // useLocal = false
      setQuery('');
      loadRequests();
    } catch (e) {
      alert("Failed to submit request.");
    }
  };

  // Helper to try fetching from multiple instances
  const fetchFromPiped = async (path: string) => {
    let lastError;
    for (const instance of PIPED_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const res = await fetch(`${instance}${path}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          setActiveInstance(instance); 
          return await res.json();
        }
      } catch (e) {
        lastError = e;
        console.warn(`Instance ${instance} failed`, e);
      }
    }
    throw new Error("Public APIs are currently busy. Please try 'Paste Link' or wait.");
  };

  const handleLocalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const data = await fetchFromPiped(`/search?q=${encodeURIComponent(query)}&filter=videos`);
      if (data && data.items) {
        setSearchResults(data.items.slice(0, 8)); // Top 8 results
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleLinkProcess = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!directLink.trim()) return;
      
      // Extract ID
      let videoId = '';
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = directLink.match(regex);
      if (match) videoId = match[1];
      
      if (!videoId) {
          alert("Invalid YouTube URL");
          return;
      }

      setProcessing(true);
      setProgressMsg("Resolving link...");
      
      try {
          // Process single ID
          await downloadAndUpload(videoId, `YouTube Video ${videoId}`);
          alert("Video imported successfully!");
          navigate('/');
      } catch (e: any) {
          alert("Failed to process link: " + e.message);
      } finally {
          setProcessing(false);
          setDirectLink('');
      }
  };

  const downloadAndUpload = async (videoId: string, titleHint: string) => {
     setProgressMsg(`Getting stream info for ${videoId}...`);
     const streamData = await fetchFromPiped(`/streams/${videoId}`);
     
     const title = streamData.title || titleHint;
     
     // Find best mp4 video
     const videoStream = streamData.videoStreams.find((s: any) => s.mimeType === 'video/mp4' && s.quality === '720p') || 
                         streamData.videoStreams.find((s: any) => s.mimeType === 'video/mp4');

     if (!videoStream) throw new Error("No MP4 stream found.");

     setProgressMsg(`Downloading: ${title} ...`);
     const vidResponse = await fetch(videoStream.url);
     const blob = await vidResponse.blob();
     const file = new File([blob], `${title}.mp4`, { type: 'video/mp4' });

     setProgressMsg(`Generating thumbnail...`);
     const thumb = await generateThumbnail(file);

     setProgressMsg(`Uploading to server...`);
     if (!user) throw new Error("User not found");
     await db.uploadVideo(title, `Imported from YouTube: ${videoId}`, 1, user, file, thumb);
  };

  const toggleSelection = (url: string) => {
    if (selectedVideos.includes(url)) {
      setSelectedVideos(prev => prev.filter(v => v !== url));
    } else {
      setSelectedVideos(prev => [...prev, url]);
    }
  };

  const processLocalDownloads = async () => {
    if (!user || selectedVideos.length === 0) return;
    setProcessing(true);
    try {
      let count = 1;
      for (const videoPath of selectedVideos) {
         const videoId = videoPath.replace('/watch?v=', '');
         const title = searchResults.find(v => v.url === videoPath)?.title || 'Downloaded Video';
         setProgressMsg(`Processing ${count}/${selectedVideos.length}: ${title}`);
         await downloadAndUpload(videoId, title);
         count++;
      }
      alert("All selected videos processed successfully!");
      navigate('/');
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this request?')) {
      await db.deleteRequest(id);
      loadRequests();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <DownloadCloud className="text-indigo-400" /> Content Requests
        </h2>
        <p className="text-slate-400 text-sm">
          Import content from YouTube.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
         <button 
           onClick={() => setUseLocal(false)} 
           className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${!useLocal ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
         >
           Server Queue (Auto)
         </button>
         <button 
           onClick={() => setUseLocal(true)} 
           className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${useLocal ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
         >
           <div className="flex items-center justify-center gap-2">
             <Wifi size={16} /> Use My Device (Instant)
           </div>
         </button>
      </div>

      {/* Forms */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        
        {/* Mode 1: Server Queue */}
        {!useLocal && (
          <form onSubmit={handleServerRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                  type="text" 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="E.g. 'Funny Cat Shorts'"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg">
              Submit to Queue
            </button>
            <p className="text-xs text-slate-500 text-center">
               The server will try to download these overnight.
            </p>
          </form>
        )}

        {/* Mode 2: Client Side */}
        {useLocal && (
          <div className="space-y-4">
             {/* Sub-tabs for Search vs Link */}
             <div className="flex border-b border-slate-800 mb-4">
                <button 
                  onClick={() => setSearchMode('SEARCH')}
                  className={`pb-2 px-4 text-sm font-medium ${searchMode === 'SEARCH' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                >
                   Search
                </button>
                <button 
                  onClick={() => setSearchMode('LINK')}
                  className={`pb-2 px-4 text-sm font-medium ${searchMode === 'LINK' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                >
                   Paste Link
                </button>
             </div>

             {searchMode === 'LINK' && (
                 <form onSubmit={handleLinkProcess}>
                    <div className="relative mb-4">
                      <LinkIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
                      <input 
                        type="url" 
                        value={directLink}
                        onChange={e => setDirectLink(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <button type="submit" disabled={processing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                       <DownloadCloud size={18} /> Import Link
                    </button>
                 </form>
             )}

             {searchMode === 'SEARCH' && !isSearching && searchResults.length === 0 && (
               <form onSubmit={handleLocalSearch}>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search YouTube..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                     <Search size={18} /> Search
                  </button>
               </form>
             )}

             {isSearching && (
               <div className="py-10 text-center text-indigo-400">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                  Searching public APIs...
               </div>
             )}

             {/* Results Grid */}
             {searchResults.length > 0 && !processing && (
               <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {searchResults.map((vid) => {
                        const isSelected = selectedVideos.includes(vid.url);
                        return (
                          <div 
                             key={vid.url} 
                             onClick={() => toggleSelection(vid.url)}
                             className={`p-3 rounded-lg border cursor-pointer transition-all flex gap-3 ${isSelected ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-700 hover:bg-slate-800'}`}
                          >
                             <img src={vid.thumbnail} className="w-24 h-16 object-cover rounded bg-slate-800" />
                             <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white line-clamp-2">{vid.title}</h4>
                                <p className="text-xs text-slate-400">{vid.uploaderName}</p>
                             </div>
                             {isSelected && <Check size={20} className="text-indigo-400 shrink-0" />}
                          </div>
                        );
                     })}
                  </div>
                  
                  <div className="flex gap-3">
                     <button onClick={() => { setSearchResults([]); setQuery(''); }} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold">
                        Cancel
                     </button>
                     <button 
                       onClick={processLocalDownloads} 
                       disabled={selectedVideos.length === 0}
                       className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        <DownloadCloud size={20} /> Import {selectedVideos.length} Videos
                     </button>
                  </div>
               </div>
             )}

             {/* Processing UI */}
             {processing && (
               <div className="text-center py-10 bg-slate-950 rounded-lg border border-slate-800">
                  <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Processing on Device</h3>
                  <p className="text-slate-400 text-sm animate-pulse">{progressMsg}</p>
                  <p className="text-xs text-slate-600 mt-4">Do not close this tab.</p>
               </div>
             )}
          </div>
        )}

      </div>

      {/* Requests List (Server Queue Only) */}
      {!useLocal && (
        <div>
          <h3 className="font-bold text-slate-300 mb-4">Server Queue Status</h3>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${req.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {req.status === 'COMPLETED' ? <Check size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                      <h4 className="font-bold text-white text-lg">{req.query}</h4>
                      <span className="text-xs text-slate-400">{req.status}</span>
                  </div>
                </div>
                {req.status === 'PENDING' && (
                  <button onClick={() => handleDelete(req.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
