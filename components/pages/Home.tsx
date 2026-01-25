
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Folder, Database, Server, Filter, Sparkles
} from 'lucide-react';
import { useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (index: number | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 px-1 mb-6 animate-in slide-in-from-left duration-500">
        <button 
            onClick={() => onNavigate(null)} 
            className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors shadow-sm"
        >
            <HomeIcon size={16}/>
        </button>
        {path.map((cat, i) => (
            <React.Fragment key={cat + i}>
                <ChevronRight size={14} className="text-slate-700 shrink-0 mx-1"/>
                <button 
                    onClick={() => onNavigate(i)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${i === path.length - 1 ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-500 border-white/5 hover:text-white'}`}
                >
                    {cat}
                </button>
            </React.Fragment>
        ))}
    </div>
);

export default function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  
  const loadData = async () => {
    setLoading(true);
    try {
        const vids = await db.getAllVideos();
        setAllVideos(vids || []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const currentFolder = path.length > 0 ? path[path.length - 1] : null;

  // Lógica Jerárquica: Carpetas
  const subfolders = useMemo(() => {
    if (searchQuery) return [];
    
    // Filtramos videos cuyo 'parent_category' sea el nivel actual
    // Si estamos en la raíz (null), buscamos videos que tengan categoría pero NO tengan padre
    const children = allVideos.filter(v => (v.parent_category || null) === currentFolder);
    
    // Obtenemos los nombres únicos de categorías en este nivel
    const uniqueFolderNames: string[] = Array.from(new Set(children.map(v => v.category)));
    
    return uniqueFolderNames
        .filter(name => name !== currentFolder) // No mostrarse a sí mismo como subcarpeta
        .map(name => ({
            name,
            count: allVideos.filter(v => v.category === name || v.parent_category === name).length
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVideos, currentFolder, searchQuery]);

  // Lógica Jerárquica: Videos en este nivel
  const levelVideos = useMemo(() => {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return allVideos.filter(v => v.title.toLowerCase().includes(q));
    }
    // Mostramos videos que pertenecen directamente a esta categoría y no tienen subcategoría adicional
    return allVideos.filter(v => v.category === currentFolder && !v.collection);
  }, [allVideos, currentFolder, searchQuery]);

  const handleBreadcrumbClick = (index: number | null) => {
      if (index === null) setPath([]);
      else setPath(prev => prev.slice(0, index + 1));
  };

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-6 animate-pulse">
        <RefreshCw className="animate-spin text-indigo-500" size={48} />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Sincronizando Librería...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input 
            type="text" value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, género o actor..." 
            className="w-full bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl pl-14 pr-12 py-5 text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-xl placeholder:text-slate-600 font-bold" 
          />
          {searchQuery && (
            <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white bg-slate-800 p-1.5 rounded-full transition-all"
            >
                <X size={16}/>
            </button>
          )}
      </div>

      <Breadcrumbs path={path} onNavigate={handleBreadcrumbClick} />

      {/* Folders Grid */}
      {subfolders.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
              {subfolders.map(folder => (
                  <button 
                    key={folder.name} 
                    onClick={() => setPath([...path, folder.name])}
                    className="group relative aspect-[2/1] rounded-[32px] overflow-hidden bg-slate-900 border border-white/5 hover:border-indigo-500/30 transition-all hover:scale-[1.02] shadow-2xl active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 border border-indigo-500/20">
                            <Folder size={24} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-tight line-clamp-1">{folder.name}</h3>
                        <div className="mt-2 bg-black/40 px-3 py-1 rounded-full border border-white/5 text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                            {folder.count} Archivos
                        </div>
                    </div>
                  </button>
              ))}
          </div>
      )}
      
      {/* Videos Section Header */}
      {levelVideos.length > 0 && (
          <div className="flex items-center justify-between px-2 mb-6">
              <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Colección Actual</h2>
              </div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{levelVideos.length} Ítems</span>
          </div>
      )}

      {/* Videos Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
          {levelVideos.map((v: Video) => (
              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} />
          ))}
      </div>

      {/* State: Empty */}
      {levelVideos.length === 0 && subfolders.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-700">
              <div className="w-28 h-28 bg-slate-900 rounded-[40px] flex items-center justify-center border border-white/5 shadow-2xl relative">
                <Database size={48} className="text-slate-800" />
                <Sparkles size={24} className="absolute -top-2 -right-2 text-indigo-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                  <p className="text-slate-500 italic uppercase text-[10px] font-black tracking-[0.5em]">Librería en blanco</p>
                  <p className="text-slate-600 text-xs font-bold max-w-xs mx-auto">No se ha detectado contenido multimedia en este directorio del NAS.</p>
                  {isAdmin && (
                      <div className="pt-6">
                        <Link to="/admin" className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                            <Server size={14}/> Iniciar Escaneo FFmpeg
                        </Link>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      <AIConcierge videos={allVideos} isVisible={true} />
    </div>
  );
}
