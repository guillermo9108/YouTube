import React, { useState } from 'react';
import { Video } from '../types';
import { Link } from './Router';
import { CheckCircle2, MoreVertical, ImageOff } from 'lucide-react';

interface VideoCardProps {
  video: Video;
  isUnlocked: boolean;
  isWatched?: boolean;
}

const formatTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// React.memo to prevent re-renders of cards that didn't change when parent state updates
const VideoCard: React.FC<VideoCardProps> = React.memo(({ video, isUnlocked, isWatched }) => {
  // Check if video is "New" (less than 24 hours old)
  const isNew = (Date.now() - video.createdAt) < 24 * 60 * 60 * 1000;
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`flex flex-col gap-3 group ${isWatched ? 'opacity-70 hover:opacity-100 transition-opacity' : ''}`}>
      {/* Thumbnail Container */}
      <Link to={`/watch/${video.id}`} className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-sm group-hover:rounded-none transition-all duration-200 block">
        {!imgError ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title} 
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                <ImageOff size={24} />
            </div>
        )}
        
        {/* Duration Badge */}
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
           {formatDuration(video.duration)}
        </div>

        {/* NEW Badge */}
        {isNew && !isWatched && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                NEW
            </div>
        )}

        {/* Status Overlay: Watched */}
        {isWatched && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                 <div className="flex items-center gap-1 text-slate-200 bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                    <CheckCircle2 size={14} /> <span className="text-[10px] font-bold tracking-wider">WATCHED</span>
                 </div>
             </div>
        )}
        
        {/* Price Badge if Locked */}
        {!isUnlocked && !isWatched && (
            <div className="absolute top-1.5 right-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                {video.price} $
            </div>
        )}
      </Link>

      {/* Meta Info Row */}
      <div className="flex gap-3 px-1 md:px-0">
        {/* Avatar -> Channel Link */}
        <Link to={`/channel/${video.creatorId}`} className="shrink-0 mt-0.5">
            {video.creatorAvatarUrl ? (
                <img src={video.creatorAvatarUrl} className="w-9 h-9 rounded-full object-cover bg-slate-800" alt={video.creatorName} />
            ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                    {video.creatorName[0]}
                </div>
            )}
        </Link>

        {/* Text Info */}
        <div className="flex-1 min-w-0 flex flex-col">
            <Link to={`/watch/${video.id}`} title={video.title}>
                <h3 className="text-sm md:text-[15px] font-semibold text-white leading-snug line-clamp-2 mb-1 group-hover:text-indigo-400 transition-colors">
                    {video.title}
                </h3>
            </Link>
            
            <div className="text-[11px] md:text-xs text-slate-400 flex flex-col gap-0.5">
                {/* Creator Name -> Channel Link */}
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

        {/* Menu Icon Placeholder */}
        <button className="shrink-0 text-slate-500 hover:text-white self-start opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
            <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
});

export default VideoCard;