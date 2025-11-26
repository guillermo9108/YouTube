import React, { useEffect, useState, useMemo } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { db } from '../services/db';
import { Video } from '../types';
import { useAuth } from '../App';
import VideoCard from '../components/VideoCard';

type SortOption = 'newest' | 'views' | 'price';

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const { user } = useAuth();

  useEffect(() => {
    setVideos(db.getAllVideos());
  }, []);

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

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
         <div>
          <h2 className="text-2xl font-bold text-white">Featured Videos</h2>
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
            isUnlocked={user ? db.hasPurchased(user.id, video.id) : false}
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