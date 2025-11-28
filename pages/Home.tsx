
import React, { useEffect, useState, useMemo } from 'react';
import { ArrowDownWideNarrow, Flame } from 'lucide-react';
import { db } from '../services/db';
import { Video } from '../types';
import { useAuth } from '../context/AuthContext';
import VideoCard from '../components/VideoCard';

type SortOption = 'newest' | 'views' | 'price';

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [purchases, setPurchases] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    db.getAllVideos().then(setVideos);
  }, []);

  // Fetch purchases separately to avoid async issues in loop
  useEffect(() => {
    if (user && videos.length > 0) {
        Promise.all(videos.map(v => db.hasPurchased(user.id, v.id)))
            .then(results => {
                const p = videos.filter((_, i) => results[i]).map(v => v.id);
                setPurchases(p);
            });
    }
  }, [user, videos]);

  // Calculate Trending Videos (Weighted score: Views + Likes * 5)
  const trendingVideos = useMemo(() => {
    if (videos.length === 0) return [];
    return [...videos]
      .sort((a, b) => {
        const scoreA = a.views + (a.likes * 5);
        const scoreB = b.views + (b.likes * 5);
        return scoreB - scoreA;
      })
      .slice(0, 5); // Top 5
  }, [videos]);

  const sortedVideos = useMemo(() => {
    const sorted = [...videos];
    switch (sortOption) {
      case 'newest':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case 'views':
        return sorted.sort((a, b) => b.views - a.views);
      case 'price':
        return sorted.sort((a, b) => a.price - b.price);
      default:
        return sorted;
    }
  }, [videos, sortOption]);

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.includes(videoId) || (user?.id === creatorId);
  };

  return (
    <div className="pb-10">
      
      {/* Trending Section */}
      {trendingVideos.length > 0 && (
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Flame className="text-orange-500" fill="currentColor" size={24} /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Trending Now</span>
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0">
            {trendingVideos.map(video => (
              <div key={`trend-${video.id}`} className="w-72 shrink-0 snap-start">
                <VideoCard 
                  video={video} 
                  isUnlocked={isUnlocked(video.id, video.creatorId)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-t border-slate-800 pt-8">
         <div>
          <h2 className="text-2xl font-bold text-white">All Videos</h2>
          <p className="text-slate-400 text-sm">Discover exclusive content using Saldo.</p>
         </div>
         
         <div className="flex items-center gap-4 self-start md:self-end w-full md:w-auto">
            {/* Sort Dropdown */}
            <div className="relative group flex-1 md:flex-none">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ArrowDownWideNarrow size={16} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
              </div>
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full md:w-48 bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-10 pr-8 py-2.5 appearance-none hover:bg-slate-800 transition-colors cursor-pointer outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="views">Most Viewed</option>
                <option value="price">Price (Low to High)</option>
              </select>
            </div>

            {user && (
               <div className="text-right pl-4 border-l border-slate-800 hidden sm:block shrink-0">
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">My Balance</p>
                 <p className="text-xl font-mono text-indigo-400 leading-none">{user.balance} <span className="text-xs text-slate-400">SALDO</span></p>
               </div>
             )}
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedVideos.map(video => (
          <VideoCard 
            key={video.id} 
            video={video} 
            isUnlocked={isUnlocked(video.id, video.creatorId)}
          />
        ))}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
           <p className="text-slate-500">No videos uploaded yet.</p>
        </div>
      )}
    </div>
  );
}
