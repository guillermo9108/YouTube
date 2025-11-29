
import React from 'react';
import { Video } from '../types';
import { Link } from './Router';
import { CheckCircle2, MoreVertical } from 'lucide-react';

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

const VideoCard: React.FC<VideoCardProps> = ({ video, isUnlocked, isWatched }) => {
  return (
    <div className={`flex flex-col gap-3 group ${isWatched ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
      {/* Thumbnail */}
      <Link to={`/watch/${video.id}`} className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-sm group-hover:rounded-none transition-all duration-200">
        <img 
          src={video.thumbnailUrl} 
          alt={video.title} 
          className="w-full h-full object-cover"
        />
        
        {/* Duration Badge */}
        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
           {Math.floor(video.duration/60)}:{(video.duration%60).toFixed(0).padStart(2,'0')}
        </div>

        {/* Status Overlay */}
        {isWatched && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                 <div className="flex items-center gap-1 text-slate-200 bg-black/40 px-2 py-1 rounded backdrop-blur-md">
                    <CheckCircle2 size={14} /> <span className="text-xs font-bold">WATCHED</span>
                 </div>
             </div>
        )}
        
        {/* Price Badge if Locked */}
        {!isUnlocked && !isWatched && (
            <div className="absolute top-1 right-1 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                {video.price} $
            </div>
        )}
      </Link>

      {/* Meta Info */}
      <div className="flex gap-3 px-1">
        {/* Avatar */}
        <Link to={`/profile`} className="shrink-0">
            {video.creatorAvatarUrl ? (
                <img src={video.creatorAvatarUrl} className="w-9 h-9 rounded-full object-cover bg-slate-800" alt={video.creatorName} />
            ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    {video.creatorName[0]}
                </div>
            )}
        </Link>

        {/* Text */}
        <div className="flex-1 min-w-0">
            <Link to={`/watch/${video.id}`}>
                <h3 className="text-sm md:text-base font-bold text-white leading-snug line-clamp-2 mb-1 group-hover:text-indigo-400 transition-colors" title={video.title}>
                    {video.title}
                </h3>
            </Link>
            <div className="text-xs text-slate-400 flex flex-col">
                <span className="hover:text-slate-200 transition-colors flex items-center gap-1">
                    {video.creatorName}
                    {/* Fake verify badge for style */}
                    <CheckCircle2 size={10} className="text-slate-500 fill-slate-800" />
                </span>
                <span className="flex items-center gap-1">
                    {video.views} views • {formatTimeAgo(video.createdAt)}
                </span>
            </div>
        </div>

        {/* Menu Icon (Visual only for now) */}
        <button className="shrink-0 text-slate-500 hover:text-white self-start opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
};

export default VideoCard;
