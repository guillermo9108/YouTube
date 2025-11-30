
import React, { useEffect, useState } from 'react';
import { useParams } from '../components/Router';
import { db } from '../services/db';
import { User, Video } from '../types';
import VideoCard from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Bell, Loader2 } from 'lucide-react';

export default function Channel() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  
  const [channelUser, setChannelUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({ views: 0, uploads: 0 });
  const [purchases, setPurchases] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    
    const loadChannel = async () => {
        setLoading(true);
        try {
            // 1. Get User Details
            const u = await db.getUser(userId);
            setChannelUser(u);

            // 2. Get User Videos
            const vids = await db.getVideosByCreator(userId);
            setVideos(vids);

            // 3. Calc Stats
            const totalViews = vids.reduce((acc, curr) => acc + curr.views, 0);
            setStats({ views: totalViews, uploads: vids.length });

            // 4. Check purchases for the current viewer
            if (currentUser) {
                const checks = vids.map(v => db.hasPurchased(currentUser.id, v.id));
                const results = await Promise.all(checks);
                const p = vids.filter((_, i) => results[i]).map(v => v.id);
                setPurchases(p);
            }

        } catch (e) {
            console.error("Failed to load channel", e);
        } finally {
            setLoading(false);
        }
    };

    loadChannel();
  }, [userId, currentUser]);

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.includes(videoId) || (currentUser?.id === creatorId);
  };

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;
  if (!channelUser) return <div className="text-center p-10 text-slate-500">User not found</div>;

  return (
    <div className="pb-20">
       {/* Banner (Gradient Placeholder) */}
       <div className="h-32 md:h-48 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative"></div>

       {/* Channel Header Info */}
       <div className="px-4 md:px-12 -mt-10 flex flex-col md:flex-row items-center md:items-end gap-6 mb-8">
           {/* Avatar */}
           <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-black bg-slate-800 overflow-hidden shrink-0">
               {channelUser.avatarUrl ? (
                   <img src={channelUser.avatarUrl} alt={channelUser.username} className="w-full h-full object-cover" />
               ) : (
                   <div className="w-full h-full flex items-center justify-center text-4xl text-slate-500">
                       <UserIcon size={48} />
                   </div>
               )}
           </div>

           {/* Info */}
           <div className="flex-1 text-center md:text-left">
               <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{channelUser.username}</h1>
               <div className="text-slate-400 text-sm flex items-center justify-center md:justify-start gap-2 mb-4">
                   <span>@{channelUser.username}</span>
                   <span>•</span>
                   <span>{stats.uploads} videos</span>
                   <span>•</span>
                   <span>{stats.views} total views</span>
               </div>
               
               {currentUser?.id !== channelUser.id && (
                   <button className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2 mx-auto md:mx-0">
                       Subscribe <Bell size={16}/>
                   </button>
               )}
           </div>
       </div>

       <div className="h-px bg-slate-800 mx-4 md:mx-12 mb-6"></div>

       {/* Videos Grid */}
       <div className="px-4 md:px-12">
           <h2 className="text-lg font-bold text-white mb-4">Videos</h2>
           {videos.length === 0 ? (
               <div className="text-center py-20 text-slate-500">This user hasn't uploaded any videos yet.</div>
           ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                   {videos.map(video => (
                        <VideoCard 
                            key={video.id} 
                            video={video} 
                            isUnlocked={isUnlocked(video.id, video.creatorId)}
                            isWatched={false} // Can be improved if we fetch history
                        />
                   ))}
               </div>
           )}
       </div>
    </div>
  );
}
