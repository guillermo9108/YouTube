
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, Category, Notification as AppNotification } from '../../types';
import { 
    RefreshCw, Search, X, ChevronRight, Home as HomeIcon, Layers, Shuffle, Folder, Bell, Check, CheckCheck, Zap, MessageSquare, Clock, Film, ShoppingBag, Tag
} from 'lucide-react';
import { useLocation, useNavigate } from '../Router';
import AIConcierge from '../AIConcierge';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

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

  // Search Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);

  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  const unreadNotifs = useMemo(() => notifs.filter(n => Number(n.isRead) === 0), [notifs]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
            setShowSuggestions(false);
        }
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setShowNotifMenu(false);
        }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (val: string) => {
      setSearchQuery(val);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      
      if (val.length < 2) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
      }

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
      else if (s.type === 'CATEGORY') setActiveCategory(s.label);
  };

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
      if (sortMode === 'ALPHA') list.sort((a, b) => naturalCollator.compare(a.title, b.title));
      else if (sortMode === 'RANDOM') list.sort(() => (Math.random() - 0.5)); 
      else list.sort((a,b) => b.createdAt - a.createdAt);
      return list;
  }, [allVideos, activeCategory, searchQuery, categories]);

  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div className="pb-20 space-y-8 px-2 md:px-0">
      
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-0 border-b border-white/5">
          <div className="flex gap-3 mb-4 items-center w-full">
              <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
                  <Search className="absolute left-4 top-3 text-slate-500" size={18} />
                  <input 
                    type="text" value={searchQuery} 
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)}
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchQuery)}
                    placeholder="Busca videos, categorías o artículos..." 
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all shadow-inner" 
                  />
                  {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setSuggestions([]); }} className="absolute right-3 top-3 text-slate-500 hover:text-white">
                          <X size={16}/>
                      </button>
                  )}

                  {/* Sugerencias Inteligentes Dropdown */}
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
                                          'bg-amber-500/20 text-amber-400'
                                      }`}>
                                          {s.type === 'HISTORY' && <Clock size={16}/>}
                                          {s.type === 'VIDEO' && <Film size={16}/>}
                                          {s.type === 'MARKET' && <ShoppingBag size={16}/>}
                                          {s.type === 'CATEGORY' && <Tag size={16}/>}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{s.label}</div>
                                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                              {s.type === 'HISTORY' ? 'Búsqueda Popular' : 
                                               s.type === 'VIDEO' ? 'En Videos' : 
                                               s.type === 'MARKET' ? 'En Marketplace' : 'Categoría'}
                                          </div>
                                      </div>
                                      <ChevronRight size={14} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

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
                </div>
              )}
          </div>
          
          <Breadcrumbs path={useMemo(() => {
              if (!activeCategory) return [];
              const currentVideoSample = allVideos.find(v => v.category === activeCategory);
              if (currentVideoSample && currentVideoSample.parent_category) return [currentVideoSample.parent_category, activeCategory];
              return [activeCategory];
          }, [activeCategory, allVideos])} onNavigate={setActiveCategory} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 animate-in fade-in duration-500">
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

      <AIConcierge videos={allVideos} isVisible={isAiConfigured} />
    </div>
  );
}
