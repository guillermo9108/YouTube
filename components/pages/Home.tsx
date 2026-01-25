
import React, { useState, useEffect, useMemo } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, User } from '../../types';
import { 
    // Added 'Server' icon to fix "Cannot find name 'Server'" error
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Folder, Menu, ShieldCheck, Database, Server
} from 'lucide-react';
import { useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (index: number | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3 animate-in fade-in sticky top-0 bg-black/60 backdrop-blur-md z-20 -mx-4 px-4">
        <button onClick={() => onNavigate(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><HomeIcon size={16}/></button>
        {path.map((cat, i) => (
            <React.Fragment key={cat + i}>
                <ChevronRight size={12} className="text-slate-600 shrink-0"/>
                <button 
                    onClick={() => onNavigate(i)}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${i === path.length - 1 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
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
  
  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const vids = await db.getAllVideos();
            setAllVideos(vids || []);
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, []);

  const currentFolder = path.length > 0 ? path[path.length - 1] : null;

  // Filtro de Carpetas (Dinámico por nivel)
  const subfolders = useMemo(() => {
    if (searchQuery) return [];
    // Buscamos videos cuyo padre sea el nivel actual
    const children = allVideos.filter(v => (v.parent_category || null) === currentFolder);
    const uniqueFolderNames: string[] = Array.from(new Set(children.map(v => v.category)));
    
    return uniqueFolderNames.map(name => ({
        name,
        count: allVideos.filter(v => v.category === name).length
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allVideos, currentFolder, searchQuery]);

  // Filtro de Videos (Nivel actual)
  const levelVideos = useMemo(() => {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return allVideos.filter(v => v.title.toLowerCase().includes(q));
    }
    // Mostramos videos que pertenecen a la carpeta/categoría seleccionada
    // Si estamos en la raíz (null), mostramos videos que NO tienen categoría padre
    return allVideos.filter(v => (v.parent_category || null) === currentFolder);
  }, [allVideos, currentFolder, searchQuery]);

  const handleBreadcrumbClick = (index: number | null) => {
      if (index === null) setPath([]);
      else setPath(prev => prev.slice(0, index + 1));
  };

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-4">
      <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
          <input 
            type="text" value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="¿Qué quieres ver hoy?" 
            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-white focus:border-indigo-500/50 outline-none transition-all" 
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-slate-500 hover:text-white"><X size={18}/></button>}
      </div>

      <Breadcrumbs path={path} onNavigate={handleBreadcrumbClick} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          {subfolders.map(folder => (
              <button 
                key={folder.name} 
                onClick={() => setPath([...path, folder.name])}
                className="group relative aspect-video rounded-3xl overflow-hidden bg-slate-900 border border-white/5 hover:border-indigo-500/30 transition-all hover:scale-[1.02] shadow-xl"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Folder size={48} className="text-indigo-500/20 mb-2 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-500" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">{folder.name}</h3>
                    <div className="mt-2 bg-black/40 px-3 py-1 rounded-full border border-white/5 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        {folder.count} Archivos
                    </div>
                </div>
              </button>
          ))}
          
          {levelVideos.map((v: Video) => (
              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} />
          ))}
      </div>

      {levelVideos.length === 0 && subfolders.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-slate-900 rounded-[40px] flex items-center justify-center border border-white/5">
                <Database size={48} className="text-slate-700 opacity-20" />
              </div>
              <div>
                  <p className="text-slate-500 italic uppercase text-[10px] font-black tracking-[0.3em]">Catálogo vacío</p>
                  {isAdmin && (
                      <Link to="/admin" className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95">
                          {/* Fixed: Server icon is now imported */}
                          <Server size={14}/> Iniciar Escaneo NAS
                      </Link>
                  )}
              </div>
          </div>
      )}
      
      <AIConcierge videos={allVideos} isVisible={false} />
    </div>
  );
}
