
import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Video, VideoCategory } from '../types';
import { RefreshCw, Search, Filter, X, ArrowDown } from 'lucide-react';
import { Link } from '../components/Router';

export default function Home() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  
  // Custom categories state
  const [categories, setCategories] = useState<string[]>(['ALL', ...Object.values(VideoCategory) as string[]]);

  // Pagination / Infinite Scroll
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const allVideos = await db.getAllVideos();
            setVideos(allVideos.sort((a, b) => b.createdAt - a.createdAt));
            
            // Load custom categories
            const settings = await db.getSystemSettings();
            if (settings && settings.customCategories) {
                setCategories(['ALL', ...Object.values(VideoCategory) as string[], ...settings.customCategories]);
            }
        } catch (e) {
            console.error("Failed to load home data", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [user]);

  const processedList = useMemo(() => {
      return videos.filter(v => {
          const matchCat = activeCategory === 'ALL' || v.category === activeCategory;
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchCat && matchSearch;
      });
  }, [videos, activeCategory, searchQuery]);

  // Infinite Scroll Observer
  useEffect(() => {
      // If we already show everything, stop observing
      if (visibleCount >= processedList.length) return;

      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              setVisibleCount(prev => prev + 12);
          }
      }, { threshold: 0.1 });

      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      
      return () => observer.disconnect();
  }, [processedList.length, visibleCount]); // Ensure re-observation when counts change

  // Reset pagination on filter change
  useEffect(() => {
      setVisibleCount(12);
  }, [activeCategory, searchQuery]);

  const displayList = processedList.slice(0, visibleCount);

  // Helper for Card
  const isUnlocked = (videoId: string, creatorId: string) => {
      if (!user) return false;
      if (user.role === 'ADMIN' || user.id === creatorId) return true;
      return false; 
  };

  return (
    <div className="pb-20">
      {/* Search & Filter Header */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md py-4 -mx-4 px-4 md:-mx-0 md:px-0 mb-6 border-b border-slate-800/50">
          <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search videos, creators..." 
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
      ) : (
          <>
             {displayList.length === 0 ? (
                 <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                     <Search size={48} className="mb-4 opacity-20" />
                     <p>No videos found.</p>
                     <button onClick={() => {setActiveCategory('ALL'); setSearchQuery('');}} className="text-indigo-400 text-sm mt-2 hover:underline">Clear filters</button>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-8 gap-x-4">
                    {displayList.map(video => (
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
             
             {/* Load More Trigger */}
             {visibleCount < processedList.length && (
                <div className="py-12 flex flex-col items-center gap-4">
                    <div ref={loadMoreRef} className="h-4 w-4"></div> {/* Invisible trigger target */}
                    
                    <RefreshCw className="animate-spin text-slate-600" />
                    
                    {/* Manual Fallback Button if observer fails */}
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 12)}
                        className="text-xs text-indigo-400 hover:text-white underline"
                    >
                        Cargar más videos manualmente
                    </button>
                </div>
             )}
             
             {/* End of List Message */}
             {visibleCount >= processedList.length && processedList.length > 0 && (
                 <div className="py-12 text-center text-slate-600 text-xs">
                     Has llegado al final de la lista.
                 </div>
             )}
          </>
      )}
    </div>
  );
}