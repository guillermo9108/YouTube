import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Share2, ThumbsDown, Send, X, Loader2, ArrowLeft, Pause, Search, UserCheck } from 'lucide-react';
import { db } from '../../services/db';
import { Video, Comment, UserInteraction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Link } from '../Router';
import { useToast } from '../../context/ToastContext';

interface ShortItemProps {
  video: Video;
  isActive: boolean;
  isNear: boolean;
  onOpenShare: (v: Video) => void;
}

const ShortItem = ({ video, isActive, isNear, onOpenShare }: ShortItemProps) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimerRef = useRef<number | null>(null);
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [paused, setPaused] = useState(false);
  
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const [likeCount, setLikeCount] = useState(Number(video.likes || 0));
  const [dislikeCount, setDislikeCount] = useState(Number(video.dislikes || 0));
  const [dataLoaded, setDataLoaded] = useState(false);

  // Validación de Acceso Inteligente (Respetando restricción de Administrador)
  useEffect(() => {
    if (!user) return;
    
    const checkAccess = async () => {
        const isAdmin = user.role?.trim().toUpperCase() === 'ADMIN';
        const isCreator = String(user.id) === String(video.creatorId);
        const isVipActive = !!(user.vipExpiry && Number(user.vipExpiry) > Date.now() / 1000);
        
        // REGLA VIP: Acceso gratis solo si el video es de un Administrador
        const hasVipAccessToAdmin = isVipActive && video.creatorRole?.trim().toUpperCase() === 'ADMIN';

        if (isAdmin || isCreator || hasVipAccessToAdmin) {
            setIsUnlocked(true);
        } else {
            const purchased = await db.hasPurchased(user.id, video.id);
            setIsUnlocked(purchased);
        }
    };
    checkAccess();
  }, [user, video.id]);

  useEffect(() => {
    setLikeCount(Number(video.likes || 0));
    setDislikeCount(Number(video.dislikes || 0));
    
    if (user && isNear && !dataLoaded) {
      db.getInteraction(user.id, video.id).then(setInteraction);
      db.getComments(video.id).then(setComments);
      setDataLoaded(true);
    }
  }, [user, video.id, isNear, video.likes, video.dislikes]);

  useEffect(() => {
    const el = videoRef.current; if (!el) return;
    if (isActive && isUnlocked) {
        el.currentTime = 0; 
        setPaused(false);
        el.muted = false; 
        el.play().catch(() => {
            el.muted = true;
            el.play().catch(() => {});
        });
        db.incrementView(video.id);
    } else { 
        try {
            el.pause(); 
        } catch (e) {}
    }
  }, [isActive, isUnlocked, video.id]);

  const handleRate = async (rating: 'like' | 'dislike') => {
    if (!user) return;
    try {
        const res = await db.rateVideo(user.id, video.id, rating);
        setInteraction(res); 
        if (res.newLikeCount !== undefined) setLikeCount(res.newLikeCount);
        if (res.newDislikeCount !== undefined) setDislikeCount(res.newDislikeCount);
    } catch(e) {}
  };

  const handleScreenTouch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current); clickTimerRef.current = null;
        handleRate('like'); setShowHeart(true); setTimeout(() => setShowHeart(false), 800);
    } else {
        clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            if (videoRef.current) {
                if (videoRef.current.paused) { 
                    videoRef.current.play().catch(() => {}); 
                    setPaused(false); 
                } else { 
                    videoRef.current.pause(); 
                    setPaused(true); 
                }
            }
        }, 250);
    }
  };

  const videoSrc = useMemo(() => {
    const token = localStorage.getItem('sp_session_token') || '';
    const base = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
    return `${window.location.origin}/${base}&token=${token}`;
  }, [video.id]);

  if (!isNear) return <div className="w-full h-full snap-start bg-black shrink-0 flex items-center justify-center"><Loader2 className="animate-spin text-slate-800" /></div>;

  return (
    <div className="relative w-full h-[100dvh] md:h-full snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden">
      <div className="absolute inset-0 z-0 bg-black" onClick={handleScreenTouch}>
        {isUnlocked ? (
          <>
            <video
                ref={videoRef} src={videoSrc} poster={video.thumbnailUrl}
                className="w-full h-full object-cover" loop playsInline preload="auto" crossOrigin="anonymous"
            />
            {paused && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/50"><Pause size={64} fill="currentColor" /></div>}
            {showHeart && <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in fade-in duration-300"><Heart size={120} className="text-red-500 fill-red-500 drop-shadow-2xl" /></div>}
          </>
        ) : (
           <div className="w-full h-full relative">
              <img src={video.thumbnailUrl} className="w-full h-full object-cover blur-sm brightness-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-6 text-center">
                 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 max-w-sm w-full">
                    <div className="text-4xl font-black text-amber-400 mb-2">{video.price} $</div>
                    <button onClick={() => db.purchaseVideo(user!.id, video.id).then(()=>setIsUnlocked(true))} className="w-full bg-white text-black font-black py-4 rounded-full shadow-xl uppercase tracking-widest text-xs">Desbloquear Short</button>
                 </div>
              </div>
           </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-10" />
      
      <div className="absolute right-2 bottom-24 z-30 flex flex-col items-center gap-5 pb-safe">
        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleRate('like'); }} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 transition-colors ${interaction?.liked ? 'text-red-500' : 'text-white'}`}>
             <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">{likeCount}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleRate('dislike'); }} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 transition-colors ${interaction?.disliked ? 'text-red-500' : 'text-white'}`}>
             <ThumbsDown size={26} fill={interaction?.disliked ? "currentColor" : "white"} fillOpacity={interaction?.disliked ? 1 : 0.2} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">{dislikeCount > 0 ? dislikeCount : 'NO'}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <MessageCircle size={26} fill="white" fillOpacity={0.2} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">{comments.length}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onOpenShare(video); }} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white"><Share2 size={26} fill="white" fillOpacity={0.2} /></button>
      </div>

      <div className="absolute bottom-10 left-3 right-16 z-30 text-white flex flex-col gap-3 pointer-events-none pb-safe">
         <div className="flex items-center gap-3 pointer-events-auto">
            <Link to={`/channel/${video.creatorId}`} className="relative shrink-0">
                <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-slate-800 shadow-xl">
                    {video.creatorAvatarUrl ? <img src={video.creatorAvatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-indigo-600">{video.creatorName?.[0] || '?'}</div>}
                </div>
            </Link>
            <div className="min-w-0">
                <Link to={`/channel/${video.creatorId}`} className="font-black text-sm drop-shadow-md hover:underline truncate block">@{video.creatorName || 'Usuario'}</Link>
                <div className="text-[9px] text-white/60 uppercase font-black tracking-widest">{video.creatorRole === 'ADMIN' ? 'Oficial' : 'Verificado'}</div>
            </div>
         </div>
         <div className="pointer-events-auto"><h2 className="text-xs font-bold leading-tight mb-1 drop-shadow-md uppercase italic">{video.title}</h2></div>
      </div>
    </div>
  );
};

export default function Shorts() {
  const { user } = useAuth();
  const toast = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const fetchShorts = async (p: number) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
        const more = await db.getShorts(p, 15);
        if (more.length === 0) setHasMore(false);
        else { setVideos(prev => [...prev, ...more]); setPage(p); }
    } catch(e) { setHasMore(false); } finally { setLoading(false); }
  };

  useEffect(() => { fetchShorts(0); }, []);

  useEffect(() => {
    const container = containerRef.current; if (!container || videos.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Number((entry.target as HTMLElement).dataset.index);
                if (!isNaN(index)) {
                    setActiveIndex(index);
                    if (index >= videos.length - 3 && hasMore && !loading) fetchShorts(page + 1);
                }
            }
        });
    }, { root: container, threshold: 0.6 });
    Array.from(container.children).forEach((c) => observer.observe(c as Element));
    return () => observer.disconnect();
  }, [videos, loading, hasMore, page]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide relative">
      <div className="fixed top-4 left-4 z-50"><Link to="/" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center active:scale-90 transition-all"><ArrowLeft size={24} /></Link></div>
      {videos.map((video, idx) => (
        <div key={video.id + idx} data-index={idx} className="w-full h-full snap-start">
             <ShortItem video={video} isActive={idx === activeIndex} isNear={Math.abs(idx - activeIndex) <= 2} onOpenShare={() => {}} />
        </div>
      ))}
    </div>
  );
}