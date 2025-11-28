
import React, { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, MoreVertical, DollarSign, Send, X, Lock, Volume2, VolumeX, Smartphone, RefreshCw, Maximize, Minimize } from 'lucide-react';
import { db } from '../services/db';
import { Video, Comment, UserInteraction } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link } from '../components/Router';

// --- Individual Short Component ---

const ShortItem: React.FC<{ video: Video; isActive: boolean }> = ({ video, isActive }) => {
  const { user, refreshUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Default to sound ON
  const [purchasing, setPurchasing] = useState(false);
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>('cover');
  
  // Social State
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Load Interaction Data
  useEffect(() => {
    if (user) {
      db.getInteraction(user.id, video.id).then(setInteraction);
      db.hasPurchased(user.id, video.id).then(setIsUnlocked);
      db.getComments(video.id).then(setComments);
    }
  }, [user, video.id]);

  // Handle Play/Pause, Autoplay Policies, and Auto-Purchase
  useEffect(() => {
    // If not active, just pause and exit
    if (!isActive) {
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    const handleActiveVideo = async () => {
       if (!user) return;

       // 1. AUTO-PURCHASE LOGIC
       let currentUnlockedState = isUnlocked;

       // If locked, check if we can/should auto-buy
       if (!currentUnlockedState && !purchasing) {
           const canAfford = user.balance >= video.price;
           const withinLimit = video.price <= user.autoPurchaseLimit;

           if (canAfford && withinLimit) {
               setPurchasing(true);
               try {
                   await db.purchaseVideo(user.id, video.id);
                   refreshUser();
                   setIsUnlocked(true);
                   currentUnlockedState = true; // Mark as unlocked for playback logic below
               } catch (e) {
                   console.error("Auto-purchase failed", e);
               } finally {
                   setPurchasing(false);
               }
           }
       }

       // 2. PLAYBACK LOGIC
       if (videoRef.current && currentUnlockedState) {
          try {
             // Try to play with sound first
             videoRef.current.muted = false;
             setIsMuted(false);
             await videoRef.current.play();
          } catch (err) {
             // Autoplay with sound blocked by browser, fallback to muted
             console.warn("Autoplay audio blocked, retrying muted.");
             if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                try { await videoRef.current.play(); } catch (e) {}
             }
          }
       }
    };

    handleActiveVideo();

  }, [isActive, isUnlocked, user?.id]); // Re-run if active state or lock state changes

  // Actions
  const handlePurchase = async () => {
    if (!user) return;
    setPurchasing(true);
    try {
      await db.purchaseVideo(user.id, video.id);
      refreshUser();
      setIsUnlocked(true);
      // Force play after manual purchase
      if (videoRef.current) {
        videoRef.current.muted = false;
        setIsMuted(false);
        videoRef.current.play();
      }
    } catch (e) {
      alert("Insufficient funds or error.");
    } finally {
      setPurchasing(false);
    }
  };

  const toggleLike = async () => {
    if (!user) return;
    const res = await db.toggleLike(user.id, video.id, true);
    setInteraction(res);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFit = () => {
      setObjectFit(prev => prev === 'cover' ? 'contain' : 'cover');
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const c = await db.addComment(user.id, video.id, newComment);
    setComments(prev => [c, ...prev]);
    setNewComment('');
  };

  return (
    <div className="relative w-full h-[100dvh] md:h-full snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden">
      
      {/* Video Layer */}
      <div className="absolute inset-0 z-0 bg-black">
        {isUnlocked ? (
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            className={`w-full h-full object-${objectFit}`}
            loop
            playsInline
            muted={isMuted} // Controlled by state
            onClick={toggleMute}
          />
        ) : (
           <div className="w-full h-full relative">
              <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-sm brightness-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-white/10 text-center mx-4 max-w-sm w-full">
                    {purchasing ? (
                        <RefreshCw className="mx-auto text-indigo-400 mb-4 animate-spin" size={48} />
                    ) : (
                        <Lock size={48} className="mx-auto text-slate-300 mb-4" />
                    )}
                    
                    <h3 className="text-xl font-bold text-white mb-2">{purchasing ? 'Unlocking...' : 'Unlock Video'}</h3>
                    <p className="text-slate-300 mb-6 text-sm">
                        {purchasing ? 'Auto-purchasing content...' : `Support ${video.creatorName} to watch.`}
                    </p>
                    
                    {!purchasing && (
                        <button 
                        onClick={handlePurchase}
                        disabled={purchasing}
                        className="w-full bg-amber-400 hover:bg-amber-500 text-black font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-400/20"
                        >
                            <DollarSign size={20} /> Pay {video.price} Saldo
                        </button>
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-10" />

      {/* Mute Toggle (Top Right) */}
      {isUnlocked && (
        <button onClick={toggleMute} className="absolute top-20 right-4 z-30 bg-black/30 backdrop-blur-md p-2 rounded-full text-white">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}

      {/* Right Sidebar Controls */}
      <div className="absolute right-4 bottom-24 md:bottom-12 z-30 flex flex-col items-center gap-6 pb-4">
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={toggleLike}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/20 transition-all active:scale-90 ${interaction?.liked ? 'text-red-500' : 'text-white'}`}
          >
             <Heart size={28} fill={interaction?.liked ? "currentColor" : "none"} />
          </button>
          <span className="text-xs font-bold text-white shadow-black drop-shadow-md">
             {(video.likes || 0) + (interaction?.liked ? 1 : 0) - (interaction?.liked && video.likes > 0 ? 0 : 0)}
          </span>
        </div>

        {/* Comment */}
        <div className="flex flex-col items-center gap-1">
          <button 
             onClick={() => setShowComments(true)}
             className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/20 text-white transition-all active:scale-90"
          >
             <MessageCircle size={28} />
          </button>
          <span className="text-xs font-bold text-white shadow-black drop-shadow-md">{comments.length}</span>
        </div>

        {/* Fit / Adjust Video */}
        <button 
            onClick={toggleFit}
            className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/20 text-white transition-all active:scale-90"
        >
           {objectFit === 'cover' ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-[4.5rem] md:bottom-8 left-4 right-20 z-20 text-white">
         <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold border-2 border-white text-sm shadow-md">
               {video.creatorName[0]}
            </div>
            <span className="font-bold text-sm md:text-base drop-shadow-md">{video.creatorName}</span>
            <button className="text-xs bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-full font-medium ml-2 hover:bg-white/30 transition-colors">Follow</button>
         </div>
         <h2 className="text-sm md:text-lg leading-tight mb-2 drop-shadow-md font-semibold">{video.title}</h2>
         <p className="text-xs md:text-sm text-slate-200 line-clamp-2 opacity-90 drop-shadow-sm">{video.description}</p>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="absolute inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div 
             className="w-full bg-slate-900 rounded-t-2xl h-[75%] md:h-[60%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom duration-300"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                 <h3 className="font-bold text-white">Comments ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white p-2">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                       <MessageCircle size={32} className="mb-2 opacity-50"/>
                       <p className="text-sm">No comments yet.</p>
                    </div>
                 ) : (
                    comments.map(c => (
                      <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 border border-slate-700">
                           {c.username[0]}
                         </div>
                         <div>
                            <div className="flex items-baseline gap-2">
                               <span className="text-xs font-bold text-slate-300">{c.username}</span>
                               <span className="text-[10px] text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-200 mt-0.5">{c.text}</p>
                         </div>
                      </div>
                    ))
                 )}
              </div>

              <form onSubmit={postComment} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 pb-safe">
                 <input 
                   type="text" 
                   value={newComment}
                   onChange={e => setNewComment(e.target.value)}
                   className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                   placeholder="Add a comment..."
                 />
                 <button 
                   type="submit" 
                   disabled={!newComment.trim()}
                   className="bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    <Send size={16} />
                 </button>
              </form>
           </div>
           
           {/* Click outside to close */}
           <div className="absolute inset-0 -z-10" onClick={() => setShowComments(false)}></div>
        </div>
      )}

    </div>
  );
};

export default function Shorts() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Randomize videos for the feed feel
    db.getAllVideos().then(all => {
        setVideos(all.sort(() => Math.random() - 0.5));
    });
  }, []);

  // Track active video for autoplay
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      {videos.map((video, idx) => (
        <ShortItem key={video.id} video={video} isActive={idx === activeIndex} />
      ))}
      
      {videos.length === 0 && (
         <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <Smartphone size={48} className="opacity-50" />
            <p>No shorts available.</p>
            <Link to="/upload" className="text-indigo-400 hover:underline">Upload a video</Link>
         </div>
      )}
    </div>
  );
}
