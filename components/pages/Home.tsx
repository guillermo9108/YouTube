
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder, Bell, Check, CheckCheck, Zap, MessageSquare
} from 'lucide-react';
import { useLocation, useNavigate } from '../Router';
import AIConcierge from '../AIConcierge';

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (cat: string | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <button onClick={() => onNavigate(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
            <HomeIcon size={16}/>
        </button>
        {path.map((cat, i) => (
            <React.Fragment key={cat}>
                <ChevronRight size={12} className="text-slate-600 shrink-0"/>
                <button 
                    onClick={() => onNavigate(cat)}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${i === path.length - 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {cat}
                </button>
            </React.Fragment>
        ))}
    </div>
);

interface SubCategoryCardProps {
    name: string;
    videos: Video[];
    onClick: () => void;
}

const SubCategoryCard: React.FC<SubCategoryCardProps> = ({ name, videos, onClick }) => {
    const randomThumb = useMemo(() => {
        if (videos.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * videos.length);
        return videos[randomIndex].thumbnailUrl;
    }, [videos]);

    return (
        <button 
            onClick={onClick}
            className="group relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 ring-1 ring-white/5"
        >
            {randomThumb ? (
                <img 
                    src={randomThumb} 
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-110 transition-all duration-700" 
                    alt={name} 
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <Folder size={48} />
                </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-indigo-600/90 backdrop-blur-md px-2 py-1 rounded-md shadow-lg border border-white/10">
                <Layers size={10} className="text-white"/>
                <span className="text-[8px] font-black text-white uppercase tracking-widest">COLECCIÓN</span>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] group-hover:text-indigo-300 transition-colors">
                    {name}
                </h3>
                <div className="mt-2 bg-black/40 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/5">
                    <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{videos.length} Elementos</span>
                </div>
            </div>
        </button>
    );
};

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isAiConfigured, setIsAiConfigured] = useState(false);

  // Notificaciones locales en Home
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  // FIX: Comparación numérica estricta porque PHP devuelve "0" o "1"
  const unreadNotifs = useMemo(() => notifs.filter(n => Number(n.isRead) === 0), [notifs]);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (user) {
        try { 
            const res = await db.getNotifications(user.id); 
            setNotifs(res); 
        } catch(e) {}
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, sets] = await Promise.all([db.getAllVideos(), db.getSystemSettings()]);
            setAllVideos(vids.filter(v => !['PENDING', 'PROCESSING'].includes(v.category)));
            setCategories(sets.categories || []);
            setIsAiConfigured(!!sets.geminiKey && sets.geminiKey.trim().length > 5);
            
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act.watched || []);
            }
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id, location.pathname]);

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      try {
          await db.markNotificationRead(id);
          // Actualización optimista: marcar como 1 (leído)
          setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      } catch(e) {}
  };

  const handleMarkAllRead = async () => {
      if (!user) return;
      try {
          await db.markAllNotificationsRead(user.id);
          setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
          setShowNotifMenu(false);
      } catch(e) {}
  };

  const breadcrumbPath = useMemo(() => {
      if (!activeCategory) return [];
      const currentVideoSample = allVideos.find(v => v.category === activeCategory);
      if (currentVideoSample && currentVideoSample.parent_category) {
          return [currentVideoSample.parent_category, activeCategory];
      }
      return [activeCategory];
  }, [activeCategory, allVideos]);

  const currentSubCategories = useMemo(() => {
      if (!activeCategory) {
          return categories.map(c => ({ 
              name: c.name, 
              id: c.id, 
              videos: allVideos.filter(v => v.category === c.name || v.parent_category === c.name)
          })).filter(c => c.videos.length > 0);
      }
      
      const rootCat = categories.find(c => c.name === activeCategory);
      if (rootCat && rootCat.autoSub) {
          const subs = Array.from(new Set(
              allVideos
                .filter(v => v.parent_category === activeCategory)
                .map(v => v.category)
          ));

          return subs.map(s => ({
              name: s,
              id: s,
              videos: allVideos.filter(v => v.category === s && v.parent_category === activeCategory)
          }));
      }
      return [];
  }, [activeCategory, categories, allVideos]);

  const filteredList = useMemo(() => {
      let list = allVideos.filter(v => {
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (!activeCategory) return matchSearch;
          const matchCat = v.category === activeCategory || v.parent_category === activeCategory;
          return matchSearch && matchCat;
      });

      const currentCatSettings = categories.find(c => c.name === activeCategory || c.name === list[0]?.parent_category);
      const sortMode = currentCatSettings?.sortOrder || 'LATEST';

      switch (sortMode) {
          case 'ALPHA':
              // MEJORA: Ordenamiento natural para 01, 02, 10
              list.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
              break;
          case 'RANDOM':
              list.sort(() => (Math.random() - 0.5)); 
              break;
          case 'LATEST':
          default:
              list.sort((a,b) => b.createdAt - a.createdAt);
              break;
      }

      return list;
  }, [allVideos, activeCategory, searchQuery, categories]);

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-8 px-2 md:px-0">
      
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
          {/* Contenedor Flex: Asegura que el buscador ocupe el resto pero la campana tenga espacio fijo */}
          <div className="flex gap-3 mb-4 items-center w-full">
              <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                  <input 
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Buscar contenido..." 
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                  />
              </div>

              {/* CAMPANA DE NOTIFICACIONES: Visible solo si hay unread real */}
              {unreadNotifs.length > 0 && (
                <div className="relative shrink-0" ref={menuRef}>
                    <button 
                        onClick={() => setShowNotifMenu(!showNotifMenu)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-center min-w-[46px] h-[46px] ${showNotifMenu ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        <Bell size={22} className="animate-[ring_2s_infinite]" />
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-lg">
                            {unreadNotifs.length}
                        </span>
                    </button>

                    {showNotifMenu && (
                        <div className="fixed sm:absolute top-[75px] sm:top-full right-4 sm:right-0 w-[calc(100vw-32px)] sm:w-80 max-h-[75vh] sm:max-h-[480px] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top-right z-[200]">
                            <div className="p-4 bg-slate-950 border-b border-white/5 flex justify-between items-center sticky top-0 z-10">
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-amber-400 fill-amber-400"/>
                                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Novedades</h3>
                                </div>
                                <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10">
                                    <CheckCheck size={12}/> Marcar todo
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar bg-slate-900">
                                {unreadNotifs.map(n => (
                                    <div 
                                        key={n.id}
                                        className="p-4 border-b border-white/5 bg-indigo-500/[0.04] hover:bg-white/5 transition-all cursor-pointer group flex gap-3 items-start relative"
                                    >
                                        <div 
                                            onClick={() => { handleMarkRead(n.id); navigate(n.link); setShowNotifMenu(false); }}
                                            className="flex-1 min-w-0 flex gap-3"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-white/10 shadow-sm relative">
                                                {n.avatarUrl ? <img src={n.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-600"><Bell size={16}/></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-slate-200 leading-snug line-clamp-2 pr-6 font-bold">{n.text}</p>
                                                <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block">{new Date(n.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={(e) => handleMarkRead(n.id, e)}
                                            className="p-2 text-slate-500 hover:text-emerald-400 transition-all shrink-0 bg-slate-800/50 rounded-lg hover:bg-emerald-500/10"
                                            title="Marcar como leída"
                                        >
                                            <Check size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="p-3 bg-slate-950/80 text-center border-t border-white/5">
                                <button 
                                    onClick={() => { navigate('/profile'); setShowNotifMenu(false); }} 
                                    className="text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
                                >
                                    Ver Historial Completo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              )}
          </div>
          
          <Breadcrumbs path={breadcrumbPath} onNavigate={setActiveCategory} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          {currentSubCategories.map(sub => (
              <SubCategoryCard 
                  key={sub.id} 
                  name={sub.name} 
                  videos={sub.videos} 
                  onClick={() => setActiveCategory(sub.name)} 
              />
          ))}

          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard 
                key={v.id} 
                video={v} 
                isUnlocked={isAdmin || user?.id === v.creatorId} 
                isWatched={watchedIds.includes(v.id)} 
              />
          ))}
      </div>

      {filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button 
                onClick={() => setVisibleCount(p => p + 12)}
                className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl"
              >
                  Ver más
              </button>
          </div>
      )}

      {filteredList.length === 0 && currentSubCategories.length === 0 && (
          <div className="text-center py-40">
              <Shuffle className="mx-auto mb-4 text-slate-800" size={64}/>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay contenido</p>
          </div>
      )}

      <AIConcierge videos={allVideos} isVisible={isAiConfigured} />
      
      <style>{`
        @keyframes ring {
            0% { transform: rotate(0); }
            5% { transform: rotate(30deg); }
            10% { transform: rotate(-28deg); }
            15% { transform: rotate(26deg); }
            20% { transform: rotate(-24deg); }
            25% { transform: rotate(22deg); }
            30% { transform: rotate(-20deg); }
            35% { transform: rotate(18deg); }
            40% { transform: rotate(-16deg); }
            45% { transform: rotate(14deg); }
            50% { transform: rotate(-12deg); }
            55% { transform: rotate(10deg); }
            60% { transform: rotate(-8deg); }
            65% { transform: rotate(6deg); }
            70% { transform: rotate(-4deg); }
            75% { transform: rotate(2deg); }
            80% { transform: rotate(-1deg); }
            85% { transform: rotate(1deg); }
            90% { transform: rotate(0); }
            100% { transform: rotate(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}
