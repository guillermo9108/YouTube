
import React, { useState } from 'react';
import { Video } from '../types';
import { Link } from './Router';
import { CheckCircle2, Clock, MoreVertical, ImageOff } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface VideoCardProps {
  video: Video;
  isUnlocked: boolean;
  isWatched?: boolean;
  context?: { query: string, category: string };
}

const formatTimeAgo = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min ago";
  return "Just now";
};

const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoCard: React.FC<VideoCardProps> = React.memo(({ video, isUnlocked, isWatched, context }) => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const isNew = (Date.now() / 1000 - video.createdAt) < 86400;
  const [imgError, setImgError] = useState(false);
  const [inWatchLater, setInWatchLater] = useState(user?.watchLater?.includes(video.id) || false);

  const handleClick = () => {
      if (context && context.query) sessionStorage.setItem('sp_nav_context', JSON.stringify(context));
      else sessionStorage.removeItem('sp_nav_context');
  };

  const handleWatchLater = async (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (!user) return;
      try {
          await db.toggleWatchLater(user.id, video.id);
          setInWatchLater(!inWatchLater);
          toast.success(!inWatchLater ? "Añadido a Ver más tarde" : "Eliminado de Ver más tarde");
          refreshUser();
      } catch (e) {}
  };

  return (
    <div className={`flex flex-col gap-3 group ${isWatched ? 'opacity-70 hover:opacity-100 transition-opacity' : ''}`}>
      <Link 
        to={`/watch/${video.id}`} 
        onClick={handleClick} 
        className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300 block ring-1 ring-white/5 hover:ring-indigo-500/30"
      >
        {!imgError ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy" decoding="async" onError={() => setImgError(true)}
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600"><ImageOff size={24} /></div>
        )}
        
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
           {formatDuration(video.duration)}
        </div>

        {isNew && !isWatched && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse">NEW</div>
        )}

        <button 
            onClick={handleWatchLater}
            className={`absolute top-1.5 right-1.5 p-1.5 rounded-lg backdrop-blur-md border border-white/10 transition-all opacity-0 group-hover:opacity-100 ${inWatchLater ? 'bg-indigo-600 text-white' : 'bg-black/40 text-slate-300 hover:text-white'}`}
        >
            <Clock size={16} fill={inWatchLater ? "currentColor" : "none"} />
        </button>

        {isWatched && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                 <div className="flex items-center gap-1 text-slate-200 bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                    <CheckCircle2 size={14} /> <span className="text-[10px] font-bold tracking-wider">WATCHED</span>
                 </div>
             </div>
        )}
        
        {!isUnlocked && !isWatched && (
            <div className="absolute bottom-1.5 left-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                {video.price} $
            </div>
        )}
      </Link>

      <div className="flex gap-3 px-1 md:px-0">
        <Link to={`/channel/${video.creatorId}`} className="shrink-0 mt-0.5">
            {video.creatorAvatarUrl ? (
                <img src={video.creatorAvatarUrl} className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-800 group-hover:border-indigo-500/50 transition-colors" alt={video.creatorName} />
            ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">{video.creatorName[0]}</div>
            )}
        </Link>

        <div className="flex-1 min-w-0 flex flex-col">
            <Link to={`/watch/${video.id}`} onClick={handleClick} title={video.title}>
                <h3 className="text-sm md:text-[15px] font-semibold text-white leading-snug line-clamp-2 mb-1 group-hover:text-indigo-400 transition-colors">{video.title}</h3>
            </Link>
            <div className="text-[11px] md:text-xs text-slate-400 flex flex-col gap-0.5">
                <Link to={`/channel/${video.creatorId}`} className="hover:text-slate-200 transition-colors flex items-center gap-1 w-fit">
                    {video.creatorName}
                    <CheckCircle2 size={10} className="text-slate-500 fill-slate-800" />
                </Link>
                <div className="flex items-center gap-1">
                    <span>{video.views} vistas</span>
                    <span className="text-slate-600">•</span>
                    <span>{formatTimeAgo(video.createdAt)}</span>
                </div>
            </div>
        </div>

        <button className="shrink-0 text-slate-500 hover:text-white self-start opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
            <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
});

export default VideoCard;
