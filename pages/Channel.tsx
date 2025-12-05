import React, { useEffect, useState } from 'react';
import { useParams } from '../components/Router';
import { db } from '../services/db';
import { User, Video } from '../types';
import VideoCard from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Bell, Loader2, Check, Trash2 } from 'lucide-react';

export default function Channel() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  
  const [channelUser, setChannelUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({ views: 0, uploads: 0 });
  const [purchases, setPurchases] = useState<string[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!userId) {
        setLoading(false);
        return;
    }
    
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
            const totalViews = vids.reduce((acc, curr) => acc + Number(curr.views), 0);
            setStats({ views: totalViews, uploads: vids.length });

            // 4. Check purchases & Subscription
            if (currentUser) {
                const checks = vids.map(v => db.hasPurchased(currentUser.id, v.id));
                const results = await Promise.all(checks);
                const p = vids.filter((_, i) => results[i]).map(v => v.id);
                setPurchases(p);
                
                const subStatus = await db.checkSubscription(currentUser.id, userId);
                setIsSubscribed(subStatus);
            }

        } catch (e) {
            console.error("Failed to load channel", e);
        } finally {
            setLoading(false);
        }
    };

    loadChannel();
  }, [userId, currentUser]);

  const toggleSubscribe = async () => {
      if (!currentUser || !userId) return;
      const oldState = isSubscribed;
      setIsSubscribed(!oldState); // Optimistic UI
      try {
          const res = await db.toggleSubscribe(currentUser.id, userId);
          setIsSubscribed(res.isSubscribed);
      } catch (e) { 
          setIsSubscribed(oldState); // Revert on error
          alert("Failed to subscribe"); 
      }
  };

  const handleDeleteVideo = async (videoId: string) => {
      if (!currentUser || !confirm("Permanently delete this video?")) return;
      try {
          await db.deleteVideo(videoId, currentUser.id);
          setVideos(prev => prev.filter(v => v.id !== videoId));
          setStats(prev => ({...prev, uploads: prev.uploads - 1}));
      } catch(e: any) {
          alert("Delete failed: " + e.message);
      }
  };

  const isUnlocked = (videoId: string, creatorId: string) => {
    return purchases.includes(videoId) || (currentUser?.id === creatorId);
  };

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;
  if (!channelUser) return <div className="text-center p-10 text-slate-500">User not found</div>;

  return (
    <div className="pb-20 min-h-screen">
       {/* Background Blur Effect */}
       <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden z-0 pointer-events-none opacity-40">
           {channelUser.avatarUrl && <img src={channelUser.avatarUrl} className="w-full h-full object-cover blur-3xl scale-110 brightness-50" />}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black"></div>
       </div>

       {/* Channel Header Info */}
       <div className="relative z-10 px-4 pt-20 flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* Avatar */}
           <div className="w-32 h-32 rounded-full border-4 border-black bg-slate-800 overflow-hidden shrink-0 shadow-2xl mb-4">
               {channelUser.avatarUrl ? (
                   <img src={channelUser.avatarUrl} alt={channelUser.username} className="w-full h-full object-cover" />
               ) : (
                   <div className="w-full h-full flex items-center justify-center text-4xl text-slate-500">
                       <UserIcon size={48} />
                   </div>
               )}
           </div>

           {/* Info */}
           <div className="text-center">
               <h1 className="text-3xl font-bold text-white mb-2">{channelUser.username}</h1>
               <div className="text-slate-400 text-sm flex items-center justify-center gap-3 mb-6">
                   <span>@{channelUser.username}</span>
                   <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                   <span>{stats.uploads} videos</span>
                   <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                   <span>{stats.views} views</span>
               </div>
               
               {currentUser?.id !== channelUser.id && (
                   <button 
                       onClick={toggleSubscribe}
                       className={`px-8 py-3 rounded-full font-bold text-sm transition-all transform active:scale-95 flex items-center gap-2 mx-auto ${isSubscribed ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-black hover:bg-slate-200'}`}
                   >
                       {isSubscribed ? (
                           <><Check size={18}/> Subscribed</>
                       ) : (
                           <><Bell size={18}/> Subscribe</>
                       )}
                   </button>
               )}
           </div>
       </div>

       {/* Videos Grid */}
       <div className="px-4 md:px-12 relative z-10">
           <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">Videos</h2>
           {videos.length === 0 ? (
               <div className="text-center py-20 text-slate-500">This user hasn't uploaded any videos yet.</div>
           ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                   {videos.map(video => (
                        <div key={video.id} className="relative group">
                            <VideoCard 
                                video={video} 
                                isUnlocked={isUnlocked(video.id, video.creatorId)}
                                isWatched={false} 
                            />
                            {(currentUser?.id === channelUser.id || currentUser?.role === 'ADMIN') && (
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteVideo(video.id); }} 
                                    className="absolute top-2 left-2 bg-red-600/80 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    title="Delete Video"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                   ))}
               </div>
           )}
       </div>
    </div>
  );
}