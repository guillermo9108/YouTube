import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import VideoCard from '../VideoCard';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Video, UserRole } from '../../types';
import { RefreshCw, Search, Filter, X, Flame, Clock, Sparkles, UserCheck, Shuffle, ChevronRight, ArrowDown, Database, LayoutGrid, Play, Info } from 'lucide-react';
import { Link, useLocation, useNavigate } from '../Router';
import AIConcierge from '../AIConcierge';

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

const HeroSection = ({ video }: { video: Video | null }) => {
    const navigate = useNavigate();
    if (!video) return null;

    return (
        <div className="relative h-[60vh] md:h-[70vh] -mx-4 md:mx-0 mb-8 overflow-hidden rounded-b-[40px] md:rounded-3xl group">
            <img 
                src={video.thumbnailUrl} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                alt={video.title} 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3 space-y-4 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-2">
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={10}/> Destacado
                    </span>
                    <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">
                        Premium
                    </span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white leading-[0.9] tracking-tighter uppercase italic">
                    {video.title}
                </h1>
                <p className="text-slate-300 text-sm md:text-lg line-clamp-2 max-w-xl font-medium">
                    {video.description || "Sumérgete en esta experiencia premium exclusiva de StreamPay. Calidad máxima y contenido inigualable."}
                </p>
                <div className="flex items-center gap-4 pt-4">
                    <button onClick={() => navigate(`/watch/${video.id}`)} className="bg-white text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-slate-200 active:scale-95 transition-all shadow-2xl shadow-white/10">
                        <Play size={20} fill="currentColor"/> Ver Ahora
                    </button>
                    <button onClick={() => navigate(`/watch/${video.id}`)} className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-white/20 active:scale-95 transition-all">
                        <Info size={20}/> Detalles
                    </button>
                </div>
            </div>
            <div className="absolute top-8 right-8 bg-black/40 backdrop-blur-xl border border-white/20 p-4 rounded-3xl flex flex-col items-center shadow-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inversión</span>
                <span className="text-3xl font-black text-white">{video.price} $</span>
            </div>
        </div>
    );
};

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [feed, setFeed] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>(['ALL']);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role?.trim().toUpperCase() === 'ADMIN';

  const generateSmartFeed = async (videos: Video[], userId: string | undefined) => {
      let availableVideos = [...videos];
      const usedIds = new Set<string>();
      const addToUsed = (vids: Video[]) => vids.forEach(v => usedIds.add(v.id));
      const getUnused = (pool: Video[]) => pool.filter(v => !usedIds.has(v.id));
      let topCategories: string[] = [];
      let subCreatorIds: string[] = [];
      if (userId) {
          try {
              const [activity, subs] = await Promise.all([db.getUserActivity(userId), db.getSubscriptions(userId)]);
              subCreatorIds = subs || [];
              const categoryScores: Record<string, number> = {};
              const interactIds = [...(activity.liked || []), ...(activity.watched || [])];
              interactIds.forEach(id => {
                  const vid = videos.find(v => v.id === id);
                  if (vid) {
                      const score = (activity.liked?.includes(id) ? 3 : 1);
                      categoryScores[vid.category] = (categoryScores[vid.category] || 0) + score;
                  }
              });
              topCategories = Object.entries(categoryScores).sort(([,a], [,b]) => b - a).map(([cat]) => cat);
          } catch(e) {}
      }
      const subs = getUnused(availableVideos.filter(v => subCreatorIds.includes(v.creatorId))).sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
      addToUsed(subs);
      const oneWeekAgo = Date.now()/1000 - (7 * 86400);
      const tasteNew = getUnused(availableVideos.filter(v => v.createdAt > oneWeekAgo && topCategories.includes(v.category))).sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
      addToUsed(tasteNew);
      const trending = getUnused(availableVideos).sort((a,b) => b.views - a.views).slice(0, 10);
      addToUsed(trending);
      const discovery = getUnused(availableVideos);
      const heroCandidate = videos.filter(v => v.price > 0).sort((a,b) => b.createdAt - a.createdAt)[0] || videos[0];
      return { tasteNew, trending, subs, discovery, hero: heroCandidate };
  };

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const all = await db.getAllVideos();
            const validVideos = all.filter(v => v.category !== 'PENDING' && v.category !== 'PROCESSING' && v.category !== 'FAILED_METADATA');
            setAllVideos(validVideos);
            if (user) {
                const act = await db.getUserActivity(user.id);
                setWatchedIds(act.watched || []);
            }
            const smartData = await generateSmartFeed(validVideos, user?.id);
            setFeed(smartData);
            const settings = await db.getSystemSettings();
            const catStats: Record<string, { count: number, views: number }> = {};
            validVideos.forEach(v => {
                const c = v.category;
                if (!catStats[c]) catStats[c] = { count: 0, views: 0 };
                catStats[c].count++;
                catStats[c].views += Number(v.views || 0);
            });
            let allConfiguredCats = ['GENERAL', ...(settings.customCategories || [])];
            allConfiguredCats = Array.from(new Set(allConfiguredCats));
            const sortedCats = allConfiguredCats
                .filter(cat => catStats[cat] && catStats[cat].count > 0)
                .sort((a, b) => (catStats[b]?.views || 0) - (catStats[a]?.views || 0));
            setCategories(['ALL', ...sortedCats]);
        } catch (e) {} finally { setLoading(false); }
    };
    loadData();
  }, [user, location.pathname]);

  const isFilteredMode = searchQuery.trim() !== '' || activeCategory !== 'ALL';
  
  const filteredList = useMemo(() => {
      return allVideos.filter(v => {
          const matchCat = activeCategory === 'ALL' || v.category === activeCategory;
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchCat && matchSearch;
      }).sort((a,b) => b.createdAt - a.createdAt);
  }, [allVideos, activeCategory, searchQuery]);

  useEffect(() => { setVisibleCount(12); }, [searchQuery, activeCategory]);

  const loadMore = useCallback(() => {
      if (isMoreLoading) return;
      // Usamos el listado de descubrimiento si no hay filtros activos
      const pool = isFilteredMode ? filteredList : (feed?.discovery || []);
      if (visibleCount < pool.length) {
          setIsMoreLoading(true);
          setTimeout(() => {
              setVisibleCount(prev => prev + 12);
              setIsMoreLoading(false);
          }, 300);
      }
  }, [isFilteredMode, filteredList.length, feed?.discovery, visibleCount, isMoreLoading]);

  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) { loadMore(); }
      }, { threshold: 0.1, rootMargin: '1200px' });
      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [loadMore]);

  const displayList = isFilteredMode ? filteredList : (feed?.discovery || []);

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md py-4 -mx-4 px-4 md:-mx-0 md:px-0 mb-6 border-b border-slate-800/50">
          <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar videos, creadores..." className="w-full bg-slate-900 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-all" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white"><X size={16} /></button>}
              </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${activeCategory === cat ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{cat.replace('_', ' ')}</button>
              ))}
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>
      ) : allVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800 shadow-2xl relative">
                  <LayoutGrid size={48} className="text-slate-700" />
                  <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-full border-4 border-black"><RefreshCw size={16} className="text-white animate-spin" /></div>
              </div>
              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Librería Vacía</h2>
              <p className="text-slate-500 text-sm max-w-sm leading-relaxed">No hay videos publicados aún.</p>
              {isAdmin && (
                  <Link to="/admin" className="mt-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-900/40 flex items-center gap-2 active:scale-95 transition-all">
                      <Database size={18}/> Ir a Gestión de Librería
                  </Link>
              )}
          </div>
      ) : (
          <div className="space-y-10 animate-in fade-in">
              {!isFilteredMode && <HeroSection video={feed?.hero} />}
              {!isFilteredMode && (
                  <>
                    {feed?.subs?.length > 0 && (
                        <section className="bg-slate-900/30 -mx-4 px-4 py-6 border-y border-slate-800/50">
                            <SectionHeader title="De tus creadores" icon={UserCheck} />
                            <HorizontalScroll>{feed.subs.map((v: Video) => <div key={v.id} className="w-64 md:w-72 flex-shrink-0 snap-start"><VideoCard video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)}/></div>)}</HorizontalScroll>
                        </section>
                    )}
                    {feed?.tasteNew?.length > 0 && (
                        <section>
                            <SectionHeader title="Nuevos para ti" icon={Sparkles} />
                            <HorizontalScroll>{feed.tasteNew.map((v: Video) => <div key={v.id} className="w-72 md:w-80 flex-shrink-0 snap-start"><VideoCard video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)}/></div>)}</HorizontalScroll>
                        </section>
                    )}
                    {feed?.trending?.length > 0 && (
                        <section>
                            <SectionHeader title="Tendencias" icon={Flame} />
                            <HorizontalScroll>{feed.trending.map((v: Video, idx: number) => <div key={v.id} className="w-72 md:w-80 flex-shrink-0 snap-start relative"><div className="absolute -left-2 -top-4 text-[100px] font-black text-slate-800/30 z-0 pointer-events-none select-none font-serif">{idx + 1}</div><div className="relative z-10 pl-4"><VideoCard video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)}/></div></div>)}</HorizontalScroll>
                        </section>
                    )}
                  </>
              )}
              <section className={!isFilteredMode ? "pt-4 border-t border-slate-800" : ""}>
                  <SectionHeader title={isFilteredMode ? "Resultados encontrados" : "Descubrimiento"} icon={isFilteredMode ? Filter : Shuffle} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-8 gap-x-4">
                      {displayList.slice(0, visibleCount).map((v: Video) => (
                          <VideoCard key={v.id} video={v} isUnlocked={isAdmin || user?.id === v.creatorId} isWatched={watchedIds.includes(v.id)} />
                      ))}
                  </div>
                  <div ref={loadMoreRef} className="h-40 flex flex-col justify-center items-center">
                      {visibleCount < displayList.length ? (
                          <div className="flex flex-col items-center gap-3">
                              <RefreshCw className="animate-spin text-indigo-500" size={24}/>
                              <span className="text-[10px] uppercase font-black text-slate-600 tracking-widest">Cargando más contenido</span>
                          </div>
                      ) : displayList.length > 0 && (
                          <div className="text-[10px] uppercase font-black text-slate-700 tracking-[0.3em] border-t border-slate-900 pt-8 w-full text-center">Has llegado al final de la biblioteca</div>
                      )}
                  </div>
              </section>
              {!isFilteredMode && <AIConcierge videos={allVideos} />}
          </div>
      )}
    </div>
  );
}