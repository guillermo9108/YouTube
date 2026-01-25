import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification, User } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Folder, Bell, Menu, Crown, User as UserIcon, LogOut, ShieldCheck
} from 'lucide-react';
import { useLocation, useNavigate } from '../Router';
import AIConcierge from '../AIConcierge';

const Sidebar = ({ isOpen, onClose, user, isAdmin, logout }: { isOpen: boolean, onClose: () => void, user: User | null, isAdmin: boolean, logout: () => void }) => {
    const navigate = useNavigate();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl">
                            {user?.username?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate">@{user?.username || 'Usuario'}</div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button onClick={() => { navigate('/'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all">
                        <HomeIcon size={20}/><span className="text-xs font-black uppercase tracking-widest">Inicio</span>
                    </button>
                    {isAdmin && (
                        <button onClick={() => { navigate('/admin'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 text-indigo-300 transition-all border border-indigo-500/20">
                            <ShieldCheck size={20}/><span className="text-xs font-black uppercase tracking-widest">Panel Admin</span>
                        </button>
                    )}
                </div>
                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10">
                        <LogOut size={20}/><span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (index: number | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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

  // Filtro de Carpetas (Subcategorías)
  const subfolders = useMemo(() => {
    if (searchQuery) return [];
    // Buscamos videos cuyo padre sea la carpeta actual y extraemos sus categorías únicas
    const children = allVideos.filter(v => (v.parent_category || null) === currentFolder);
    const uniqueFolderNames: string[] = Array.from(new Set(children.map(v => v.category)));
    
    return uniqueFolderNames.map(name => ({
        name,
        count: allVideos.filter(v => v.category === name).length
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allVideos, currentFolder, searchQuery]);

  // Filtro de Videos (Los que están exactamente en este nivel)
  const levelVideos = useMemo(() => {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return allVideos.filter(v => v.title.toLowerCase().includes(q));
    }
    // Mostramos videos que pertenecen a la carpeta actual
    // Si estamos en la raíz (null), buscamos videos de categoría 'GENERAL' o sin padre
    if (currentFolder === null) {
        return allVideos.filter(v => v.parent_category === null && v.category === 'GENERAL');
    }
    return allVideos.filter(v => v.category === currentFolder);
  }, [allVideos, currentFolder, searchQuery]);

  const handleBreadcrumbClick = (index: number | null) => {
      if (index === null) setPath([]);
      else setPath(prev => prev.slice(0, index + 1));
  };

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-6">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>

      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
          <div className="flex gap-3 mb-4 items-center w-full">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-400 active:scale-95 transition-transform"><Menu size={20}/></button>
              <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                  <input 
                    type="text" value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar contenido..." 
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none" 
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={16}/></button>}
              </div>
          </div>
          <Breadcrumbs path={path} onNavigate={handleBreadcrumbClick} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          {subfolders.map(folder => (
              <button 
                key={folder.name} 
                onClick={() => setPath([...path, folder.name])}
                className="group relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Folder size={48} className="text-slate-700 mb-2 group-hover:text-indigo-500 transition-colors" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">{folder.name}</h3>
                    <div className="mt-2 bg-black/40 px-3 py-0.5 rounded-full border border-white/5 text-[10px] text-slate-400 font-black uppercase">
                        {folder.count} Elementos
                    </div>
                </div>
              </button>
          ))}
          
          {levelVideos.map((v: Video) => (
              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} />
          ))}
      </div>

      {levelVideos.length === 0 && subfolders.length === 0 && (
          <div className="py-20 text-center text-slate-600 italic uppercase text-xs font-black tracking-widest">
              Esta carpeta está vacía
          </div>
      )}
      
      <AIConcierge videos={allVideos} isVisible={false} />
    </div>
  );
}