
import React, { useState } from 'react';
import { DownloadCloud, Search, Check, Loader2, Server, Globe, Clock, Trash2, Youtube, Image as ImageIcon, Layers, X } from 'lucide-react';
import { db } from '../../services/db';
import { VideoResult, ContentRequest, VideoCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from '../Router';
import { useToast } from '../../context/ToastContext';

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'INSTANT' | 'QUEUE'>('INSTANT');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

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
        // Fuente forzada a YOUTUBE
        const hits = await db.searchExternal(query, 'YOUTUBE');
        if (hits && hits.length > 0) {
            setResults(hits);
        } else {
            setError("No se encontraron videos para esta búsqueda.");
        }
    } catch (e: any) {
        setError(e.message || "Error al conectar con el motor de YouTube.");
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
     
     try {
        let count = 1;
        const total = selectedVideos.length;

        for (const id of selectedVideos) {
            const videoData = results.find((r: VideoResult) => r.id === id);
            if (!videoData) continue;

            setProgressMsg(`Solicitando descarga al servidor (${count}/${total})...`);
            // El servidor se encarga de usar ytdl-core para obtener el MP4 y guardarlo
            await db.serverImportVideo(videoData.downloadUrl);
            count++;
        }

        toast.success("¡Importaciones iniciadas! El servidor procesará los videos en segundo plano.");
        navigate('/');
     } catch (e: any) {
         toast.error("Error durante la importación: " + e.message);
     } finally {
         setProcessing(false);
         setProgressMsg('');
     }
  };

  const loadMyRequests = async () => {
      setLoadingQueue(true);
      try {
          const all = await db.getRequests();
          if (user) setMyRequests(all.filter((r: ContentRequest) => r.userId === user.id));
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
          toast.success("Petición añadida a la cola del servidor");
      } catch (e: any) { toast.error("Fallo al solicitar: " + e.message); }
  };

  const handleDeleteRequest = async (id: string) => {
      if (!confirm("¿Eliminar esta petición?")) return;
      await db.deleteRequest(id);
      loadMyRequests();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-2 animate-in fade-in">
      <div className="flex items-center justify-between mt-4">
         <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
               <DownloadCloud className="text-indigo-400" /> Centro de Contenido
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Importación Masiva desde YouTube</p>
         </div>
      </div>

      <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button onClick={() => setActiveTab('INSTANT')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'INSTANT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             <Youtube size={16}/> Importación Instantánea
          </button>
          <button onClick={() => setActiveTab('QUEUE')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'QUEUE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             <Clock size={16}/> Cola de Peticiones
          </button>
      </div>

      {activeTab === 'INSTANT' && (
      <div className="animate-in slide-in-from-left-4 duration-300 space-y-6">
          <div className="bg-slate-900/50 p-5 rounded-[32px] border border-slate-800 shadow-xl">
             <div className="flex items-center gap-2 mb-4 px-1">
                 <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center"><Youtube size={16} className="text-red-500"/></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motor de búsqueda activo</span>
             </div>
             
             <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
                <input 
                    type="text" value={query} onChange={e => setQuery(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-32 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner" 
                    placeholder="Escribe el título o URL del video..." 
                />
                <button type="submit" disabled={loadingSearch} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95 shadow-lg">
                    {loadingSearch ? <Loader2 className="animate-spin" size={18} /> : 'Buscar'}
                </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-900/20 text-red-400 p-4 rounded-2xl text-xs font-bold border border-red-500/20 animate-pulse flex items-center gap-3">
                <X size={18}/> {error}
            </div>
          )}

          {results.length > 0 && (
             <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{results.length} resultados hallados</span>
                   {selectedVideos.length > 0 && <span className="text-indigo-400 font-black text-[10px] uppercase tracking-widest animate-bounce">{selectedVideos.length} seleccionados</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {results.map(vid => {
                      const isSelected = selectedVideos.includes(vid.id);
                      return (
                         <div key={vid.id} onClick={() => toggleSelection(vid.id)} className={`group relative aspect-video rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 ${isSelected ? 'border-indigo-500 shadow-2xl scale-[1.02]' : 'border-slate-800 hover:border-slate-600'}`}>
                            <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-3">
                               <div className="flex justify-between items-end">
                                  <div className="min-w-0 flex-1 pr-2">
                                     <h4 className="text-[10px] font-black text-white truncate drop-shadow-md uppercase tracking-tighter">{vid.title}</h4>
                                     <span className="text-[8px] font-bold text-slate-400 uppercase">{vid.author}</span>
                                  </div>
                                  {isSelected ? (
                                      <div className="bg-indigo-600 text-white p-1.5 rounded-full shadow-lg border border-indigo-400 animate-in zoom-in"><Check size={14} /></div>
                                  ) : (
                                      <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-full w-7 h-7 flex items-center justify-center text-white/40"><Layers size={14}/></div>
                                  )}
                               </div>
                            </div>
                         </div>
                      );
                   })}
                </div>
                
                <div className="sticky bottom-24 md:bottom-4 z-30 pb-safe">
                   <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 animate-in slide-in-from-bottom-8">
                      <div className="text-[11px] text-slate-300 font-bold ml-2">¿Importar <strong className="text-white text-sm font-black">{selectedVideos.length}</strong> videos?</div>
                      <button onClick={processDownloads} disabled={selectedVideos.length === 0 || processing} className="px-8 py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white flex items-center gap-2 shadow-xl active:scale-95 transition-all">
                         {processing ? <Loader2 className="animate-spin" size={18} /> : <Server size={18}/>}
                         {processing ? 'Procesando...' : 'Iniciar Descarga'}
                      </button>
                   </div>
                </div>
             </div>
          )}
      </div>
      )}

      {activeTab === 'QUEUE' && (
      <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
           <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
             <form onSubmit={handleQueueSubmit} className="flex gap-3">
                <input 
                    type="text" value={queueQuery} onChange={e => setQueueQuery(e.target.value)} 
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                    placeholder="Describe el contenido que buscas..." 
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Enviar Solicitud</button>
            </form>
          </div>
          <div className="space-y-4">
              <h3 className="font-black text-white text-sm uppercase tracking-tighter flex items-center gap-2 ml-2"><Clock size={18} className="text-amber-500"/> Mis Peticiones Pendientes</h3>
              {loadingQueue ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div> : (
                  myRequests.length === 0 ? (
                    <div className="text-center p-12 bg-slate-900/30 rounded-[40px] border-2 border-dashed border-slate-800 text-slate-600 flex flex-col items-center">
                        <DownloadCloud size={48} className="mb-2 opacity-20"/>
                        <p className="text-[10px] font-black uppercase tracking-widest">No hay peticiones en curso</p>
                    </div>
                  ) : (
                      <div className="space-y-3">
                          {myRequests.map((req: ContentRequest) => (
                              <div key={req.id} className="bg-slate-900/80 backdrop-blur-md p-5 rounded-3xl border border-slate-800 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                                  <div className="min-w-0 flex-1">
                                      <h4 className="font-black text-white text-sm uppercase tracking-tighter truncate">{req.query}</h4>
                                      <div className="flex items-center gap-3 mt-1.5">
                                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                              {req.status === 'PENDING' ? 'En espera' : 'Completado'}
                                          </span>
                                          <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(req.createdAt * 1000).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                                  <button onClick={() => handleDeleteRequest(req.id)} className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all active:scale-90 opacity-0 group-hover:opacity-100">
                                      <Trash2 size={18} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )
              )}
          </div>
      </div>
      )}

      {processing && (
         <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-10 rounded-[40px] border border-white/10 text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95">
               <div className="relative mb-8 flex justify-center">
                    <Loader2 size={80} className="text-indigo-500 animate-spin opacity-20" />
                    <Server size={32} className="text-indigo-400 absolute inset-0 m-auto animate-pulse" />
               </div>
               <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter italic">Sincronizando Host</h3>
               <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">{progressMsg}</p>
               <div className="mt-8 pt-6 border-t border-white/5">
                   <p className="text-slate-500 text-[9px] font-bold uppercase italic">No cierres la aplicación hasta terminar el envío de señales.</p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
