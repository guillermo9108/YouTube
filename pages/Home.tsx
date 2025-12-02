
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Compass, RefreshCw, Search, X, Filter, Menu, Home as HomeIcon, Smartphone, Upload, User, LogOut, DownloadCloud } from 'lucide-react';
import { db } from '../services/db';
import { Video, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link } from '../components/Router';
import VideoCard from '../components/VideoCard';

const INITIAL_CATEGORIES = [
    { id: 'ALL', label: 'All' },
    { id: 'SUBSCRIPTIONS', label: 'Subscriptions' },
    { id: VideoCategory.SHORTS, label: 'Shorts' },
    { id: VideoCategory.MUSIC, label: 'Music' },
    { id: VideoCategory.SHORT_FILM, label: 'Short Films' },
    { id: VideoCategory.SERIES, label: 'Series' },
    { id: VideoCategory.NOVELAS, label: 'Novelas' },
    { id: VideoCategory.MOVIE, label: 'Movies' },
    { id: VideoCategory.EDUCATION, label: 'Education' },
    { id: VideoCategory.OTHER, label: 'Other' },
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
                    <Link to="/" className="flex items-center gap-4 px-4 py-3 text-white bg-slate-800 rounded-lg font-medium">
                        <HomeIcon size={20}/> Home
                    </Link>
                    <Link to="/shorts" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Smartphone size={20}/> Shorts
                    </Link>
                    <button onClick={() => { setActiveCategory('SUBSCRIPTIONS'); setShowSidebar(false); }} className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium text-left">
                        <Compass size={20}/> Subscriptions
                    </button>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <Link to="/requests" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <DownloadCloud size={20}/> Requests
                    </Link>
                    <Link to="/upload" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <Upload size={20}/> Upload
                    </Link>
                    <Link to="/profile" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium">
                        <User size={20}/> Profile
                    </Link>
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button onClick={logout} className="flex items-center gap-4 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-lg font-medium w-full text-left">
                        <LogOut size={20}/> Logout
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
            <div className="relative group flex-1 max-w-2xl mx-auto">
                <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search videos, creators..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 transition-all text-sm"
                />
                {searchQuery ? (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                ) : (
                    <button 
                        onClick={handleManualRefresh}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                        title="Force Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
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
                 <p>Curating your feed...</p>
             </div>
         ) : displayList.length === 0 ? (
             <div className="text-center py-20 text-slate-500">
                 {searchQuery ? (
                     <>
                        <Filter className="mx-auto mb-4 opacity-50" size={48} />
                        <p className="text-lg font-bold text-white mb-2">No results found</p>
                        <p className="text-sm">Try different keywords for "{searchQuery}"</p>
                     </>
                 ) : (
                     <>
                        <p className="text-lg font-bold text-white mb-2">No videos here</p>
                        <p className="text-sm">{activeCategory === 'SUBSCRIPTIONS' ? "You haven't subscribed to anyone yet." : "No videos found in this category."}</p>
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
