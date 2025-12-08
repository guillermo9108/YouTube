
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Smartphone, RefreshCw, ThumbsDown, Plus, Check, Lock, DollarSign, Send, X, Loader2, ArrowLeft } from 'lucide-react';
import { db } from '../services/db';
import { Video, Comment, UserInteraction } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from '../components/Router';

// --- Individual Short Component ---

interface ShortItemProps {
  video: Video;
  isActive: boolean;
  shouldLoad: boolean; // TRUE only for current, prev, next
  preload: "auto" | "none" | "metadata";
  toggleMute: () => void;
  isMuted: boolean;
}

// MEMOIZED COMPONENT: This stops the entire list from re-rendering when you scroll 1px
const ShortItem = React.memo(({ video, isActive, shouldLoad, preload, toggleMute, isMuted }: ShortItemProps) => {
  const { user, refreshUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Social State
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Load Interaction Data only when item is close to viewport
  useEffect(() => {
    if (user && shouldLoad) {
      db.getInteraction(user.id, video.id).then(setInteraction);
      db.hasPurchased(user.id, video.id).then(setIsUnlocked);
      // Lazy load comments and sub status
      if (isActive) {
          db.getComments(video.id).then(setComments);
          db.checkSubscription(user.id, video.creatorId).then(setIsSubscribed).catch(() => setIsSubscribed(false));
      }
    }
  }, [user, video.id, video.creatorId, shouldLoad, isActive]);

  // Handle Play/Pause & Cleanup
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Sync Mute State
    el.muted = isMuted;

    if (isActive) {
        // Active Slide
        if (isUnlocked) {
            const playPromise = el.play();
            if (playPromise !== undefined) {
                playPromise
                .then(() => {
                    setIsBuffering(false);
                })
                .catch(() => {
                    // Autoplay blocked, mute and retry handled by parent or user interaction
                    el.play().catch(() => {});
                });
            }
        }
    } else {
        // Inactive Slide
        el.pause();
        el.currentTime = 0; // Reset to start
    }
    
    // Strict Cleanup for MEMORY, but loosely for DOM
    // Only remove src if we are REALLY far away
    return () => {
        if (!shouldLoad && el) {
            el.pause();
            el.removeAttribute('src'); // Force drop buffer
            el.load();
        }
    };
  }, [isActive, isUnlocked, shouldLoad, isMuted]);

  // Actions
  const handlePurchase = async () => {
    if (!user) return;
    setPurchasing(true);
    try {
      await db.purchaseVideo(user.id, video.id);
      refreshUser();
      setIsUnlocked(true);
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

  const handleSubscribe = async () => {
      if (!user) return;
      const oldState = isSubscribed;
      setIsSubscribed(!oldState); 
      try {
          const res = await db.toggleSubscribe(user.id, video.creatorId);
          setIsSubscribed(res.isSubscribed);
      } catch (e) {
          setIsSubscribed(oldState); 
      }
  };

  const handleShare = async () => {
      const url = `${window.location.origin}/#/watch/${video.id}`;
      if (navigator.share) {
          try { await navigator.share({ title: video.title, text: video.description, url }); } catch(e) {}
      } else {
          navigator.clipboard.writeText(url);
          alert("Link copied!");
      }
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const c = await db.addComment(user.id, video.id, newComment);
    setComments(prev => [c, ...prev]);
    setNewComment('');
  };

  // If not in window, render placeholder to keep scroll height correct but save memory
  if (!shouldLoad) {
      return (
          <div className="w-full h-full snap-start snap-always shrink-0 bg-black flex items-center justify-center relative">
              <img src={video.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md" />
              <Loader2 className="animate-spin text-slate-500" />
          </div>
      );
  }

  return (
    <div className="relative w-full h-[100dvh] md:h-full snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden video-container">
      
      {/* Video Layer */}
      <div className="absolute inset-0 z-0 bg-black" onClick={toggleMute}>
        {isUnlocked ? (
          <>
            <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                className="w-full h-full object-cover"
                loop
                playsInline
                preload={preload}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onTimeUpdate={(e) => { 
                    if (e.currentTarget.currentTime / e.currentTarget.duration > 0.30 && interaction && !interaction.isWatched && user) { 
                        db.markWatched(user.id, video.id); 
                        setInteraction({...interaction, isWatched: true}); 
                    } 
                }} 
            />
            {isBuffering && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/20 backdrop-blur-sm p-4 rounded-full">
                        <Loader2 className="animate-spin text-white w-8 h-8" />
                    </div>
                </div>
            )}
          </>
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
                        onClick={(e) => { e.stopPropagation(); handlePurchase(); }}
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
      
      {/* Gradients for Visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none z-10" />
      <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-black/40 to-transparent pointer-events-none z-10" />

      {/* Side Actions (Right Sidebar) */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-6 pb-safe">
        
        {/* Avatar / Subscribe */}
        <div className="relative group mb-2">
            <Link to={`/channel/${video.creatorId}`}>
                <div className="w-12 h-12 rounded-full border-2 border-white p-0.5 overflow-hidden bg-black transition-transform active:scale-90 shadow-lg">
                    {video.creatorAvatarUrl ? (
                        <img src={video.creatorAvatarUrl} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">{video.creatorName[0]}</div>
                    )}
                </div>
            </Link>
            {!isSubscribed && (
                <button 
                    onClick={handleSubscribe} 
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-full p-1 border border-black shadow-sm transform transition-transform active:scale-90"
                >
                    <Plus size={10} strokeWidth={4} />
                </button>
            )}
        </div>

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => handleRate('like')} className="group flex flex-col items-center">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/20 border border-white/10 transition-all active:scale-90 ${interaction?.liked ? 'text-red-500 bg-black/40' : 'text-white'}`}>
                <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} strokeWidth={interaction?.liked ? 0 : 2} className="drop-shadow-sm"/>
             </div>
             <span className="text-xs font-bold text-white drop-shadow-md mt-1">{likeCount}</span>
          </button>
        </div>

        {/* Comment */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => setShowComments(true)} className="group flex flex-col items-center">
             <div className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/20 border border-white/10 text-white transition-all active:scale-90">
                <MessageCircle size={26} fill="white" fillOpacity={0.2} className="drop-shadow-sm"/>
             </div>
             <span className="text-xs font-bold text-white drop-shadow-md mt-1">{comments.length}</span>
          </button>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={handleShare} className="group flex flex-col items-center">
             <div className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/20 border border-white/10 text-white transition-all active:scale-90">
                <Share2 size={26} fill="white" fillOpacity={0.2} className="drop-shadow-sm"/>
             </div>
             <span className="text-[10px] font-bold text-white drop-shadow-md mt-1">Share</span>
          </button>
        </div>

        {/* Mute (in stack now for better thumb reach) */}
        {isUnlocked && (
            <button onClick={toggleMute} className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/20 border border-white/10 text-white/80 hover:bg-black/40 transition-all active:scale-90 mt-2">
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
        )}
      </div>

      {/* Metadata (Bottom Left) */}
      <div className="absolute bottom-0 left-0 right-16 z-20 text-white flex flex-col items-start text-left pointer-events-none pb-24 px-4 bg-gradient-to-t from-black/80 to-transparent pt-12">
         <div className="pointer-events-auto w-full max-w-[80%]">
             <div className="flex items-center gap-2 mb-2">
                <Link to={`/channel/${video.creatorId}`} className="font-bold text-base text-white drop-shadow-md hover:underline flex items-center gap-1">
                    @{video.creatorName}
                    {isSubscribed && <Check size={12} className="text-emerald-400 stroke-[4px]"/>}
                </Link>
             </div>
             
             <h2 className="text-sm font-medium leading-tight mb-2 drop-shadow-md line-clamp-2">{video.title}</h2>
             
             {video.description && (
                 <p className="text-xs text-slate-200 line-clamp-1 opacity-90 font-light">{video.description}</p>
             )}
         </div>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full bg-slate-900 rounded-t-2xl h-[65%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                 <h3 className="font-bold text-white">Comments ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {comments.map(c => (
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
                 ))}
              </div>
              <form onSubmit={postComment} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 pb-safe">
                 <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Add a comment..." />
                 <button type="submit" disabled={!newComment.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"><Send size={18} /></button>
              </form>
           </div>
           <div className="absolute inset-0 -z-10" onClick={() => setShowComments(false)}></div>
        </div>
      )}

    </div>
  );
}, (prev, next) => {
    // Only re-render if:
    // 1. It becomes active or inactive
    // 2. It needs to load or unload
    // 3. The video ID changed (data update)
    // 4. Mute state changes (global)
    return (
        prev.isActive === next.isActive &&
        prev.shouldLoad === next.shouldLoad &&
        prev.video.id === next.video.id &&
        prev.isMuted === next.isMuted
    );
});

export default function Shorts() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const navigate = useNavigate();
  
  // Initialize
  useEffect(() => {
    // Attempt to get cached videos first for instant load
    const cached = localStorage.getItem('sp_cache_get_videos');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed.data) {
                 const shorts = (parsed.data as Video[]).filter(v => v.duration < 180).sort(() => Math.random() - 0.5);
                 setVideos(shorts);
            }
        } catch(e) {}
    }

    db.getAllVideos().then(all => {
        const shorts = all.filter(v => v.duration < 180).sort(() => Math.random() - 0.5);
        setVideos(prev => (prev.length === 0 ? shorts : prev));
    });
  }, []);

  // Optimized Intersection Observer for Slide Detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Number((entry.target as HTMLElement).dataset.index);
                if (!isNaN(index)) {
                     setActiveIndex(index);
                }
            }
        });
    }, {
        root: container,
        threshold: 0.55
    });

    Array.from(container.children).forEach((child) => observer.observe(child as Element));

    return () => observer.disconnect();
  }, [videos]);

  const toggleMuteGlobal = () => setIsMuted(prev => !prev);

  const handleBack = () => {
      navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
        
        {/* GLOBAL HEADER */}
        <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-start pointer-events-none safe-area-top pt-safe">
            <button onClick={handleBack} className="pointer-events-auto bg-black/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/40 transition-colors border border-white/10 active:scale-90">
                <ArrowLeft size={24} />
            </button>
        </div>

        <div 
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide relative"
        style={{ scrollBehavior: 'smooth' }}
        >
        {videos.map((video, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const shouldLoad = distance <= 2; 
            const isActive = idx === activeIndex;
            const isNext = idx === activeIndex + 1;
            const preloadStrategy = isActive ? "auto" : (isNext ? "metadata" : "none");

            return (
                <div key={video.id} data-index={idx} className="w-full h-full snap-start snap-always">
                    <ShortItem 
                        video={video} 
                        isActive={isActive} 
                        shouldLoad={shouldLoad}
                        preload={preloadStrategy}
                        isMuted={isMuted}
                        toggleMute={toggleMuteGlobal}
                    />
                </div>
            );
        })}
        
        {videos.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <Smartphone size={48} className="opacity-50" />
                <p>No shorts available.</p>
                <Link to="/upload" className="text-indigo-400 hover:underline">Upload a video</Link>
            </div>
        )}
        </div>
    </div>
  );
}
