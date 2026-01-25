import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification, MarketplaceItem, User } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder, Bell, Check, Zap, Clock, Film, ShoppingBag, Tag, Users, Star, Menu, Crown, User as UserIcon, LogOut, ShieldCheck
} from 'lucide-react';
import { useLocation, useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const Sidebar = ({ isOpen, onClose, user, isAdmin, logout }: { isOpen: boolean, onClose: () => void, user: User | null, isAdmin: boolean, logout: () => void }) => {
    const navigate = useNavigate();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 border-2 border-white/10 overflow-hidden shadow-lg">
                            {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-white text-xl">{user?.username?.[0] || '?'}</div>}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate">@{user?.username || 'Usuario'}</div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</div>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tu Saldo</p>
                        <div className="text-xl font-black text-emerald-400">{Number(user?.balance || 0).toFixed(2)} $</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => { navigate('/'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <HomeIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/><span className="text-xs font-black uppercase tracking-widest">Inicio</span>
                    </button>
                    <button onClick={() => { navigate('/profile'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <UserIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/><span className="text-xs font-black uppercase tracking-widest">Mi Perfil</span>
                    </button>
                    <button onClick={() => { navigate('/vip'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Crown size={20} className="text-slate-500 group-hover:text-amber-500"/><span className="text-xs font-black uppercase tracking-widest">VIP & Recargas</span>
                    </button>
                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 px-4">Administración</p>
                            <button onClick={() => { navigate('/admin'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all border border-indigo-500/20">
                                <ShieldCheck size={20}/><span className="text-xs font-black uppercase tracking-widest">Panel Admin</span>
                            </button>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut size={20}/><span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (cat: string | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 animate-in fade-in sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <button onClick={() => onNavigate(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><HomeIcon size={16}/></button>
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

// Fix: Redefine SubCategoryCard as React.FC to properly handle key prop and other JSX standard properties
const SubCategoryCard: React.FC<{ name: string, videos: Video[], onClick: () => void }> = ({ name, videos, onClick }) => {
    const randomThumb = useMemo(() => {
        if (!videos || videos.length === 0) return null;
        const goodVids = videos.filter(v => v.thumbnailUrl && !v.thumbnailUrl.includes('default.jpg'));
        const source = goodVids.length > 0 ? goodVids : videos;
        return source[Math.floor(Math.random() * source.length)]?.thumbnailUrl;
    }, [videos]);

    return (
        <button 
            onClick={onClick}
            className="group relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 ring-1 ring-white/5"
        >
            {randomThumb ? (
                <img src={randomThumb} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-110 transition-all duration-700" alt={name} />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700"><Folder size={48} /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter group-hover:text-indigo-300 transition-colors">{name}</h3>
                <div className="mt-2 bg-black/40 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/5">
                    <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{videos?.length || 0} Elementos</span>
                </div>
            </div>
        </button>
    );
};

export default function Home() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  const unreadNotifs = useMemo(() => notifs.filter(n => Number(n.isRead) === 0), [notifs]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifs = async () => { if (user) try { const res = await db.getNotifications(user.id); setNotifs(res || []); } catch(e) {} };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, sets] = await Promise.all([db.getAllVideos(), db.getSystemSettings()]);
            setAllVideos(vids || []);
            setCategories(sets?.categories || []);
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id, location.pathname]);

  const currentSubCategories = useMemo(() => {
      const active = activeCategory as string | null;
      if (searchQuery) return []; 
      
      if (!active) {
          // Descubrimiento Dinámico de Categorías: 
          // Agrupar videos por su categoría actual y mostrar carpetas
          // Fix: Explicitly type uniqueCats as string[] to fix localeCompare error on unknown type
          const uniqueCats: string[] = Array.from(new Set(allVideos.map(v => v.category)));
          return uniqueCats.map(name => ({
              name,
              id: name,
              videos: allVideos.filter(v => v.category === name)
          })).sort((a, b) => a.name.localeCompare(b.name));
      }
      
      const rootCat = categories.find(c => c.name === active);
      if (rootCat && rootCat.autoSub) {
          const subs = Array.from(new Set(allVideos.filter(v => v.parent_category === active).map(v => v.category)));
          return subs.map(s => ({
              name: s,
              id: s,
              videos: allVideos.filter(v => v.category === s && v.parent_category === active)
          }));
      }
      return [];
  }, [activeCategory, categories, allVideos, searchQuery]);

  const filteredList = useMemo(() => {
      let list = [...allVideos].filter(v => {
          if (searchQuery) {
              const q = searchQuery.toLowerCase();
              return v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
          }
          if (!activeCategory) return true;
          return v.category === activeCategory || v.parent_category === activeCategory;
      });

      const currentCatSettings = categories.find(c => c.name === activeCategory);
      const sortMode = currentCatSettings?.sortOrder || 'LATEST';

      if (sortMode === 'ALPHA') list.sort((a, b) => naturalCollator.compare(a.title, b.title));
      else if (sortMode === 'RANDOM') list.sort(() => (Math.random() - 0.5)); 
      else list.sort((a,b) => Number(b.createdAt) - Number(a.createdAt));

      return list;
  }, [allVideos, activeCategory, categories, searchQuery]);

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
                    placeholder="Buscar en la librería..." 
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={16}/></button>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
                  <button onClick={() => setShowNotifMenu(!showNotifMenu)} className={`p-2.5 rounded-xl border transition-all flex items-center justify-center min-w-[46px] h-[46px] relative ${showNotifMenu ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                      <Bell size={22} />
                      {unreadNotifs.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-lg">{unreadNotifs.length}</span>}
                  </button>
              </div>
          </div>
          <Breadcrumbs path={activeCategory ? [activeCategory] : []} onNavigate={setActiveCategory} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
          {currentSubCategories.map(sub => (
              <SubCategoryCard key={sub.id} name={sub.name} videos={sub.videos} onClick={() => setActiveCategory(sub.name)} />
          ))}
          {filteredList.slice(0, visibleCount).map((v: Video) => (
              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={false} />
          ))}
      </div>

      {filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl">Cargar más</button>
          </div>
      )}
      
      <AIConcierge videos={allVideos} isVisible={false} />
    </div>
  );
}