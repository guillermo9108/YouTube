
import React, { useEffect, useState, useMemo } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import { db } from '../services/db';
import { Video, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import VideoCard from '../components/VideoCard';

const CATEGORIES = [
    { id: 'ALL', label: 'All' },
    { id: VideoCategory.SHORTS, label: 'Shorts' },
    { id: VideoCategory.MUSIC, label: 'Music' },
    { id: VideoCategory.SHORT_FILM, label: 'Short Films' },
    { id: VideoCategory.SERIES, label: 'Series' },
    { id: VideoCategory.NOVELAS, label: 'Novelas' },
    { id: VideoCategory.MOVIE, label: 'Movies' },
    { id: VideoCategory.EDUCATION, label: 'Education' },
    { id: VideoCategory.OTHER, label: 'Other' },
];

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Display List State (Holds the shuffled order)
  const [displayList, setDisplayList] = useState<Video[]>([]);

  // 1. Fetch All Data Initial
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const allVideos = await db.getAllVideos();
            setVideos(allVideos);
            
            if (user) {
                // Fetch Activity (Watched IDs)
                const activity = await db.getUserActivity(user.id);
                setWatchedIds(activity.watched || []);

                // Fetch Purchases
                const checks = allVideos.map(v => db.hasPurchased(user.id, v.id));
                const results = await Promise.all(checks);
                const p = allVideos.filter((_, i) => results[i]).map(v => v.id);
                setPurchases(p);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [user]);

  // 2. Logic to Shuffle "Fresh" content whenever Category or Videos change
  // This runs on mount (after fetch) and when category changes, simulating "New Feed"
  useEffect(() => {
      if (videos.length === 0) return;

      // Filter by Category
      let filtered = activeCategory === 'ALL' 
          ? videos 
          : videos.filter(v => v.category === activeCategory);

      // Separate Unwatched vs Watched
      const unwatched = filtered.filter(v => !watchedIds.includes(v.id));
      const watched = filtered.filter(v => watchedIds.includes(v.id));

      // SHUFFLE UNWATCHED (Fresh Content Logic)
      const shuffledUnwatched = [...unwatched].sort(() => Math.random() - 0.5);
      
      // Sort Watched by newest (History style)
      const sortedWatched = [...watched].sort((a, b) => b.createdAt - a.createdAt);

      // Combine: Unwatched first, then Watched
      setDisplayList([...shuffledUnwatched, ...sortedWatched]);

  }, [videos, activeCategory, watchedIds]);

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.includes(videoId) || (user?.id === creatorId);
  };

  return (
    <div className="min-h-screen">
      
      {/* Sticky Categories Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-slate-800/50 py-3 mb-4">
         <div className="flex items-center gap-3 overflow-x-auto px-4 md:px-6 scrollbar-hide">
            <div className="bg-slate-800/50 p-2 rounded-lg text-slate-400">
                <Compass size={20} />
            </div>
            <div className="h-6 w-px bg-slate-700 mx-1"></div>
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeCategory === cat.id ? 'bg-white text-black' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                    {cat.label}
                </button>
            ))}
         </div>
      </div>

      {/* Main Grid */}
      <div className="px-4 md:px-6 pb-20">
         {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                 <RefreshCw className="animate-spin mb-4" size={32} />
                 <p>Curating your feed...</p>
             </div>
         ) : displayList.length === 0 ? (
             <div className="text-center py-20 text-slate-500">
                 <p>No videos found in this category.</p>
             </div>
         ) : (
            <>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {displayList.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    isUnlocked={isUnlocked(video.id, video.creatorId)}
                    isWatched={watchedIds.includes(video.id)}
                  />
                ))}
             </div>
             
             {watchedIds.length > 0 && activeCategory === 'ALL' && (
                 <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
                     <p>You've seen all the new stuff!</p>
                     <p>Videos below are from your history.</p>
                 </div>
             )}
            </>
         )}
      </div>
    </div>
  );
}
