
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification, MarketplaceItem, User } from '../../types';
import { 
    // Added Server to imports
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Folder, Bell, Check, Zap, Clock, Film, ShoppingBag, Tag, Users, Star, Menu, Crown, User as UserIcon, LogOut, ShieldCheck, Database, Sparkles, Server
} from 'lucide-react';
import { useLocation, useNavigate, Link } from '../Router';
import AIConcierge from '../AIConcierge';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// --- Componentes Auxiliares ---

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (cat: string | null) => void }) => (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3 mb-6 animate-in slide-in-from-left duration-500 sticky top-0 z-20 bg-black/40 backdrop-blur-md -mx-4 px-4">
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
                    onClick={() => onNavigate(cat)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${i === path.length - 1 ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-500 border-white/5 hover:text-white'}`}
                >
                    {cat}
                </button>
            </React.Fragment>
        ))}
    </div>
);

// Fix: Use React.FC to handle potential key prop conflicts in strict environments
const SubCategoryCard: React.FC<{ name: string, videos: Video[], onClick: () => void }> = ({ name, videos, onClick }) => {
    const randomThumb = useMemo(() => {
        if (!videos || videos.length === 0) return null;
        return videos[Math.floor(Math.random() * videos.length)]?.thumbnailUrl;
    }, [videos]);

    return (
        <button 
            onClick={onClick}
            className="group relative aspect-[2/1] rounded-[32px] overflow-hidden bg-slate-900 border border-white/5 hover:border-indigo-500/30 transition-all hover:scale-[1.02] shadow-2xl active:scale-95"
        >
            {randomThumb ? (
                <img src={randomThumb} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-all duration-700" alt="" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 border border-indigo-500/20">
                    <Folder size={24} className="group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-tight line-clamp-1">{name}</h3>
                <div className="mt-2 bg-black/40 px-3 py-1 rounded-full border border-white/5 text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                    {videos.length} Archivos
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
    subcategories: { id: string, name: string, videos: Video[] }[];
}

export default function Home() {
  const { user } = useAuth();
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

  // Search Logic
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
            
            setAllVideos(vids || []);
            setMarketItems(mkt || []);
            setAllUsers(usersRes || []);
            setCategories(sets?.categories || []);
            
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act?.watched || []);
            }
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user?.id]);

  // Lógica de Búsqueda Unificada
  const searchResults = useMemo((): UnifiedSearchResults | null => {
      const q = searchQuery.toLowerCase().trim();
      if (q.length < 2) return null;
      
      // Fix: Ensure strings are properly typed for mapping subcategories
      return {
          videos: allVideos.filter(v => v.title.toLowerCase().includes(q)),
          marketplace: marketItems.filter(i => i.title.toLowerCase().includes(q)),
          users: allUsers.filter(u => u.username.toLowerCase().includes(q)),
          subcategories: Array.from(new Set(allVideos.filter(v => v.category.toLowerCase().includes(q)).map(v => v.category as string)))
              .map((name: string) => ({ id: name, name, videos: allVideos.filter(v => v.category === name) }))
      };
  }, [searchQuery, allVideos, marketItems, allUsers]);

  // Lógica Jerárquica: Carpetas y Archivos del nivel actual
  const { currentSubCategories, levelVideos, breadcrumbPath } = useMemo(() => {
    if (searchQuery) return { currentSubCategories: [], levelVideos: [], breadcrumbPath: [] };

    // Videos en el nivel actual
    const levelVids = allVideos.filter(v => (v.parent_category || null) === activeCategory);
    
    // Carpetas del nivel actual (Subcategorías)
    const uniqueFolders = Array.from(new Set(levelVids.map(v => v.category as string)));
    // Fix: Explicitly type as string[] and add explicit typing to mapping
    const subCats = (uniqueFolders as string[])
        .filter(name => name !== activeCategory)
        .map((name: string) => ({
            name,
            id: name,
            videos: allVideos.filter(v => v.category === name || v.parent_category === name)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Solo videos que pertenecen a este nivel y NO a una subcarpeta
    const filteredVids = levelVids.filter(v => v.category === activeCategory || (!activeCategory && !v.parent_category));

    return { 
        currentSubCategories: subCats, 
        levelVideos: filteredVids,
        breadcrumbPath: activeCategory ? [activeCategory] : [] 
    };
  }, [activeCategory, allVideos, searchQuery]);

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
      <div className="relative group" ref={searchContainerRef}>
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input 
            type="text" value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, canal o producto..." 
            className="w-full bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl pl-14 pr-12 py-5 text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-xl placeholder:text-slate-600 font-bold" 
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white bg-slate-800 p-1.5 rounded-full"><X size={16}/></button>
          )}
      </div>

      {!searchQuery && <Breadcrumbs path={breadcrumbPath} onNavigate={setActiveCategory} />}

      {/* --- RENDER RESULTADOS BÚSQUEDA --- */}
      {searchQuery && searchResults && (
          <div className="space-y-10 animate-in fade-in duration-500">
              {searchResults.users.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-l-2 border-pink-500 pl-3">Canales</h3>
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {searchResults.users.map(u => (
                              <Link key={u.id} to={`/channel/${u.id}`} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center gap-4 shrink-0 hover:border-indigo-500/30 min-w-[200px]">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800">
                                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt={u.username}/> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-indigo-600">{u.username?.[0]}</div>}
                                  </div>
                                  <span className="font-black text-white text-xs truncate">@{u.username}</span>
                              </Link>
                          ))}
                      </div>
                  </div>
              )}

              {searchResults.subcategories.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-l-2 border-amber-500 pl-3">Colecciones</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {searchResults.subcategories.map(sub => (
                              <SubCategoryCard key={sub.id} name={sub.name} videos={sub.videos} onClick={() => { setActiveCategory(sub.name); setSearchQuery(''); }} />
                          ))}
                      </div>
                  </div>
              )}

              {searchResults.videos.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-l-2 border-indigo-500 pl-3">Videos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
                          {searchResults.videos.map(v => (
                              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} />
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- MODO EXPLORACIÓN POR CARPETAS --- */}
      {!searchQuery && (
          <div className="space-y-10">
              {currentSubCategories.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {currentSubCategories.map(sub => (
                          <SubCategoryCard key={sub.id} name={sub.name} videos={sub.videos} onClick={() => setActiveCategory(sub.name)} />
                      ))}
                  </div>
              )}

              {levelVideos.length > 0 && (
                  <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                          <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                          <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Contenido</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
                          {levelVideos.slice(0, visibleCount).map((v: Video) => (
                              <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
                          ))}
                      </div>
                  </div>
              )}

              {levelVideos.length === 0 && currentSubCategories.length === 0 && (
                  <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-700">
                      <div className="w-28 h-28 bg-slate-900 rounded-[40px] flex items-center justify-center border border-white/5 shadow-2xl relative">
                        <Database size={48} className="text-slate-800" />
                        <Sparkles size={24} className="absolute -top-2 -right-2 text-indigo-500 animate-pulse" />
                      </div>
                      <div className="space-y-2">
                          <p className="text-slate-500 italic uppercase text-[10px] font-black tracking-[0.5em]">Directorio Vacío</p>
                          {isAdmin && (
                              <div className="pt-6">
                                <Link to="/admin" className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                                    <Server size={14}/> Iniciar Escaneo NAS
                                </Link>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
      )}

      {!searchQuery && levelVideos.length > visibleCount && (
          <div className="py-10 flex justify-center">
              <button onClick={() => setVisibleCount(p => p + 12)} className="px-10 py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 active:scale-95 transition-all shadow-xl">
                  Cargar más contenido
              </button>
          </div>
      )}

      <AIConcierge videos={allVideos} isVisible={true} />
    </div>
  );
}
