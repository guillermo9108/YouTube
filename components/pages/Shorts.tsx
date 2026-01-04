
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Share2, Plus, Send, X, Loader2, ArrowLeft, Play, Pause, ThumbsDown } from 'lucide-react';
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
  const [isUnlocked, setIsUnlocked] = useState(hasFullAccess);
  const [paused, setPaused] = useState(false);
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likeCount, setLikeCount] = useState(video.likes || 0);

  useEffect(() => {
    if (user && shouldLoad) {
      db.getInteraction(user.id, video.id).then(setInteraction);
      db.getComments(video.id).then(setComments);
      if (!hasFullAccess) db.hasPurchased(user.id, video.id).then(setIsUnlocked);
    }
  }, [user, video.id, shouldLoad, hasFullAccess]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isActive || !isUnlocked) {
        if (el) el.pause();
        return;
    }
    el.currentTime = 0;
    setPaused(false);
    el.play().catch(() => {});
    db.incrementViewCount(video.id).catch(() => {});
  }, [isActive, isUnlocked, video.id]);

  const handleRate = async (rating: 'like' | 'dislike') => {
    if (!user) return;
    try {
        const res = await db.rateVideo(user.id, video.id, rating);
        setInteraction(res);
        if (res.newLikeCount !== undefined) setLikeCount(res.newLikeCount);
    } catch(e) {}
  };

  if (!shouldLoad) return <div className="w-full h-full shrink-0 bg-black flex items-center justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;

  return (
    <div className="relative w-full h-full snap-start shrink-0 flex items-center justify-center bg-black overflow-hidden">
      <div className="absolute inset-0 z-0 bg-black" onClick={() => { if(videoRef.current?.paused) videoRef.current.play(); else videoRef.current?.pause(); setPaused(!paused); }}>
        {isUnlocked ? (
          <>
            <video ref={videoRef} src={video.videoUrl} poster={video.thumbnailUrl} className="w-full h-full object-cover" loop playsInline preload={preload} crossOrigin="anonymous" />
            {paused && <div className="absolute inset-0 flex items-center justify-center text-white/50"><Pause size={64} fill="currentColor" /></div>}
          </>
        ) : (
           <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900">
              <Lock size={48} className="text-amber-500 mb-4" />
              <div className="text-4xl font-black text-amber-400 mb-2">{video.price} $</div>
              <button onClick={() => db.purchaseVideo(user!.id, video.id).then(()=>setIsUnlocked(true))} className="bg-white text-black font-bold px-8 py-3 rounded-full">Desbloquear</button>
           </div>
        )}
      </div>
      <div className="absolute right-2 bottom-20 z-30 flex flex-col items-center gap-5">
        <button onClick={(e) => { e.stopPropagation(); handleRate('like'); }} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 ${interaction?.liked ? 'text-red-500' : 'text-white'}`}>
             <Heart size={26} fill={interaction?.liked ? "currentColor" : "white"} fillOpacity={interaction?.liked ? 1 : 0.2} />
        </button>
        <span className="text-[10px] font-black text-white -mt-4">{likeCount}</span>
        <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 text-white">
             <MessageCircle size={26} />
        </button>
        <span className="text-[10px] font-black text-white -mt-4">{comments.length}</span>
      </div>
      <div className="absolute bottom-6 left-3 right-16 z-30 text-white pointer-events-none">
         <Link to={`/channel/${video.creatorId}`} className="font-black text-sm drop-shadow-md pointer-events-auto">@{video.creatorName}</Link>
         <h2 className="text-xs font-bold leading-tight mt-1 drop-shadow-md uppercase italic">{video.title}</h2>
      </div>
      {showComments && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowComments(false)}>
           <div className="w-full bg-slate-900 rounded-t-3xl h-[70%] flex flex-col border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                 <h3 className="font-black text-white uppercase text-xs">Comentarios ({comments.length})</h3>
                 <button onClick={() => setShowComments(false)} className="text-slate-400 bg-slate-800 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {comments.length === 0 ? <p className="text-center text-slate-600 py-20 italic text-[10px] font-bold">No hay comentarios</p> : comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 overflow-hidden border border-slate-700">
                           {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{c.username[0]}</div>}
                         </div>
                         <div>
                            <div className="flex items-baseline gap-2">
                               <span className="text-xs font-black text-slate-300">@{c.username}</span>
                               <span className="text-[8px] text-slate-600">{new Date(c.timestamp * 1000).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-snug">{c.text}</p>
                         </div>
                      </div>
                 ))}
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); if(!newComment.trim()) return; const c = await db.addComment(user!.id, video.id, newComment); setComments([c, ...comments]); setNewComment(''); }} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 pb-safe">
                 <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none" placeholder="Escribe un comentario..." />
                 <button type="submit" className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"><Send size={18} /></button>
              </form>
           </div>
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
        const shorts = all.filter(v => v.duration < 180 && !['PENDING', 'PROCESSING'].includes(v.category)).sort(() => Math.random() - 0.5);
        setVideos(shorts);
    });
  }, []);

  const onScroll = () => {
    if (!containerRef.current) return;
    const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const hasFullAccess = useMemo(() => {
      if (!user) return false;
      return Boolean(user.role?.toString().toUpperCase() === 'ADMIN' || (user.vipExpiry && user.vipExpiry > Date.now() / 1000));
  }, [user]);

  return (
    <div ref={containerRef} onScroll={onScroll} className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide relative" style={{ scrollBehavior: 'auto' }}>
      <div className="fixed top-4 left-4 z-50">
          <Link to="/" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white"><ArrowLeft size={24} /></Link>
      </div>
      {videos.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="animate-spin" />
              <p className="mt-2 text-[10px] font-black uppercase">Sintonizando...</p>
          </div>
      ) : videos.map((video, idx) => (
        <div key={video.id} className="w-full h-full snap-start">
             <ShortItem video={video} isActive={idx === activeIndex} shouldLoad={Math.abs(idx - activeIndex) <= 1} preload={Math.abs(idx - activeIndex) <= 1 ? "auto" : "none"} hasFullAccess={hasFullAccess} />
        </div>
      ))}
    </div>
  );
}
