
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, VideoCategory } from '../../types';
import { RefreshCw, Search, Filter, X, Flame, Clock, Sparkles, UserCheck, Shuffle, Heart, ChevronRight, ArrowDown } from 'lucide-react';
import { Link, useLocation } from '../Router';

// --- COMPONENTS ---

const SectionHeader = ({ title, icon: Icon, link }: { title: string, icon: any, link?: string }) => (
    <div className="flex items-center justify-between mb-3 px-4 md:px-0">
        <div className="flex items-center gap-2">
            <Icon size={20} className="text-indigo-400" />
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">{title}</h2>
        </div>
        {link && (
            <Link to={link} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                Ver todo <ChevronRight size={14}/>
            </Link>
        )}
    </div>
);

const HorizontalScroll = ({ children }: { children?: React.ReactNode }) => (
    <div className="flex overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0 gap-4 snap-x snap-mandatory scrollbar-hide">
        {children}
    </div>
);

export default function Home() {
  const { user } = useAuth();
  const location = useLocation(); // To track navigation
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  
  // Data
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  
  // Smart Feed State
  const [feed, setFeed] = useState<{
      tasteNew: Video[],      // 1. Nuevos por gusto
      generalNew: Video[],    // 2. Nuevos generales
      tasteGeneral: Video[],  // 3. Gustos generales
      trending: Video[],      // 4. Mas vistos
      subs: Video[],          // 5. Suscripciones
      discovery: Video[]      // 6. Aleatorios (Grid final)
  } | null>(null);

  // Discovery Pagination
  const [visibleDiscovery, setVisibleDiscovery] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Custom categories state
  const [categories, setCategories] = useState<string[]>(['ALL']);

  // --- ALGORITHM: SMART FEED GENERATOR ---
  const generateSmartFeed = async (videos: Video[], userId: string | undefined) => {
      // 1. Prepare Pools
      let availableVideos = [...videos];
      const usedIds = new Set<string>();
      
      const addToUsed = (vids: Video[]) => vids.forEach(v => usedIds.add(v.id));
      const getUnused = (pool: Video[]) => pool.filter(v => !usedIds.has(v.id));

      // 2. Get User Profile (Tastes & Subs)
      let topCategories: string[] = [];
      let subCreatorIds: string[] = [];

      if (userId) {
          try {
              // Fetch activity parallel
              const [activity, subs] = await Promise.all([
                  db.getUserActivity(userId),
                  db.getSubscriptions(userId)
              ]);

              subCreatorIds = subs || [];

              // Calculate Affinity Score
              const categoryScores: Record<string, number> = {};
              const interactIds = [...(activity.liked || []), ...(activity.watched || [])];
              
              // Map IDs back to full video objects to get categories
              interactIds.forEach(id => {
                  const vid = videos.find(v => v.id === id);
                  if (vid) {
                      const score = (activity.liked?.includes(id) ? 3 : 1); // Likes weigh more than views
                      categoryScores[vid.category] = (categoryScores[vid.category] || 0) + score;
                  }
              });

              // Sort categories by score
              topCategories = Object.entries(categoryScores)
                  .sort(([,a], [,b]) => b - a)
                  .map(([cat]) => cat);
          } catch(e) { console.error("Error building profile", e); }
      }

      // If no history, pick 2 random categories as "tastes" to start
      if (topCategories.length === 0) {
          const allCats = Object.values(VideoCategory) as string[];
          topCategories = allCats.sort(() => 0.5 - Math.random()).slice(0, 2);
      }

      // 3. BUILD SECTIONS (Waterfall Logic)
      
      // SECTION 5: SUSCRIPCIONES (Priority: High connection)
      // Filter subs first to ensure they get seen
      const subs = getUnused(availableVideos.filter(v => subCreatorIds.includes(v.creatorId)))
                   .sort((a,b) => b.createdAt - a.createdAt)
                   .slice(0, 10);
      addToUsed(subs);

      // SECTION 1: NUEVOS BASADO EN GUSTOS (Recency + Affinity)
      // Last 7 days + Matching Top 3 Categories
      const oneWeekAgo = Date.now()/1000 - (7 * 86400);
      const tasteNew = getUnused(availableVideos.filter(v => 
          v.createdAt > oneWeekAgo && topCategories.includes(v.category)
      )).sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
      addToUsed(tasteNew);

      // SECTION 2: NUEVOS GENERALES (Pure Recency)
      const generalNew = getUnused(availableVideos.filter(v => v.createdAt > oneWeekAgo))
                         .sort((a,b) => b.createdAt - a.createdAt)
                         .slice(0, 10);
      addToUsed(generalNew);

      // SECTION 4: MAS VISTOS (Trending)
      const trending = getUnused(availableVideos)
                       .sort((a,b) => b.views - a.views)
                       .slice(0, 10);
      addToUsed(trending);

      // SECTION 3: BASADO EN GUSTOS (General Affinity)
      // Shuffle to keep it fresh
      const tasteGeneral = getUnused(availableVideos.filter(v => topCategories.includes(v.category)))
                           .sort(() => 0.5 - Math.random())
                           .slice(0, 12);
      addToUsed(tasteGeneral);

      // SECTION 6: DESCUBRIMIENTO / ALEATORIOS (The rest)
      const discovery = getUnused(availableVideos).sort(() => 0.5 - Math.random());

      return { tasteNew, generalNew, tasteGeneral, trending, subs, discovery };
  };

  // --- INITIAL LOAD & REFRESH ---
  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const all = await db.getAllVideos();
            
            // Filter invalid
            const validVideos = all.filter(v => v.category !== 'PENDING' && v.category !== 'PROCESSING');
            setAllVideos(validVideos);

            // Fetch watched status for UI
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act.watched || []);
            }

            // Generate Feed
            const smartData = await generateSmartFeed(validVideos, user?.id);
            setFeed(smartData);

            // --- SMART CATEGORY GENERATION ---
            const settings = await db.getSystemSettings();
            
            // 1. Calculate Stats (Video Count & Total Views per Category)
            const catStats: Record<string, { count: number, views: number }> = {};
            validVideos.forEach(v => {
                const c = v.category;
                if (!catStats[c]) catStats[c] = { count: 0, views: 0 };
                catStats[c].count++;
                catStats[c].views += Number(v.views || 0);
            });

            // 2. Merge System Categories
            let allConfiguredCats = Object.values(VideoCategory) as string[];
            if (settings && settings.customCategories) {
                allConfiguredCats = [...allConfiguredCats, ...settings.customCategories];
            }
            // De-duplicate
            allConfiguredCats = Array.from(new Set(allConfiguredCats));

            // 3. Filter & Sort
            // Hide categories with 0 videos. Sort by Total Views (descending).
            const sortedCats = allConfiguredCats
                .filter(cat => catStats[cat] && catStats[cat].count > 0)
                .sort((a, b) => {
                    // Sort by total views first, then by video count
                    const viewsA = catStats[a]?.views || 0;
                    const viewsB = catStats[b]?.views || 0;
                    return viewsB - viewsA;
                });

            setCategories(['ALL', ...sortedCats]);

        } catch (e) {
            console.error("Home Load Error", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [user, location.pathname]); // Re-run when user OR pathname changes (returning to home)

  // --- FILTERING LOGIC (For Search or Manual Category) ---
  // When user types or selects a specific category, we bypass the Smart Feed
  const isFilteredMode = searchQuery.trim() !== '' || activeCategory !== 'ALL';
  
  const filteredList = useMemo(() => {
      if (!isFilteredMode) return [];
      return allVideos.filter(v => {
          const matchCat = activeCategory === 'ALL' || v.category === activeCategory;
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchCat && matchSearch;
      }).sort((a,b) => b.createdAt - a.createdAt);
  }, [allVideos, activeCategory, searchQuery]);

  // Robust Infinite Scroll with Fallback
  useEffect(() => {
      const currentListLength = isFilteredMode ? filteredList.length : (feed?.discovery.length || 0);
      
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              setVisibleDiscovery(prev => {
                  if (prev >= currentListLength) return prev;
                  return prev + 12;
              });
          }
      }, { 
          threshold: 0.1,
          rootMargin: '1200px' 
      });

      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [isFilteredMode, filteredList.length, feed?.discovery.length]); // Dependencies must trigger reset

  // Reset pagination on filter change
  useEffect(() => { setVisibleDiscovery(12); }, [activeCategory, searchQuery]);

  // Determine current effective list count
  const effectiveCount = isFilteredMode ? filteredList.length : (feed?.discovery.length || 0);
  const showLoadMoreButton = visibleDiscovery < effectiveCount;

  // Helper for Card
  const isUnlocked = (videoId: string, creatorId: string) => {
      if (!user) return false;
      if (user.role === 'ADMIN' || user.id === creatorId) return true;
      return false; // Actually checked inside Card logic or Watch page more robustly
  };

  return (
    <div className="pb-20">
      {/* Search & Filter Header (Sticky) */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md py-4 -mx-4 px-4 md:-mx-0 md:px-0 mb-6 border-b border-slate-800/50">
          <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar videos, creadores..." 
                      className="w-full bg-slate-900 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                          <X size={16} />
                      </button>
                  )}
              </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => (
                  <button 
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          activeCategory === cat 
                          ? 'bg-white text-black border-white' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}
                  >
                      {cat.replace('_', ' ')}
                  </button>
              ))}
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-20">
              <RefreshCw className="animate-spin text-indigo-500" size={32} />
          </div>
      ) : isFilteredMode ? (
          // --- FILTERED GRID VIEW (Standard) ---
          <div className="animate-in fade-in">
             <div className="mb-4 text-slate-400 text-sm font-bold flex items-center gap-2">
                 <Filter size={16}/> Resultados de búsqueda
             </div>
             {filteredList.length === 0 ? (
                 <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                     <Search size={48} className="mb-4 opacity-20" />
                     <p>No se encontraron videos.</p>
                     <button onClick={() => {setActiveCategory('ALL'); setSearchQuery('');}} className="text-indigo-400 text-sm mt-2 hover:underline">Limpiar filtros</button>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-8 gap-x-4">
                    {filteredList.slice(0, visibleDiscovery).map(video => (
                      <VideoCard 
                        key={video.id} 
                        video={video} 
                        isUnlocked={isUnlocked(video.id, video.creatorId)}
                        isWatched={watchedIds.includes(video.id)}
                        context={{ query: searchQuery, category: activeCategory }}
                      />
                    ))}
                 </div>
             )}
             
             {/* Pagination Triggers */}
             <div ref={loadMoreRef} className="h-10 mt-8 flex justify-center items-center">
                 {showLoadMoreButton && (
                     <button 
                        onClick={() => setVisibleDiscovery(prev => prev + 12)}
                        className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2"
                     >
                         <ArrowDown size={16}/> Cargar Más Resultados
                     </button>
                 )}
             </div>
          </div>
      ) : (
          // --- SMART FEED VIEW (6 Sections) ---
          <div className="space-y-10 animate-in fade-in">
              
              {/* 5. Suscripciones (Shown first for easy access) */}
              {user && feed?.subs && feed.subs.length > 0 && (
                  <section className="bg-slate-900/30 -mx-4 px-4 py-6 border-y border-slate-800/50">
                      <SectionHeader title="De tus suscripciones" icon={UserCheck} />
                      <HorizontalScroll>
                          {feed.subs.map(video => (
                              <div key={video.id} className="w-64 md:w-72 flex-shrink-0 snap-start">
                                  <VideoCard 
                                      video={video} 
                                      isUnlocked={isUnlocked(video.id, video.creatorId)}
                                      isWatched={watchedIds.includes(video.id)}
                                  />
                              </div>
                          ))}
                      </HorizontalScroll>
                  </section>
              )}

              {/* 1. Nuevos Basado en Gustos (Highlight) */}
              {feed?.tasteNew && feed.tasteNew.length > 0 && (
                  <section>
                      <SectionHeader title="Nuevos para ti" icon={Sparkles} />
                      <HorizontalScroll>
                          {feed.tasteNew.map(video => (
                              <div key={video.id} className="w-72 md:w-80 flex-shrink-0 snap-start">
                                  <VideoCard 
                                      video={video} 
                                      isUnlocked={isUnlocked(video.id, video.creatorId)}
                                      isWatched={watchedIds.includes(video.id)}
                                  />
                              </div>
                          ))}
                      </HorizontalScroll>
                  </section>
              )}

              {/* 4. Tendencias (Most Viewed) */}
              {feed?.trending && feed.trending.length > 0 && (
                  <section>
                      <SectionHeader title="Tendencias" icon={Flame} />
                      <HorizontalScroll>
                          {feed.trending.map((video, idx) => (
                              <div key={video.id} className="w-72 md:w-80 flex-shrink-0 snap-start relative">
                                  <div className="absolute -left-2 -top-4 text-[100px] font-black text-slate-800/50 z-0 pointer-events-none select-none drop-shadow-lg font-serif">
                                      {idx + 1}
                                  </div>
                                  <div className="relative z-10 pl-4">
                                    <VideoCard 
                                        video={video} 
                                        isUnlocked={isUnlocked(video.id, video.creatorId)}
                                        isWatched={watchedIds.includes(video.id)}
                                    />
                                  </div>
                              </div>
                          ))}
                      </HorizontalScroll>
                  </section>
              )}

              {/* 2. Nuevos Generales */}
              {feed?.generalNew && feed.generalNew.length > 0 && (
                  <section>
                      <SectionHeader title="Recién llegados" icon={Clock} />
                      <HorizontalScroll>
                          {feed.generalNew.map(video => (
                              <div key={video.id} className="w-60 md:w-64 flex-shrink-0 snap-start">
                                  <VideoCard 
                                      video={video} 
                                      isUnlocked={isUnlocked(video.id, video.creatorId)}
                                      isWatched={watchedIds.includes(video.id)}
                                  />
                              </div>
                          ))}
                      </HorizontalScroll>
                  </section>
              )}

              {/* 3. Basado en Gustos (General) */}
              {feed?.tasteGeneral && feed.tasteGeneral.length > 0 && (
                  <section>
                      <SectionHeader title="Porque te gusta..." icon={Heart} />
                      <HorizontalScroll>
                          {feed.tasteGeneral.map(video => (
                              <div key={video.id} className="w-72 md:w-80 flex-shrink-0 snap-start">
                                  <VideoCard 
                                      video={video} 
                                      isUnlocked={isUnlocked(video.id, video.creatorId)}
                                      isWatched={watchedIds.includes(video.id)}
                                  />
                              </div>
                          ))}
                      </HorizontalScroll>
                  </section>
              )}

              {/* 6. Descubrimiento (Grid Final) */}
              <section className="pt-4 border-t border-slate-800">
                  <SectionHeader title="Descubrimiento" icon={Shuffle} />
                  {feed?.discovery && feed.discovery.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-8 gap-x-4">
                          {feed.discovery.slice(0, visibleDiscovery).map(video => (
                              <VideoCard 
                                  key={video.id} 
                                  video={video} 
                                  isUnlocked={isUnlocked(video.id, video.creatorId)}
                                  isWatched={watchedIds.includes(video.id)}
                              />
                          ))}
                      </div>
                  ) : (
                      <div className="text-center py-10 text-slate-500">No hay más videos para descubrir.</div>
                  )}
                  
                  {/* Load More Area */}
                  <div ref={loadMoreRef} className="h-24 mt-4 flex flex-col justify-center items-center opacity-80">
                      {showLoadMoreButton ? (
                          <>
                            <RefreshCw className="animate-spin text-slate-600 mb-2"/>
                            {/* Fallback button if observer fails or stuck */}
                            <button 
                                onClick={() => setVisibleDiscovery(prev => prev + 12)}
                                className="text-xs text-indigo-400 hover:text-white underline"
                            >
                                Cargar más
                            </button>
                          </>
                      ) : (
                          <div className="text-xs text-slate-600">Has llegado al final.</div>
                      )}
                  </div>
              </section>
          </div>
      )}
    </div>
  );
}
