import React, { useState } from 'react';
import { Video } from '../types';
import { Link } from './Router';
// Fix: Corrected import from 'lucide-center' to 'lucide-react'
import { CheckCircle2, MoreVertical, ImageOff } from 'lucide-react';
import { formatDuration, formatTimeAgo, formatCurrency } from '../utils/formatters';

interface VideoCardProps {
  video: Video;
  isUnlocked: boolean;
  isWatched?: boolean;
  context?: { query: string, category: string };
}

const VideoCard: React.FC<VideoCardProps> = React.memo(({ video, isUnlocked, isWatched, context }) => {
  // Check if video is "New" (less than 24 hours old)
  const isNew = (Date.now() / 1000 - video.createdAt) < 86400;
  const [imgError, setImgError] = useState(false);

  const handleClick = () => {
      if (context && context.query) {
          sessionStorage.setItem('sp_nav_context', JSON.stringify(context));
      } else {
          sessionStorage.removeItem('sp_nav_context');
      }
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
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                <ImageOff size={24} />
            </div>
        )}
        
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
           {formatDuration(video.duration)}
        </div>

        {isNew && !isWatched && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                NEW
            </div>
        )}

        {isWatched && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                 <div className="flex items-center gap-1 text-slate-200 bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                    <CheckCircle2 size={14} /> <span className="text-[10px] font-bold tracking-wider">WATCHED</span>
                 </div>
             </div>
        )}
        
        {!isUnlocked && !isWatched && (
            <div className="absolute top-1.5 right-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                {formatCurrency(video.price)} $
            </div>
        )}
      </Link>

      <div className="flex gap-3 px-1 md:px-0">
        <Link to={`/channel/${video.creatorId}`} className="shrink-0 mt-0.5">
            {video.creatorAvatarUrl ? (
                <img src={video.creatorAvatarUrl} className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-800 group-hover:border-indigo-500/50 transition-colors" alt={video.creatorName} />
            ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                    {video.creatorName[0]}
                </div>
            )}
        </Link>

        <div className="flex-1 min-w-0 flex flex-col">
            <Link to={`/watch/${video.id}`} onClick={handleClick} title={video.title}>
                <h3 className="text-sm md:text-[15px] font-semibold text-white leading-snug line-clamp-2 mb-1 group-hover:text-indigo-400 transition-colors">
                    {video.title}
                </h3>
            </Link>
            
            <div className="text-[11px] md:text-xs text-slate-400 flex flex-col gap-0.5">
                <Link to={`/channel/${video.creatorId}`} className="hover:text-slate-200 transition-colors flex items-center gap-1 w-fit">
                    {video.creatorName}
                    <CheckCircle2 size={10} className="text-slate-500 fill-slate-800" />
                </Link>
                <div className="flex items-center gap-1">
                    <span>{video.views} views</span>
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