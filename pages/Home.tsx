
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Compass, RefreshCw, Search, X, Filter, Menu, Home as HomeIcon, Smartphone, Upload, User, LogOut, DownloadCloud, Clock, Trash2, ShieldCheck, ShoppingBag, Play } from 'lucide-react';
import { db } from '../services/db';
import { Video, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link } from '../components/Router';
import VideoCard from '../components/VideoCard';

const INITIAL_CATEGORIES = [
    { id: 'ALL', label: 'Todo' },
    { id: 'SUBSCRIPTIONS', label: 'Suscripciones' },
    { id: VideoCategory.SHORTS, label: 'Shorts' },
    { id: VideoCategory.MUSIC, label: 'Música' },
    { id: VideoCategory.SHORT_FILM, label: 'Cortometrajes' },
    { id: VideoCategory.SERIES, label: 'Series' },
    { id: VideoCategory.NOVELAS, label: 'Novelas' },
    { id: VideoCategory.MOVIE, label: 'Películas' },
    { id: VideoCategory.EDUCATION, label: 'Educación' },
    { id: VideoCategory.OTHER, label: 'Otros' },
];

const ITEMS_PER_PAGE = 12;

// --- GLOBAL STATE SNAPSHOT (Lives outside component lifecycle) ---
interface HomeSnapshot {
    videos: Video[];
    shuffledList: Video[];
    processedList: Video[];
    shortsShelf: Video[];
    activeCategory: string;
    searchQuery: string;
    visibleCount: number;
    // Changed from single number to Map of Category -> ScrollY
    scrollPositions: Record<string, number>;
    purchases: Set<string>;
    checkedPurchaseIds: Set<string>;
    categories: { id: string, label: string }[];
}

let homeSnapshot: HomeSnapshot | null = null;

const ShortsShelf = ({ videos }: { videos: Video[] }) => {
    if (videos.length === 0) return null;
    return (
        <div className="col-span-full py-2 mb-6">
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="p-1 bg-red-600 rounded text-white">
                    <Smartphone size={16} strokeWidth={3} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Shorts</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0">
                {videos.map(v => (
                    <Link to={`/shorts?id=${v.id}`} key={v.id} className="relative w-36 md:w-40 aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden shrink-0 snap-start group border border-slate-800 hover:border-slate-600 transition-all hover:scale-[1.02] shadow-lg">
                        <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90"></div>
                        
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="bg-black/40 backdrop-blur-md p-1 rounded-full text-white">
                                 <Play size={12} fill="white" />
                             </div>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3">
                             <h3 className="text-white text-sm font-bold line-clamp-2 leading-tight mb-1 drop-shadow-sm">{v.title}</h3>
                             <p className="text-[10px] text-slate-300 font-medium">{v.views} vistas</p>
                        </div>
                    </Link>
                ))}
            </div>
            <div className="h-px bg-slate-800/50 w-full mt-2"></div>
        </div>
    );
};

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [shuffledMasterList, setShuffledMasterList] = useState<Video[]>([]);
  const [shortsShelf, setShortsShelf] = useState<Video[]>([]);
  
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [checkedPurchaseIds, setCheckedPurchaseIds] = useState<Set<string>>(new Set());
  
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [subscribedCreators, setSubscribedCreators] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const { user, logout } = useAuth();
  
  const [categoryList, setCategoryList] = useState(INITIAL_CATEGORIES);
  const [processedList, setProcessedList] = useState<Video[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  // Ref to track scroll positions per category
  const scrollPositionsRef = useRef<Record<string, number>>({});
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const stateRef = useRef({
      videos, shuffledMasterList, processedList, shortsShelf, activeCategory, searchQuery, visibleCount, purchases, checkedPurchaseIds, categoryList
  });

  useEffect(() => {
      stateRef.current = {
          videos, shuffledMasterList, processedList, shortsShelf, activeCategory, searchQuery, visibleCount, purchases, checkedPurchaseIds, categoryList
      };
  }, [videos, shuffledMasterList, processedList, shortsShelf, activeCategory, searchQuery, visibleCount, purchases, checkedPurchaseIds, categoryList]);

  // Debounce logic
  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearch(searchQuery);
      }, 300);
      return () => clearTimeout(handler);
  }, [searchQuery]);

  // --- INIT & SNAPSHOT RESTORATION ---
  useEffect(() => {
    const init = async () => {
        try {
            const settings = await db.getSystemSettings();
            if (settings.customCategories) {
                const custom = settings.customCategories.map(c => ({ id: c, label: c.replace('_', ' ') }));
                setCategoryList(prev => {
                    const base = [...INITIAL_CATEGORIES];
                    custom.forEach(c => {
                        if (!base.find(b => b.id === c.id)) base.push(c);
                    });
                    return base;
                });
            }
        } catch (e) {}

        try {
            const saved = localStorage.getItem('sp_recent_searches');
            if (saved) setRecentSearches(JSON.parse(saved));
        } catch(e) {}

        const isDirty = localStorage.getItem('sp_home_dirty') === 'true';

        if (!isDirty && homeSnapshot) {
            setVideos(homeSnapshot.videos);
            setShuffledMasterList(homeSnapshot.shuffledList);
            setShortsShelf(homeSnapshot.shortsShelf || []);
            setActiveCategory(homeSnapshot.activeCategory);
            setSearchQuery(homeSnapshot.searchQuery);
            setDebouncedSearch(homeSnapshot.searchQuery); 
            setProcessedList(homeSnapshot.processedList);
            setVisibleCount(homeSnapshot.visibleCount);
            setPurchases(homeSnapshot.purchases);
            setCheckedPurchaseIds(homeSnapshot.checkedPurchaseIds);
            // Restore scroll map
            scrollPositionsRef.current = homeSnapshot.scrollPositions || {};
            
            if(homeSnapshot.categories.length > INITIAL_CATEGORIES.length) setCategoryList(homeSnapshot.categories);
            setLoading(false);
            
            if (user) {
                db.getUserActivity(user.id).then(act => setWatchedIds(act.watched || []));
            }
            return;
        }

        setLoading(true);
        if (isDirty) localStorage.removeItem('sp_home_dirty'); 
        
        try {
            const allVideos = await db.getAllVideos();
            setVideos(allVideos);
            
            const shuffled = [...allVideos].sort(() => Math.random() - 0.5);
            setShuffledMasterList(shuffled);
            
            // Generate Shorts Shelf (only shorts, max 15)
            const shelf = shuffled.filter(v => v.category === VideoCategory.SHORTS || Number(v.duration) < 120).slice(0, 15);
            setShortsShelf(shelf);
            
            if (user) {
                const activity = await db.getUserActivity(user.id);
                setWatchedIds(activity.watched || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    init();

    return () => {
        // Save Snapshot on Unmount
        const s = stateRef.current;
        if (s.videos.length > 0) {
            // Save current category scroll before unmounting
            scrollPositionsRef.current[s.activeCategory] = window.scrollY;
            
            homeSnapshot = {
                videos: s.videos,
                shuffledList: s.shuffledMasterList,
                processedList: s.processedList,
                shortsShelf: s.shortsShelf,
                activeCategory: s.activeCategory,
                searchQuery: s.searchQuery,
                visibleCount: s.visibleCount,
                scrollPositions: scrollPositionsRef.current,
                purchases: s.purchases,
                checkedPurchaseIds: s.checkedPurchaseIds,
                categories: s.categoryList
            };
        }
    };
  }, [user]);

  // --- SCROLL RESTORATION LOGIC ---
  useLayoutEffect(() => {
      if (!loading) {
          const savedScroll = scrollPositionsRef.current[activeCategory] || 0;
          window.scrollTo(0, savedScroll);
      }
  }, [loading, activeCategory]);

  const changeCategory = (newCat: string) => {
      // Save current scroll before switching
      scrollPositionsRef.current[activeCategory] = window.scrollY;
      
      setActiveCategory(newCat);
      setShowSidebar(false);
      // restoration happens in useLayoutEffect when activeCategory changes
  };

  useEffect(() => {
      if (user && activeCategory === 'SUBSCRIPTIONS') {
          db.getSubscriptions(user.id).then(setSubscribedCreators);
      }
  }, [user, activeCategory]);

  const addToHistory = (term: string) => {
      if (!term.trim()) return;
      const val = term.trim();
      setRecentSearches(prev => {
          const newArr = [val, ...prev.filter(t => t !== val)].slice(0, 8);
          localStorage.setItem('sp_recent_searches', JSON.stringify(newArr));
          return newArr;
      });
  };

  const removeHistory = (e: React.MouseEvent, term: string) => {
      e.stopPropagation();
      setRecentSearches(prev => {
          const newArr = prev.filter(t => t !== term);
          localStorage.setItem('sp_recent_searches', JSON.stringify(newArr));
          return newArr;
      });
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
              setShowRecent(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      if (shuffledMasterList.length === 0) return;
      
      let filtered = shuffledMasterList;
      
      if (activeCategory === 'SUBSCRIPTIONS') {
          filtered = shuffledMasterList.filter(v => subscribedCreators.includes(v.creatorId));
      } else if (activeCategory !== 'ALL') {
          filtered = shuffledMasterList.filter(v => v.category === activeCategory);
      }

      if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase();
          filtered = filtered.filter(v => 
              v.title.toLowerCase().includes(q) || 
              v.description.toLowerCase().includes(q) || 
              v.creatorName.toLowerCase().includes(q)
          );
      }
      
      setProcessedList(filtered);
      
      // If we are restoring from snapshot, don't reset visible count
      if (!loading && homeSnapshot && activeCategory === homeSnapshot.activeCategory) {
          // Keep snapshot visible count if we just restored
      } else if (!loading) {
          // Reset count if we changed category manually
          setVisibleCount(ITEMS_PER_PAGE);
      }

  }, [shuffledMasterList, activeCategory, debouncedSearch, subscribedCreators, loading]);

  useEffect(() => {
      if (loading) return;
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              setVisibleCount(prev => prev + ITEMS_PER_PAGE);
          }
      }, { 
          rootMargin: '1500px' 
      });

      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [processedList, loading]);

  const displayList = processedList.slice(0, visibleCount);

  // OPTIMIZED PURCHASE CHECKER
  useEffect(() => {
      if (!user || displayList.length === 0) return;

      const fetchVisiblePurchases = async () => {
          const toCheck = displayList.filter(v => 
              Number(v.price) > 0 && 
              v.creatorId !== user.id && 
              !purchases.has(v.id) && 
              !checkedPurchaseIds.has(v.id) 
          );

          if (toCheck.length === 0) return;

          const BATCH_SIZE = 6; 
          
          for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
               const batch = toCheck.slice(i, i + BATCH_SIZE);
               const newPurchasedIds: string[] = [];
               const newCheckedIds: string[] = [];

               await Promise.all(batch.map(async (v) => {
                   newCheckedIds.push(v.id); 
                   try {
                       const has = await db.hasPurchased(user.id, v.id);
                       if (has) newPurchasedIds.push(v.id);
                   } catch (e) { console.warn("Purchase check failed", e); }
               }));

               if (newCheckedIds.length > 0) {
                   setCheckedPurchaseIds(prev => {
                       const next = new Set(prev);
                       newCheckedIds.forEach(id => next.add(id));
                       return next;
                   });
               }

               if (newPurchasedIds.length > 0) {
                   setPurchases(prev => {
                       const next = new Set(prev);
                       newPurchasedIds.forEach(id => next.add(id));
                       return next;
                   });
               }
          }
      };

      fetchVisiblePurchases();
  }, [displayList, user, purchases, checkedPurchaseIds]); 

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.has(videoId) || (user?.id === creatorId);
  };

  const handleManualRefresh = () => {
      homeSnapshot = null;
      window.location.reload();
  };

  const filteredRecent = recentSearches.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  // Show shelf if: Category is ALL, No Search Query, and we have Shorts
  const shouldShowShelf = activeCategory === 'ALL' && !searchQuery && shortsShelf.length > 0;

  return (
    <div className="min-h-screen" ref={containerRef}>
      {/* Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSidebar(false)}></div>
            <div className="relative w-64 bg-slate-900 border-r border-slate-800 h-full p-4 flex flex-col animate-in slide-in-from-left duration-200">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-slate-800 rounded-full"><Menu size={24} /></button>
                    <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">StreamPay</span>
                </div>
                
                <div className="space-y-1 flex-1">
                    {user?.role === 'ADMIN' && (
                        <Link to="/admin" className="flex items-center gap-4 px-4 py-3 text-amber-400 bg-amber-900/10 hover:bg-amber-900/20 rounded-lg font-medium mb-4 border border-amber-500/20">
                            <ShieldCheck size={20}/> Panel Admin
                        </Link>
                    )}
                    <Link to="/" className="flex items-center gap-4 px-4 py-3 text-white bg-slate-800 rounded-lg font-medium">
                        <HomeIcon size={20}/> Inicio
                    </Link>
                    <Link to="/shorts" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Smartphone size={20}/> Shorts
                    </Link>
                    <Link to="/marketplace" className="flex items-center gap-4 px-4 py-3 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-900/20 rounded-lg font-medium">
                        <ShoppingBag size={20}/> Tienda
                    </Link>
                    <button onClick={() => changeCategory('SUBSCRIPTIONS')} className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium text-left">
                        <Compass size={20}/> Suscripciones
                    </button>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <Link to="/requests" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <DownloadCloud size={20}/> Peticiones
                    </Link>
                    <Link to="/upload" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Upload size={20}/> Subir
                    </Link>
                    <Link to="/profile" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <User size={20}/> Perfil
                    </Link>
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button onClick={logout} className="flex items-center gap-4 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-lg font-medium w-full text-left">
                        <LogOut size={20}/> Salir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-slate-800/50 pb-2 pt-2 transition-all">
         <div className="px-4 md:px-6 mb-2 flex items-center gap-4">
            <button onClick={() => setShowSidebar(true)} className="md:hidden text-white p-2 hover:bg-slate-800 rounded-full">
                <Menu size={24} />
            </button>
            <div className="relative group flex-1 max-w-2xl mx-auto" ref={searchWrapperRef}>
                <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowRecent(true); }}
                    onFocus={() => setShowRecent(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addToHistory(searchQuery);
                            setShowRecent(false);
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    placeholder="Buscar videos, creadores..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 transition-all text-sm relative z-20"
                />
                
                {searchQuery ? (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white z-20"><X size={18} /></button>
                ) : (
                    <button onClick={handleManualRefresh} className="absolute right-3 top-2.5 text-slate-500 hover:text-white z-20" title="Refrescar"><RefreshCw size={14} /></button>
                )}

                {showRecent && filteredRecent.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 mt-2 overflow-hidden animate-in fade-in zoom-in-95 origin-top">
                        {filteredRecent.map(term => (
                            <div key={term} onClick={() => { setSearchQuery(term); addToHistory(term); setShowRecent(false); }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/80 cursor-pointer group/item transition-colors border-b border-slate-800/50 last:border-0">
                                <div className="flex items-center gap-3 text-slate-300">
                                    <Clock size={16} className="text-slate-500" />
                                    <span className="text-sm font-medium">{term}</span>
                                </div>
                                <button onClick={(e) => removeHistory(e, term)} className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-slate-700/50 rounded-full transition-all opacity-0 group-hover/item:opacity-100"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>

         <div className="flex items-center gap-2 overflow-x-auto px-4 md:px-6 scrollbar-hide pb-2">
            <div className="hidden md:flex bg-slate-800/50 p-1.5 rounded-lg text-slate-400 shrink-0"><Compass size={18} /></div>
            <div className="hidden md:block h-6 w-px bg-slate-800 mx-1 shrink-0"></div>
            {categoryList.map(cat => (
                <button key={cat.id} onClick={() => changeCategory(cat.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeTabClass(activeCategory, cat.id)}`}>
                    {cat.label}
                </button>
            ))}
         </div>
      </div>

      <div className="px-0 md:px-6 pb-20 pt-2">
         {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                 <RefreshCw className="animate-spin mb-4" size={32} />
                 <p>Preparando tu feed...</p>
             </div>
         ) : displayList.length === 0 ? (
             <div className="text-center py-20 text-slate-500">
                 {searchQuery ? (
                     <>
                        <Filter className="mx-auto mb-4 opacity-50" size={48} />
                        <p className="text-lg font-bold text-white mb-2">No se encontraron resultados</p>
                        <p className="text-sm">Prueba con otras palabras para "{searchQuery}"</p>
                     </>
                 ) : (
                     <>
                        <p className="text-lg font-bold text-white mb-2">No hay videos aquí</p>
                        <p className="text-sm">{activeCategory === 'SUBSCRIPTIONS' ? "Aún no te has suscrito a nadie." : "No se encontraron videos en esta categoría."}</p>
                     </>
                 )}
             </div>
         ) : (
            <>
             {/* Shorts Shelf injected at the top */}
             {shouldShowShelf && <ShortsShelf videos={shortsShelf} />}

             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-8 gap-x-4">
                {displayList.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    isUnlocked={isUnlocked(video.id, video.creatorId)}
                    isWatched={watchedIds.includes(video.id)}
                  />
                ))}
             </div>
             {visibleCount < processedList.length && (
                <div ref={loadMoreRef} className="py-24 flex justify-center">
                    <RefreshCw className="animate-spin text-slate-600" />
                </div>
             )}
            </>
         )}
      </div>
    </div>
  );
}

function activeTabClass(current: string, target: string) {
    if (current === target) return 'bg-white text-black border-white';
    return 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700';
}
