import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Play, CircleDollarSign } from 'lucide-react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  isUnlocked: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, isUnlocked }) => {
  return (
    <Link to={`/watch/${video.id}`} className="group relative block bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 hover:border-indigo-500 transition-all duration-300">
      <div className="aspect-video relative">
        <img 
          src={video.thumbnailUrl} 
          alt={video.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
        />
        
        {/* Overlay Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-2">
           {!isUnlocked && (
             <div className="bg-black/60 backdrop-blur-sm text-amber-400 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
               <CircleDollarSign size={12} /> {video.price}
             </div>
           )}
        </div>

        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 ${isUnlocked ? 'bg-indigo-500/80 group-hover:bg-indigo-500' : 'bg-slate-800/80'}`}>
            {isUnlocked ? <Play size={20} fill="white" className="ml-1" /> : <Lock size={20} className="text-slate-400" />}
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-100 truncate pr-4">{video.title}</h3>
        <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
          <span>{video.creatorName}</span>
          <span>{isUnlocked ? 'Purchased' : 'Locked'}</span>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;