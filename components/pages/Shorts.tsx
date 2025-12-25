import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Smartphone, RefreshCw, ThumbsDown, Plus, Check, Lock, DollarSign, Send, X, Loader2, ArrowLeft } from 'lucide-react';
import { db } from '../../services/db';
import { Video, Comment, UserInteraction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Link } from '../Router';

interface ShortItemProps {
  video: Video;
  isActive: boolean;
  shouldLoad: boolean;
  preload: "auto" | "none" | "metadata";
  hasFullAccess: boolean; 
}

const ShortItem = ({ video, isActive, shouldLoad, preload, hasFullAccess }: ShortItemProps) => {
  const { user, refreshUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isUnlocked, setIsUnlocked] = useState(hasFullAccess);
  const [isMuted, setIsMuted] = useState(false); // AUDIO POR DEFECTO
  const [purchasing, setPurchasing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Detector de Doble Toque
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    if (user && shouldLoad) {
      db.getInteraction(user.id, video.id).then(setInteraction);
      if (!hasFullAccess) {
          db.hasPurchased(user.id, video.id).then(setIsUnlocked);
      }
      if (isActive) {
          db.getComments(video.id).then(setComments);
          db.checkSubscription(user.id, video.creatorId).then(setIsSubscribed).catch(() => setIsSubscribed(false));
      }
    }
  }, [user, video.id, video.creatorId, shouldLoad, isActive, hasFullAccess]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive && isUnlocked) {
        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise
            .then(() => {
                setIsBuffering(false);
            })
            .catch(() => {
                // Si falla con audio, silenciamos y reintentamos (política de navegadores)
                el.muted = true;
                setIsMuted(true);
                el.play().catch(() => {});
            });
        }
    } else {
        el.pause();
        el.currentTime = 0; 
    }
  }, [isActive, isUnlocked]);

  const handleRate = async (rating: 'like' | 'dislike') => {
    if (!user) return;
    const res = await db.rateVideo(user.id, video.id, rating);
    setInteraction(res);
    if (res.newLikeCount !== undefined) setLikeCount(res.newLikeCount);
  };

  const handleScreenTouch = () => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          // DOUBLE TAP!
          if (!interaction?.liked) handleRate('like');
          setShowHeart(true);
          setTimeout(() => setShowHeart(false), 800);
      } else {
          toggleMute();
      }
      lastTapRef.current = now;
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
          alert("Link copiado!");
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

  if (!shouldLoad) return <div className="w-full h-full snap-start shrink-0 bg-black flex items-center justify-center relative"><Loader2 className="animate-spin text-slate-500" /></div>;

  return (
    <div className="relative w-full h-[100dvh] md:h-full snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden">
      <div className="absolute inset-0 z-0 bg-black" onClick={handleScreenTouch}>
        {isUnlocked ? (
          <>
            <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                className="w-full h-full object-cover"
                loop playsInline muted={isMuted} preload={preload} crossOrigin="anonymous"
            />
            {isBuffering && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="animate-spin text-white w-8 h-8" /></div>
            )}
            {showHeart && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in duration-300">
                    <Heart size={100} className="text-red-500 fill-red-500 drop-shadow-2xl" />
                </div>
            )}
          </>
        ) : (
           <div className="w-full h-full relative">
              <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-sm brightness-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-white/10 text-center mx-4 max-w-sm w-full">
                    <div className="text-4xl font-black text-amber-400 mb-2">{video.price} $</div>
                    <button onClick={() => handleRate('like')} className="w-full bg-white text-black font-bold py-3 rounded-full shadow-xl">Desbloquear</button>
                 </div>
              </div>
           </div>
        )}
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90 pointer-events-none z-10" />

      {isUnlocked && (
        <button onClick={toggleMute} className="absolute top-16 right-4 z-30 bg-black/40 backdrop-blur-md p-2 rounded-full text-white">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}

      <div className="absolute right-2 bottom-20 z-30 flex flex-col items-center gap-5 pb-safe">
        <Link to={`/channel/${video.creatorId}`} className="relative group mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-white p-0.5 overflow-hidden bg-black shadow-lg">
                {video.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">{video.creatorName[0]}</div>}
            </div>
            {!isSubscribed && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-full p-0.5 border border-black" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubscribe(); }}>
                    <Plus size={12} strokeWidth={4} />
                </div>
            )}
        </Link>

        <div className="flex flex-col items-center gap-1">
          <button onClick={() => handleRate('like')} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 ${interaction?.liked ? 'text-red-500' : 'text-white'}`}>
             <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">{likeCount}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button onClick={() => setShowComments(true)} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <MessageCircle size={26} fill="white" fillOpacity={0.2} />
          </button>
          <span className="text-xs font-bold text-white drop-shadow-md">{comments.length}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button onClick={handleShare} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <Share2 size={26} fill="white" fillOpacity={0.2} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-3 right-16 z-20 text-white flex flex-col items-start pointer-events-none pb-safe">
         <div className="pointer-events-auto w-full">
             <Link to={`/channel/${video.creatorId}`} className="font-bold text-base drop-shadow-md hover:underline">@{video.creatorName}</Link>
             <h2 className="text-sm font-semibold leading-tight mb-1 drop-shadow-md">{video.title}</h2>
             <p className="text-xs text-slate-100 line-clamp-2 opacity-90 drop-shadow-sm font-medium">{video.description}</p>
         </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full bg-slate-900 rounded-t-2xl h-[65%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                 <h3 className="font-bold text-white">Comentarios ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 bg-slate-800 p-1.5 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 border border-slate-700 overflow-hidden">
                           {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{c.username[0]}</div>}
                         </div>
                         <div>
                            <div className="flex items-baseline gap-2">
                               <span className="text-xs font-bold text-slate-400">{c.username}</span>
                               <span className="text-[10px] text-slate-600">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-200 mt-0.5">{c.text}</p>
                         </div>
                      </div>
                 ))}
              </div>
              <form onSubmit={postComment} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 pb-safe">
                 <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none" placeholder="Añadir comentario..." />
                 <button type="submit" disabled={!newComment.trim()} className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50"><Send size={18} /></button>
              </form>
           </div>
           <div className="absolute inset-0 -z-10" onClick={() => setShowComments(false)}></div>
        </div>
      )}
    </div>
  );
};

export default function Shorts() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    db.getAllVideos().then((all: Video[]) => {
        const shorts = all.filter(v => v.duration < 180).sort(() => Math.random() - 0.5);
        setVideos(shorts);
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Number((entry.target as HTMLElement).dataset.index);
                if (!isNaN(index)) setActiveIndex(index);
            }
        });
    }, { root: container, threshold: 0.5 });

    Array.from(container.children).forEach((child) => observer.observe(child as Element));
    return () => observer.disconnect();
  }, [videos]);

  const hasFullAccess = useMemo(() => {
      if (!user) return false;
      const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
      const isVipActive = user.vipExpiry && user.vipExpiry > (Date.now() / 1000);
      return Boolean(isAdmin || isVipActive);
  }, [user]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide relative" style={{ scrollBehavior: 'smooth' }}>
      <div className="fixed top-4 left-4 z-50">
          <Link to="/" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white"><ArrowLeft size={24} /></Link>
      </div>
      {videos.map((video, idx) => (
        <div key={video.id} data-index={idx} className="w-full h-full snap-start">
             <ShortItem video={video} isActive={idx === activeIndex} shouldLoad={Math.abs(idx - activeIndex) <= 2} preload={idx === activeIndex ? "auto" : "metadata"} hasFullAccess={hasFullAccess} />
        </div>
      ))}
    </div>
  );
}
