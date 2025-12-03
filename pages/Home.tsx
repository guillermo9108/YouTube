


import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Compass, RefreshCw, Search, X, Filter, Menu, Home as HomeIcon, Smartphone, Upload, User, LogOut, DownloadCloud, Clock, Trash2, ShieldCheck, ShoppingBag } from 'lucide-react';
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
// This acts as a "Keep-Alive" cache for the Home view
interface HomeSnapshot {
    videos: Video[];
    shuffledList: Video[];
    processedList: Video[];
    activeCategory: string;
    searchQuery: string;
    visibleCount: number;
    scrollPosition: number;
    purchases: Set<string>;
    categories: { id: string, label: string }[];
}

let homeSnapshot: HomeSnapshot | null = null;

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  // Use a shuffled copy of videos to maintain stability during filtering
  const [shuffledMasterList, setShuffledMasterList] = useState<Video[]>([]);
  
  // Store purchases as a Set for O(1) lookup performance
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [subscribedCreators, setSubscribedCreators] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const { user, logout } = useAuth();
  
  // Dynamic Category List
  const [categoryList, setCategoryList] = useState(INITIAL_CATEGORIES);

  // Full Processed List (Filtered)
  const [processedList, setProcessedList] = useState<Video[]>([]);
  // Visible Chunk
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Recent Search State
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // State Ref to hold latest values for unmount saving (Prevents stale closures)
  const stateRef = useRef({
      videos, shuffledMasterList, processedList, activeCategory, searchQuery, visibleCount, purchases, categoryList
  });

  // Always keep ref updated
  useEffect(() => {
      stateRef.current = {
          videos, shuffledMasterList, processedList, activeCategory, searchQuery, visibleCount, purchases, categoryList
      };
  }, [videos, shuffledMasterList, processedList, activeCategory, searchQuery, visibleCount, purchases, categoryList]);

  // --- INIT & SNAPSHOT RESTORATION ---
  useEffect(() => {
    const init = async () => {
        // Fetch System Settings to get Custom Categories
        try {
            const settings = await db.getSystemSettings();
            if (settings.customCategories) {
                const custom = settings.customCategories.map(c => ({ id: c, label: c.replace('_', ' ') }));
                // Merge with initial, avoiding duplicates if any
                setCategoryList(prev => {
                    // Start with initial
                    const base = [...INITIAL_CATEGORIES];
                    // Append custom
                    custom.forEach(c => {
                        if (!base.find(b => b.id === c.id)) base.push(c);
                    });
                    return base;
                });
            }
        } catch (e) {}

        // Load recent searches
        try {
            const saved = localStorage.getItem('sp_recent_searches');
            if (saved) setRecentSearches(JSON.parse(saved));
        } catch(e) {}

        // Check for "Dirty" flag (New upload happened?)
        const isDirty = localStorage.getItem('sp_home_dirty') === 'true';

        // 1. Try to restore from Snapshot if clean
        if (!isDirty && homeSnapshot) {
            // console.log("Restoring Home from Snapshot");
            setVideos(homeSnapshot.videos);
            setShuffledMasterList(homeSnapshot.shuffledList);
            setActiveCategory(homeSnapshot.activeCategory);
            setSearchQuery(homeSnapshot.searchQuery);
            setProcessedList(homeSnapshot.processedList);
            setVisibleCount(homeSnapshot.visibleCount);
            setPurchases(homeSnapshot.purchases);
            if(homeSnapshot.categories.length > INITIAL_CATEGORIES.length) setCategoryList(homeSnapshot.categories);
            setLoading(false);
            
            // Background update for watched status (cheap)
            if (user) {
                db.getUserActivity(user.id).then(act => setWatchedIds(act.watched || []));
            }
            return;
        }

        // 2. Fresh Load (If dirty or no snapshot)
        setLoading(true);
        if (isDirty) localStorage.removeItem('sp_home_dirty'); // Clear flag
        
        try {
            // Use aggressive caching here handled by db.ts
            const allVideos = await db.getAllVideos();
            setVideos(allVideos);
            
            // Generate shuffle ONCE when data loads
            const shuffled = [...allVideos].sort(() => Math.random() - 0.5);
            setShuffledMasterList(shuffled);
            
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

    // SNAPSHOT SAVE on Unmount ONLY
    return () => {
        const s = stateRef.current;
        if (s.videos.length > 0) {
            homeSnapshot = {
                videos: s.videos,
                shuffledList: s.shuffledMasterList,
                processedList: s.processedList,
                activeCategory: s.activeCategory,
                searchQuery: s.searchQuery,
                visibleCount: s.visibleCount,
                scrollPosition: window.scrollY,
                purchases: s.purchases,
                categories: s.categoryList
            };
        }
    };
  }, [user]);

  // RESTORE SCROLL POSITION
  useLayoutEffect(() => {
      if (!loading && homeSnapshot && homeSnapshot.scrollPosition > 0) {
          window.scrollTo(0, homeSnapshot.scrollPosition);
      }
  }, [loading]);

  // Fetch subscriptions
  useEffect(() => {
      if (user && activeCategory === 'SUBSCRIPTIONS') {
          db.getSubscriptions(user.id).then(setSubscribedCreators);
      }
  }, [user, activeCategory]);

  // Handle Search History
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

  // Close recent searches on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
              setShowRecent(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Logic to Process List (Filter Only - No Shuffle)
  useEffect(() => {
      if (shuffledMasterList.length === 0) return;
      
      // Use the pre-shuffled list
      let filtered = shuffledMasterList;
      
      if (activeCategory === 'SUBSCRIPTIONS') {
          filtered = shuffledMasterList.filter(v => subscribedCreators.includes(v.creatorId));
      } else if (activeCategory !== 'ALL') {
          filtered = shuffledMasterList.filter(v => v.category === activeCategory);
      }

      // B. Search
      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(v => 
              v.title.toLowerCase().includes(q) || 
              v.description.toLowerCase().includes(q) || 
              v.creatorName.toLowerCase().includes(q)
          );
      }
      
      setProcessedList(filtered);
      
      // Reset count when filters change (unless it's the initial load/restore)
      if (!loading) {
         if (homeSnapshot && activeCategory === homeSnapshot.activeCategory && searchQuery === homeSnapshot.searchQuery) {
             // If matches snapshot (restore), keep snapshot count (handled by init)
         } else {
             setVisibleCount(ITEMS_PER_PAGE);
         }
      }

  }, [shuffledMasterList, activeCategory, searchQuery, subscribedCreators, loading]);

  // Infinite Scroll Observer - OPTIMIZED FOR NAS
  useEffect(() => {
      if (loading) return; // Don't attach observer while loading
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              // Increase by chunk size
              setVisibleCount(prev => prev + ITEMS_PER_PAGE);
          }
      }, { 
          // CRITICAL OPTIMIZATION: Look 1500px ahead
          rootMargin: '1500px' 
      });

      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [processedList, loading]);

  const displayList = processedList.slice(0, visibleCount);

  // Lazy Load Purchases for Visible Items (NAS OPTIMIZATION)
  useEffect(() => {
      if (!user || displayList.length === 0) return;

      const fetchVisiblePurchases = async () => {
          // Only check videos we haven't checked yet
          const toCheck = displayList.filter(v => 
              Number(v.price) > 0 && 
              v.creatorId !== user.id && 
              !purchases.has(v.id)
          );

          if (toCheck.length === 0) return;

          // Limit concurrency to avoid choking the NAS
          const BATCH_SIZE = 6; 
          
          for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
               const batch = toCheck.slice(i, i + BATCH_SIZE);
               const newIds: string[] = [];

               await Promise.all(batch.map(async (v) => {
                   try {
                       const has = await db.hasPurchased(user.id, v.id);
                       if (has) newIds.push(v.id);
                   } catch (e) { console.warn("Purchase check failed", e); }
               }));

               // Update state once per batch to reduce renders
               if (newIds.length > 0) {
                   setPurchases(prev => {
                       const next = new Set(prev);
                       newIds.forEach(id => next.add(id));
                       return next;
                   });
               }
          }
      };

      fetchVisiblePurchases();
  }, [displayList, user]); 

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.has(videoId) || (user?.id === creatorId);
  };

  const handleManualRefresh = () => {
      homeSnapshot = null;
      window.location.reload();
  };

  const filteredRecent = recentSearches.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

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
                    {/* Admin Link */}
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
                    
                    {/* Marketplace Link */}
                    <Link to="/marketplace" className="flex items-center gap-4 px-4 py-3 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-900/20 rounded-lg font-medium">
                        <ShoppingBag size={20}/> Tienda
                    </Link>

                    <button onClick={() => { setActiveCategory('SUBSCRIPTIONS'); setShowSidebar(false); }} className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium text-left">
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

      {/* Sticky Header: Search & Categories */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-slate-800/50 pb-2 pt-2 transition-all">
         
         {/* Search Bar */}
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
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white z-20"
                    >
                        <X size={18} />
                    </button>
                ) : (
                    <button 
                        onClick={handleManualRefresh}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white z-20"
                        title="Refrescar"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}

                {/* Recent Searches Dropdown */}
                {showRecent && filteredRecent.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 mt-2 overflow-hidden animate-in fade-in zoom-in-95 origin-top">
                        {filteredRecent.map(term => (
                            <div 
                                key={term} 
                                onClick={() => { setSearchQuery(term); addToHistory(term); setShowRecent(false); }}
                                className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/80 cursor-pointer group/item transition-colors border-b border-slate-800/50 last:border-0"
                            >
                                <div className="flex items-center gap-3 text-slate-300">
                                    <Clock size={16} className="text-slate-500" />
                                    <span className="text-sm font-medium">{term}</span>
                                </div>
                                <button 
                                    onClick={(e) => removeHistory(e, term)} 
                                    className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-slate-700/50 rounded-full transition-all opacity-0 group-hover/item:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>

         {/* Categories Pills */}
         <div className="flex items-center gap-2 overflow-x-auto px-4 md:px-6 scrollbar-hide pb-2">
            <div className="hidden md:flex bg-slate-800/50 p-1.5 rounded-lg text-slate-400 shrink-0">
                <Compass size={18} />
            </div>
            <div className="hidden md:block h-6 w-px bg-slate-800 mx-1 shrink-0"></div>
            {categoryList.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeTabClass(activeCategory, cat.id)}`}
                >
                    {cat.label}
                </button>
            ))}
         </div>
      </div>

      {/* Main Grid */}
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
             
             {/* Invisible Trigger for Infinite Scroll */}
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