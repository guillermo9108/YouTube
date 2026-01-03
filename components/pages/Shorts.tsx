
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Smartphone, RefreshCw, ThumbsDown, Plus, Check, Lock, DollarSign, Send, X, Loader2, ArrowLeft, Play, Pause } from 'lucide-react';
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
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimerRef = useRef<number | null>(null);
  
  const [isUnlocked, setIsUnlocked] = useState(hasFullAccess);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [paused, setPaused] = useState(false);
  
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isSubscribed, setIsSubscribed] = useState(false);

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
        el.currentTime = 0;
        setPaused(false);
        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    } else {
        el.pause();
    }
  }, [isActive, isUnlocked]);

  const handleRate = async (rating: 'like' | 'dislike') => {
    if (!user) return;
    try {
        const res = await db.rateVideo(user.id, video.id, rating);
        setInteraction(res);
        if (res.newLikeCount !== undefined) setLikeCount(res.newLikeCount);
    } catch(e) {}
  };

  const handleScreenTouch = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Lógica para detectar doble toque sin interferir con el simple toque
    if (clickTimerRef.current) {
        // DOBLE TOQUE DETECTADO
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        
        handleRate('like');
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
    } else {
        // POSIBLE SIMPLE TOQUE
        clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            if (videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play();
                    setPaused(false);
                } else {
                    videoRef.current.pause();
                    setPaused(true);
                }
            }
        }, 250);
    }
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
                loop playsInline preload={preload} crossOrigin="anonymous"
            />
            {isBuffering && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="animate-spin text-white w-8 h-8" /></div>
            )}
            {paused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/50">
                    <Pause size={64} fill="currentColor" />
                </div>
            )}
            {showHeart && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in fade-in duration-300">
                    <Heart size={120} className="text-red-500 fill-red-500 drop-shadow-2xl" />
                </div>
            )}
          </>
        ) : (
           <div className="w-full h-full relative">
              <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-sm brightness-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-white/10 text-center mx-4 max-w-sm w-full">
                    <div className="text-4xl font-black text-amber-400 mb-2">{video.price} $</div>
                    <button onClick={() => db.purchaseVideo(user!.id, video.id).then(()=>setIsUnlocked(true))} className="w-full bg-white text-black font-bold py-3 rounded-full shadow-xl">Desbloquear</button>
                 </div>
              </div>
           </div>
        )}
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-10" />

      {/* Acciones en Columna (Derecha) */}
      <div className="absolute right-2 bottom-20 z-30 flex flex-col items-center gap-5 pb-safe">
        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleRate('like'); }} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 ${interaction?.liked ? 'text-red-500' : 'text-white'}`}>
             <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">{likeCount}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleRate('dislike'); }} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 ${interaction?.disliked ? 'text-red-400' : 'text-white'}`}>
             <ThumbsDown size={26} fill={interaction?.disliked ? "currentColor" : "white"} fillOpacity={interaction?.disliked ? 1 : 0.2} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <MessageCircle size={26} fill="white" fillOpacity={0.2} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">{comments.length}</span>
        </div>

        <button onClick={(e) => { e.stopPropagation(); if(navigator.share) navigator.share({title: video.title, url: window.location.href}); }} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <Share2 size={26} fill="white" fillOpacity={0.2} />
        </button>
      </div>

      {/* Perfil e Info (Esquina Inferior Izquierda - Estilo FB/TikTok) */}
      <div className="absolute bottom-6 left-3 right-16 z-30 text-white flex flex-col gap-3 pointer-events-none pb-safe">
         <div className="flex items-center gap-3 pointer-events-auto">
            <Link to={`/channel/${video.creatorId}`} className="relative shrink-0">
                <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-slate-800 shadow-xl">
                    {video.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-indigo-600">{video.creatorName[0]}</div>}
                </div>
                {!isSubscribed && (
                    <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-black" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubscribe(); }}>
                        <Plus size={10} strokeWidth={4} />
                    </div>
                )}
            </Link>
            <div className="min-w-0">
                <Link to={`/channel/${video.creatorId}`} className="font-black text-sm drop-shadow-md hover:underline truncate block">@{video.creatorName}</Link>
                <div className="flex items-center gap-2">
                    <button className="bg-white/10 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white">Seguir</button>
                </div>
            </div>
         </div>

         <div className="pointer-events-auto">
             <h2 className="text-xs font-bold leading-tight mb-1 drop-shadow-md uppercase italic">{video.title}</h2>
             <p className="text-[10px] text-slate-200 line-clamp-2 opacity-80 drop-shadow-sm font-medium">{video.description}</p>
         </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full bg-slate-900 rounded-t-3xl h-[70%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                 <h3 className="font-black text-white uppercase text-xs tracking-widest">Conversación ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 bg-slate-800 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {comments.length === 0 ? <p className="text-center text-slate-600 py-20 italic uppercase text-[10px] font-bold tracking-widest">No hay comentarios aún</p> : comments.map(c => (
                      <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                         <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 border border-slate-700 overflow-hidden">
                           {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{c.username[0]}</div>}
                         </div>
                         <div>
                            <div className="flex items-baseline gap-2">
                               <span className="text-xs font-black text-slate-300">@{c.username}</span>
                               <span className="text-[8px] text-slate-600 uppercase font-bold">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{c.text}</p>
                         </div>
                      </div>
                 ))}
              </div>
              <form onSubmit={postComment} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 pb-safe">
                 <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all" placeholder="Escribe un comentario..." />
                 <button type="submit" disabled={!newComment.trim()} className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 shadow-lg active:scale-90 transition-all"><Send size={18} /></button>
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
        // Filtramos shorts (menos de 3 min) y mezclamos aleatoriamente
        const shorts = all.filter(v => v.duration < 180 && v.category !== 'PENDING' && v.category !== 'PROCESSING').sort(() => Math.random() - 0.5);
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
          <Link to="/" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center active:scale-90 transition-all"><ArrowLeft size={24} /></Link>
      </div>
      {videos.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={32}/>
              <p className="font-black uppercase text-[10px] tracking-widest italic opacity-50">Sintonizando contenido...</p>
          </div>
      ) : videos.map((video, idx) => (
        <div key={video.id} data-index={idx} className="w-full h-full snap-start">
             <ShortItem video={video} isActive={idx === activeIndex} shouldLoad={Math.abs(idx - activeIndex) <= 2} preload={idx === activeIndex ? "auto" : "metadata"} hasFullAccess={hasFullAccess} />
        </div>
      ))}
    </div>
  );
}
