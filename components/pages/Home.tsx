
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification, MarketplaceItem, User } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder, Bell, Check, Zap, Clock, Film, ShoppingBag, Tag, Users, Star, Menu, Crown, User as UserIcon, LogOut, ShieldCheck, Heart, History
} from 'lucide-react';
import { useLocation, useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// --- Componentes Auxiliares ---

const Sidebar = ({ isOpen, onClose, user, isAdmin, logout }: { isOpen: boolean, onClose: () => void, user: User | null, isAdmin: boolean, logout: () => void }) => {
    const navigate = useNavigate();
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* Drawer */}
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-slate-900 border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                        <X size={20}/>
                    </button>
                    
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 border-2 border-white/10 overflow-hidden shadow-lg">
                            {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-white text-xl">{user?.username[0]}</div>}
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-white truncate">@{user?.username}</div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tu Saldo</p>
                        <div className="text-xl font-black text-emerald-400">{Number(user?.balance).toFixed(2)} $</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => { navigate('/'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <HomeIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Inicio</span>
                    </button>
                    <button onClick={() => { navigate('/profile'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <UserIcon size={20} className="text-slate-500 group-hover:text-indigo-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Mi Perfil</span>
                    </button>
                    <button onClick={() => { navigate('/watch-later'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Clock size={20} className="text-slate-500 group-hover:text-amber-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Ver más tarde</span>
                    </button>
                    <button onClick={() => { navigate('/vip'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <Crown size={20} className="text-slate-500 group-hover:text-amber-500"/>
                        <span className="text-xs font-black uppercase tracking-widest">VIP & Recargas</span>
                    </button>
                    <button onClick={() => { navigate('/marketplace'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 text-slate-300 hover:text-white transition-all group">
                        <ShoppingBag size={20} className="text-slate-500 group-hover:text-emerald-400"/>
                        <span className="text-xs font-black uppercase tracking-widest">Tienda</span>
                    </button>
                    
                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 px-4">Administración</p>
                            <button onClick={() => { navigate('/admin'); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all border border-indigo-500/20">
                                <ShieldCheck size={20}/>
                                <span className="text-xs font-black uppercase tracking-widest">Panel Admin</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut size={20}/>
                        <span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

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
            className="group relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 ring-1 ring-white/5"
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

// --- Interfaces de Búsqueda ---
interface UnifiedSearchResults {
    videos: Video[];
    marketplace: MarketplaceItem[];
    users: User[];
    subcategories: {
        id: string;
        name: string;
        videos: Video[];
    }[];
}

// --- Componente Principal ---

export default function Home() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [marketItems, setMarketItems] = useState<MarketplaceItem[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isAiConfigured, setIsAiConfigured] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Search State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);

  // Notifications State
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  // FIX: Comparación numérica robusta para isRead (0 o "0" significa no leído)
  const unreadNotifs = useMemo(() => notifs.filter(n => Number(n.isRead) === 0), [notifs]);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSuggestions(false);
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifs = async () => {
    if (user) {
        try { 
            const res = await db.getNotifications(user.id); 
            setNotifs(res || []); 
        } catch(e) {}
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [vids, mkt, usersRes, sets] = await Promise.all([
                db.getAllVideos(), 
                db.getMarketplaceItems(),
                db.getAllUsers(),
                db.getSystemSettings()
            ]);
            
            setAllVideos(vids.filter(v => !['PENDING', 'PROCESSING', 'FAILED_METADATA'].includes(v.category)));
            setMarketItems(mkt);
            setAllUsers(usersRes);
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

  // --- Lógica de Búsqueda Mejorada ---

  const matchesFragmented = (target: string, query: string): boolean => {
      if (!target || !query) return false;
      const t = target.toLowerCase();
      const qWords = query.toLowerCase().split(' ').filter(w => w.length > 0);
      return qWords.every(word => t.includes(word));
  };

  const handleSearchChange = (val: string) => {
      setSearchQuery(val);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }

      searchTimeout.current = setTimeout(async () => {
          try {
              const res = await db.getSearchSuggestions(val);
              setSuggestions(res);
              setShowSuggestions(res.length > 0);
          } catch(e) {}
      }, 300);
  };

  const executeSearch = (term: string) => {
      setSearchQuery(term);
      setShowSuggestions(false);
      db.saveSearch(term);
  };

  const handleSuggestionClick = (s: any) => {
      executeSearch(s.label);
      if (s.type === 'VIDEO') navigate(`/watch/${s.id}`);
      else if (s.type === 'MARKET') navigate(`/marketplace/${s.id}`);
      else if (s.type === 'USER') navigate(`/channel/${s.id}`);
      else if (s.type === 'CATEGORY') {
          setActiveCategory(s.label);
          setSearchQuery('');
      }
  };

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      try {
          await db.markNotificationRead(id);
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

  // --- Lógica de Resultados Dinámicos ---

  const searchResults = useMemo((): UnifiedSearchResults | null => {
      const queryStr = String(searchQuery || '');
      if (!queryStr || queryStr.length < 2) return null;
      
      const filteredVideos = allVideos.filter(v => matchesFragmented(v.title + v.creatorName, queryStr));
      const filteredMkt = marketItems.filter(i => matchesFragmented(i.title + i.description, queryStr));
      const filteredUsers = allUsers.filter(u => matchesFragmented(u.username, queryStr));
      
      const matchedSubCats: {id: string, name: string, videos: Video[]}[] = [];
      
      categories.forEach(c => {
          if (matchesFragmented(c.name, queryStr)) {
              matchedSubCats.push({
                  id: c.id,
                  name: c.name,
                  videos: allVideos.filter(v => v.category === c.name || v.parent_category === c.name)
              });
          }
      });

      const physicalFolders = Array.from(new Set(allVideos.map(v => String(v.category)))) as string[];
      physicalFolders.forEach(folder => {
          if (matchesFragmented(folder, queryStr)) {
              if (!matchedSubCats.find(s => s.name === folder)) {
                  matchedSubCats.push({
                      id: folder,
                      name: folder,
                      videos: allVideos.filter(v => v.category === folder)
                  });
              }
          }
      });

      return {
          videos: filteredVideos,
          marketplace: filteredMkt,
          users: filteredUsers,
          subcategories: matchedSubCats
      };
  }, [searchQuery, allVideos, marketItems, allUsers, categories]);

  const breadcrumbPath = useMemo<string[]>(() => {
      if (!activeCategory) return [];
      const active = activeCategory as string;
      const currentVideoSample = allVideos.find(v => v.category === active);
      if (currentVideoSample && currentVideoSample.parent_category) return [currentVideoSample.parent_category as string, active];
      return [active];
  }, [activeCategory, allVideos]);

  const currentSubCategories = useMemo<{name: string, id: string, videos: Video[]}[]>(() => {
      const queryStr = String(searchQuery || '');
      const active = activeCategory as string | null;

      if (queryStr) return []; 
      if (!active) {
          return categories.map(c => ({ 
              name: c.name, 
              id: c.id, 
              videos: allVideos.filter(v => v.category === c.name || v.parent_category === c.name)
          })).filter(c => c.videos.length > 0);
      }
      
      const rootCat = categories.find(c => c.name === active);
      if (rootCat && rootCat.autoSub) {
          const subs = Array.from(new Set(
              allVideos
                .filter(v => v.parent_category === active)
                .map(v => v.category)
          )) as string[];

          return subs.map(s => ({
              name: s,
              id: s,
              videos: allVideos.filter(v => v.category === s && v.parent_category === active)
          }));
      }
      return [];
  }, [activeCategory, categories, allVideos, searchQuery]);

  const filteredList = useMemo(() => {
      if (searchQuery) return []; 
      let list = allVideos.filter(v => {
          if (!activeCategory) return true;
          return v.category === activeCategory || v.parent_category === activeCategory;
      });

      const currentCatSettings = categories.find(c => c.name === activeCategory || c.name === list[0]?.parent_category);
      const sortMode = currentCatSettings?.sortOrder || 'LATEST';

      if (sortMode === 'ALPHA') list.sort((a, b) => naturalCollator.compare(a.title, b.title));
      else if (sortMode === 'RANDOM') list.sort(() => (Math.random() - 0.5)); 
      else list.sort((a,b) => b.createdAt - a.createdAt);

      return list;
  }, [allVideos, activeCategory, categories, searchQuery]);

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-6">
      
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} isAdmin={isAdmin} logout={logout}/>

      {/* Search & Header Bar */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
          <div className="flex gap-3 mb-4 items-center w-full">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-400 active:scale-95 transition-transform">
                  <Menu size={20}/>
              </button>

              <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
                  <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                  <input 
                    type="text" value={searchQuery} 
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)}
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchQuery)}
                    placeholder="Buscar contenido..." 
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                  />
                  {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setSuggestions([]); }} className="absolute right-3 top-3 text-slate-500 hover:text-white">
                          <X size={16}/>
                      </button>
                  )}

                  {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top backdrop-blur-xl">
                          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                              {suggestions.map((s, i) => (
                                  <button 
                                      key={i} 
                                      onClick={() => handleSuggestionClick(s)}
                                      className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group"
                                  >
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                          s.type === 'HISTORY' ? 'bg-slate-800 text-slate-400' :
                                          s.type === 'VIDEO' ? 'bg-indigo-500/20 text-indigo-400' :
                                          s.type === 'MARKET' ? 'bg-emerald-500/20 text-emerald-400' :
                                          s.type === 'USER' ? 'bg-pink-500/20 text-pink-400' :
                                          'bg-amber-500/20 text-amber-400'
                                      }`}>
                                          {s.type === 'HISTORY' && <Clock size={16}/>}
                                          {s.type === 'VIDEO' && <Film size={16}/>}
                                          {s.type === 'MARKET' && <ShoppingBag size={16}/>}
                                          {s.type === 'USER' && <Users size={16}/>}
                                          {s.type === 'CATEGORY' && <Tag size={16}/>}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{s.label}</div>
                                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                              {s.type === 'HISTORY' ? 'Búsqueda Popular' : 
                                               s.type === 'VIDEO' ? 'En Videos' : 
                                               s.type === 'MARKET' ? 'En Tienda' : 
                                               s.type === 'USER' ? 'Canal / Usuario' : 'Colección / Categoría'}
                                          </div>
                                      </div>
                                      <ChevronRight size={14} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
                  {(unreadNotifs.length > 0 || showNotifMenu) && (
                      <button 
                          onClick={() => setShowNotifMenu(!showNotifMenu)}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center min-w-[46px] h-[46px] relative ${showNotifMenu ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                      >
                          <Bell size={22} className={unreadNotifs.length > 0 ? "animate-[ring_2s_infinite]" : ""} />
                          {unreadNotifs.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-lg">
                                  {unreadNotifs.length}
                              </span>
                          )}
                      </button>
                  )}

                  {showNotifMenu && (
                      <div className="fixed sm:absolute top-[75px] sm:top-full right-4 sm:right-0 w-[calc(100vw-32px)] sm:w-80 max-h-[75vh] sm:max-h-[480px] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top-right z-[200]">
                          <div className="p-4 bg-slate-950 border-b border-white/5 flex justify-between items-center sticky top-0 z-10">
                              <div className="flex items-center gap-2">
                                  <Zap size={14} className="text-amber-400 fill-amber-400"/>
                                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Novedades</h3>
                              </div>
                              <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10">
                                  <Check size={12}/> Marcar todo
                              </button>
                          </div>

                          <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar bg-slate-900">
                              {notifs.length === 0 ? (
                                  <div className="py-20 text-center text-slate-600 italic text-xs uppercase font-bold tracking-widest">Sin notificaciones</div>
                              ) : notifs.map(n => (
                                  <div 
                                      key={n.id}
                                      className={`p-4 border-b border-white/5 transition-all cursor-pointer group flex gap-3 items-start relative ${Number(n.isRead) === 0 ? 'bg-indigo-500/[0.04]' : 'opacity-60 grayscale'}`}
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
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          </div>
          <Breadcrumbs path={breadcrumbPath} onNavigate={setActiveCategory} />
      </div>

      {/* --- RENDERIZADO DE RESULTADOS --- */}
      {searchQuery && searchResults ? (
          <div className="space-y-12 animate-in fade-in duration-500">
              
              {searchResults.users && searchResults.users.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-l-2 border-pink-500 pl-3">Canales y Usuarios</h3>
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {searchResults.users.map(u => (
                              <Link key={u.id} to={`/channel/${u.id}`} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center gap-4 shrink-0 hover:bg-slate-800 transition-all shadow-lg min-w-[240px]">
                                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-indigo-500/30">
                                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-indigo-600">{u.username[0]}</div>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-black text-white text-sm truncate">@{u.username}</div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Ver Perfil</div>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-700"/>
                              </Link>
                          ))}
                      </div>
                  </div>
              )}

              {searchResults.subcategories && searchResults.subcategories.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-l-2 border-amber-500 pl-3">Colecciones y Carpetas</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {searchResults.subcategories.map(sub => (
                              <SubCategoryCard key={sub.id} name={sub.name} videos={sub.videos} onClick={() => { setActiveCategory(sub.name); setSearchQuery(''); }} />
                          ))}
                      </div>
                  </div>
              )}

              {searchResults.videos && searchResults.videos.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-l-2 border-indigo-500 pl-3">Videos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
                          {searchResults.videos.map(v => (
                              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
                          ))}
                      </div>
                  </div>
              )}

              {searchResults.marketplace && searchResults.marketplace.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-l-2 border-emerald-500 pl-3">Artículos de la Tienda</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {searchResults.marketplace.map(item => (
                              <Link key={item.id} to={`/marketplace/${item.id}`} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all flex flex-col shadow-lg">
                                  <div className="aspect-[3/4] overflow-hidden relative bg-black">
                                      {item.images?.[0] ? <img src={item.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/> : <div className="w-full h-full flex items-center justify-center text-slate-800"><ShoppingBag size={32}/></div>}
                                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 border border-emerald-500/30">{item.price} $</div>
                                  </div>
                                  <div className="p-3 flex-1 flex flex-col">
                                      <h4 className="text-[11px] font-black text-white line-clamp-2 uppercase leading-tight mb-1">{item.title}</h4>
                                      <div className="mt-auto flex items-center gap-1">
                                          <Star size={10} className="text-amber-500" fill="currentColor"/>
                                          <span className="text-[9px] font-bold text-slate-500">{(item.rating || 0).toFixed(1)}</span>
                                      </div>
                                  </div>
                              </Link>
                          ))}
                      </div>
                  </div>
              )}

              {searchResults && searchResults.videos.length === 0 && searchResults.marketplace.length === 0 && searchResults.users.length === 0 && searchResults.subcategories.length === 0 && (
                  <div className="text-center py-40">
                      <Shuffle className="mx-auto mb-4 text-slate-800" size={64}/>
                      <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No hay coincidencias para "{searchQuery}"</p>
                  </div>
              )}
          </div>
      ) : (
          /* --- MODO EXPLORACIÓN --- */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
              {currentSubCategories.map(sub => (
                  <SubCategoryCard key={sub.id} name={sub.name} videos={sub.videos} onClick={() => setActiveCategory(sub.name)} />
              ))}

              {filteredList.slice(0, visibleCount).map((v: Video) => (
                  <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
              ))}
          </div>
      )}

      {!searchQuery && filteredList.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl">
                  Cargar más contenido
              </button>
          </div>
      )}

      <AIConcierge videos={allVideos} isVisible={isAiConfigured} />
      
      <style>{`
        @keyframes ring {
            0% { transform: rotate(0); }
            10% { transform: rotate(20deg); }
            20% { transform: rotate(-18deg); }
            30% { transform: rotate(16deg); }
            40% { transform: rotate(-14deg); }
            100% { transform: rotate(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}
