import React, { useState, useEffect, useMemo, useRef } from 'react';
import VideoCard from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Video, VideoCategory } from '../types';
import { RefreshCw, Search, Filter, X } from 'lucide-react';
import { Link } from '../components/Router';

export default function Home() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  
  // Custom categories state
  const [categories, setCategories] = useState<string[]>(['ALL', ...Object.values(VideoCategory)]);

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
                setCategories(['ALL', ...Object.values(VideoCategory), ...settings.customCategories]);
            }

            if (user) {
                // Determine watched and purchased for quick UI feedback
                // Note: ideally backend sends this in video object or separate sync endpoint
                // For now, we might rely on individual checks in cards or a bulk fetch if available.
                // Assuming we might not have a bulk fetch for "all watched", we'll track locally what we can 
                // or let VideoCard handle async checks. 
                // However, for filtering "watched", we need the list.
                // Simulating a bulk fetch for now or relying on VideoCard internal state.
                // To keep Home performant, let's just pass user data down.
                
                // Fetch purchased IDs for user (optimization)
                // const purchases = await db.getUserPurchases(user.id);
                // setPurchasedIds(purchases);
            }
        } catch (e) {
            console.error("Failed to load home data", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [user]);

  // Infinite Scroll Observer
  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              setVisibleCount(prev => prev + 12);
          }
      }, { threshold: 0.1 });

      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [videos, activeCategory, searchQuery]);

  const processedList = useMemo(() => {
      return videos.filter(v => {
          const matchCat = activeCategory === 'ALL' || v.category === activeCategory;
          const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              v.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
          return matchCat && matchSearch;
      });
  }, [videos, activeCategory, searchQuery]);

  const displayList = processedList.slice(0, visibleCount);

  // Helper for Card
  const isUnlocked = (videoId: string, creatorId: string) => {
      if (!user) return false;
      if (user.role === 'ADMIN' || user.id === creatorId) return true;
      // In a real app we'd check purchasedIds array. 
      // For now, let VideoCard handle individual async check or pass false if unknown.
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
             
             {visibleCount < processedList.length && (
                <div ref={loadMoreRef} className="py-24 flex justify-center">
                    <RefreshCw className="animate-spin text-slate-600" />
                </div>
             )}
          </>
      )}
    </div>
  );
}
