
import React, { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Smartphone, RefreshCw, ThumbsDown, UserPlus, Check, Lock, DollarSign, Send, X, Plus } from 'lucide-react';
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
  
  // Social State
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isSubscribed, setIsSubscribed] = useState(false); // Visual Only State

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
    if (!isActive) {
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    const handleActiveVideo = async () => {
       if (!user) return;

       let currentUnlockedState = isUnlocked;

       // Auto-Purchase Logic
       if (!currentUnlockedState && !purchasing) {
           const canAfford = user.balance >= video.price;
           const withinLimit = video.price <= user.autoPurchaseLimit;

           if (canAfford && withinLimit) {
               setPurchasing(true);
               try {
                   await db.purchaseVideo(user.id, video.id);
                   refreshUser();
                   setIsUnlocked(true);
                   currentUnlockedState = true;
               } catch (e) {
                   console.error("Auto-purchase failed", e);
               } finally {
                   setPurchasing(false);
               }
           }
       }

       // Playback Logic
       if (videoRef.current && currentUnlockedState) {
          try {
             videoRef.current.muted = false;
             setIsMuted(false);
             await videoRef.current.play();
          } catch (err) {
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

  }, [isActive, isUnlocked, user?.id]);

  // Actions
  const handlePurchase = async () => {
    if (!user) return;
    setPurchasing(true);
    try {
      await db.purchaseVideo(user.id, video.id);
      refreshUser();
      setIsUnlocked(true);
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

  const handleRate = async (rating: 'like' | 'dislike') => {
    if (!user) return;
    const res = await db.rateVideo(user.id, video.id, rating);
    setInteraction(res);
    if (res.newLikeCount !== undefined) setLikeCount(res.newLikeCount);
  };

  const handleShare = async () => {
      const url = `${window.location.origin}/#/watch/${video.id}`;
      if (navigator.share) {
          try { await navigator.share({ title: video.title, text: video.description, url }); } catch(e) {}
      } else {
          navigator.clipboard.writeText(url);
          alert("Link copied to clipboard!");
      }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
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
            className="w-full h-full object-cover"
            loop
            playsInline
            muted={isMuted}
            onClick={toggleMute}
            onTimeUpdate={(e) => { 
                if (e.currentTarget.currentTime / e.currentTarget.duration > 0.30 && interaction && !interaction.isWatched && user) { 
                    db.markWatched(user.id, video.id); 
                    setInteraction({...interaction, isWatched: true}); 
                } 
            }} 
          />
        ) : (
           <div className="w-full h-full relative">
              <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-sm brightness-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-white/10 text-center mx-4 max-w-sm w-full">
                    {purchasing ? (
                        <RefreshCw className="mx-auto text-indigo-400 mb-4 animate-spin" size={48} />
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="text-4xl font-black text-amber-400 mb-2">{video.price}</div>
                            <div className="text-xs uppercase font-bold text-amber-200 tracking-widest mb-6">Saldo Required</div>
                        </div>
                    )}
                    
                    {!purchasing && (
                        <button 
                        onClick={handlePurchase}
                        disabled={purchasing}
                        className="w-full bg-white text-black font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl"
                        >
                            Unlock Now
                        </button>
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>
      
      {/* Cinematic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90 pointer-events-none z-10" />

      {/* Header Controls (Mute) */}
      {isUnlocked && (
        <button onClick={toggleMute} className="absolute top-16 right-4 z-30 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition-colors">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}

      {/* RIGHT ACTION BAR */}
      <div className="absolute right-2 bottom-20 z-30 flex flex-col items-center gap-5 pb-safe">
        
        {/* Avatar - Moved here for easier thumb access */}
        <Link to={`/channel/${video.creatorId}`} className="relative group mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-white p-0.5 overflow-hidden bg-black transition-transform active:scale-90 shadow-lg">
                {video.creatorAvatarUrl ? (
                    <img src={video.creatorAvatarUrl} className="w-full h-full rounded-full object-cover" />
                ) : (
                    <div className="w-full h-full rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">{video.creatorName[0]}</div>
                )}
            </div>
            {!isSubscribed && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-full p-0.5 border border-black shadow-sm transform scale-110" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSubscribed(true); }}>
                    <Plus size={12} strokeWidth={4} />
                </div>
            )}
        </Link>

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => handleRate('like')}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 transition-all active:scale-90 ${interaction?.liked ? 'text-red-500' : 'text-white'}`}
          >
             <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} strokeWidth={interaction?.liked ? 0 : 2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">{likeCount}</span>
        </div>

        {/* Dislike */}
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => handleRate('dislike')}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 transition-all active:scale-90 ${interaction?.disliked ? 'text-red-500' : 'text-white'}`}
          >
             <ThumbsDown size={26} fill={interaction?.disliked ? "currentColor" : "white"} fillOpacity={interaction?.disliked ? 1 : 0.2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">Dislike</span>
        </div>

        {/* Comment */}
        <div className="flex flex-col items-center gap-1">
          <button 
             onClick={() => setShowComments(true)}
             className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white transition-all active:scale-90"
          >
             <MessageCircle size={26} fill="white" fillOpacity={0.2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">{comments.length}</span>
        </div>

        {/* Share (NEW) */}
        <div className="flex flex-col items-center gap-1">
          <button 
             onClick={handleShare}
             className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white transition-all active:scale-90"
          >
             <Share2 size={26} fill="white" fillOpacity={0.2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">Share</span>
        </div>
      </div>

      {/* LEFT METADATA */}
      <div className="absolute bottom-4 left-3 right-16 z-20 text-white flex flex-col items-start text-left pointer-events-none pb-safe">
         
         <div className="pointer-events-auto w-full">
             {/* Creator & Subscribe Row */}
             <div className="flex items-center gap-3 mb-2">
                <Link to={`/channel/${video.creatorId}`} className="font-bold text-base md:text-lg drop-shadow-md hover:underline">@{video.creatorName}</Link>
                <button 
                    onClick={() => setIsSubscribed(!isSubscribed)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${isSubscribed ? 'bg-transparent text-white/80 border-white/40' : 'bg-red-600 text-white border-transparent'}`}
                >
                   {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
             </div>

             {/* Title & Description */}
             <h2 className="text-sm md:text-base font-semibold leading-tight mb-1 drop-shadow-md">{video.title}</h2>
             <p className="text-xs md:text-sm text-slate-100 line-clamp-2 opacity-90 drop-shadow-sm font-medium pr-4">{video.description}</p>
         </div>
      </div>

      {/* Comments Drawer (Fixed Overlay) */}
      {showComments && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div 
             className="w-full bg-slate-900 rounded-t-2xl h-[65%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom duration-300"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                 <h3 className="font-bold text-white">Comments ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                       <MessageCircle size={32} className="mb-2 opacity-50"/>
                       <p className="text-sm">Be the first to comment.</p>
                    </div>
                 ) : (
                    comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                         <Link to={`/channel/${c.userId}`} className="w-8 h-8 rounded-full bg-slate-800 shrink-0 border border-slate-700 overflow-hidden">
                           {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{c.username[0]}</div>}
                         </Link>
                         <div>
                            <div className="flex items-baseline gap-2">
                               <Link to={`/channel/${c.userId}`} className="text-xs font-bold text-slate-400 hover:text-white">{c.username}</Link>
                               <span className="text-[10px] text-slate-600">{new Date(c.timestamp).toLocaleDateString()}</span>
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
                   className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                   placeholder="Add a comment..."
                 />
                 <button 
                   type="submit" 
                   disabled={!newComment.trim()}
                   className="bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"
                 >
                    <Send size={18} />
                 </button>
              </form>
           </div>
           
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
    db.getAllVideos().then(all => {
        // Shuffle and filter
        setVideos(all.filter(v => v.duration < 600).sort(() => Math.random() - 0.5));
    });
  }, []);

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
