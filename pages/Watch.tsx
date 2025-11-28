
import React, { useEffect, useState, useRef } from 'react';
import { Lock, Play, AlertCircle, ShoppingCart, ThumbsUp, ThumbsDown, Clock, MessageSquare, Send, SkipForward, Repeat, Wallet, Unlock, RefreshCw } from 'lucide-react';
import { db } from '../services/db';
import { Video, Comment, UserInteraction } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from '../components/Router';

const RelatedVideoItem: React.FC<{rv: Video, userId?: string}> = ({rv, userId}) => {
   const [watched, setWatched] = useState(false);
   const [purchased, setPurchased] = useState(false);

   useEffect(() => {
     if(userId) {
        db.getInteraction(userId, rv.id).then(i => setWatched(i.isWatched));
        db.hasPurchased(userId, rv.id).then(setPurchased);
     }
   }, [userId, rv.id]);

   return (
    <Link to={`/watch/${rv.id}`} className="flex gap-3 group">
      <div className="relative w-32 aspect-video shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 group-hover:border-indigo-500 transition-colors">
         <img src={rv.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
         {watched && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
             <span className="text-[10px] font-bold text-white bg-slate-800/80 px-1.5 py-0.5 rounded">WATCHED</span>
           </div>
         )}
         {!purchased && !watched && (
           <div className="absolute bottom-1 right-1 bg-amber-400 text-black text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm">
              {rv.price} $
           </div>
         )}
      </div>
      <div className="min-w-0 py-1">
         <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 group-hover:text-indigo-400 transition-colors">{rv.title}</h4>
         <p className="text-[10px] text-slate-500 mt-1">{rv.creatorName}</p>
         <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
            <span>{rv.views} views</span>
         </div>
      </div>
    </Link>
   );
};

export default function Watch() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  
  // Social State
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);

  // Auto-play State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextVideo, setNextVideo] = useState<Video | null>(null);
  const [autoStatus, setAutoStatus] = useState<'IDLE' | 'SKIPPING_WATCHED' | 'AUTO_BUYING' | 'PLAYING_NEXT' | 'WAITING_CONFIRMATION'>('IDLE');

  const loadData = async () => {
     if (!user || !id) return;
     setLoading(true);
     setLoadingError(false);
     setCountdown(null);
     setAutoStatus('IDLE');
     
     // Timeout safety
     const timeoutId = setTimeout(() => {
        if (loading) {
            setLoadingError(true);
            setLoading(false);
        }
     }, 10000);

     try {
         const v = await db.getVideo(id);
         if (v) {
            setVideo(v);
            const purchased = await db.hasPurchased(user.id, v.id);
            setIsUnlocked(purchased);
            
            const interact = await db.getInteraction(user.id, v.id);
            setInteraction(interact);
            
            const comms = await db.getComments(v.id);
            setComments(comms);

            setIsWatchLater(user.watchLater.includes(v.id));
            
            const related = await db.getRelatedVideos(v.id);
            setRelatedVideos(related);
         } else {
             setLoadingError(true);
         }
     } catch (e) {
         setLoadingError(true);
     } finally {
         clearTimeout(timeoutId);
         setLoading(false);
     }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  // Enforce Auto-Play when video becomes available
  useEffect(() => {
    if (isUnlocked && videoRef.current) {
      const timer = setTimeout(() => {
        videoRef.current?.play().catch(e => console.log("Auto-play prevented:", e));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, video]);

  // Track Watched Status (> 95%)
  const handleTimeUpdate = () => {
    if (videoRef.current && user && video) {
      const progress = videoRef.current.currentTime / videoRef.current.duration;
      if (progress > 0.95 && interaction && !interaction.isWatched) {
        db.markWatched(user.id, video.id);
        setInteraction(prev => prev ? { ...prev, isWatched: true } : null);
      }
    }
  };

  // --- Auto-Play Logic ---
  const findNextPlayableVideo = async (candidates: Video[]): Promise<{ video: Video, status: typeof autoStatus } | null> => {
    if (!user) return null;
    for (const v of candidates) {
      const vInteract = await db.getInteraction(user.id, v.id);
      const isPurchased = await db.hasPurchased(user.id, v.id);
      
      if (vInteract.isWatched) return { video: v, status: 'SKIPPING_WATCHED' };
      if (isPurchased) return { video: v, status: 'PLAYING_NEXT' };
      if (v.price <= user.autoPurchaseLimit && user.balance >= v.price) {
        return { video: v, status: 'AUTO_BUYING' };
      }
      return { video: v, status: 'WAITING_CONFIRMATION' };
    }
    return null;
  };

  const handleVideoEnded = async () => {
    if (relatedVideos.length === 0) return;
    const result = await findNextPlayableVideo(relatedVideos);
    if (result) {
      setNextVideo(result.video);
      setAutoStatus(result.status);
      if (result.status !== 'WAITING_CONFIRMATION') {
        setCountdown(3); 
      }
    }
  };

  // Timer Effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0 && nextVideo && user) {
        if (autoStatus === 'AUTO_BUYING') {
           db.purchaseVideo(user.id, nextVideo.id)
             .then(() => {
               refreshUser();
               navigate(`/watch/${nextVideo.id}`);
             })
             .catch(e => setAutoStatus('WAITING_CONFIRMATION'));
        } else {
           navigate(`/watch/${nextVideo.id}`);
        }
      }
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(timer);
  }, [countdown, nextVideo, autoStatus, user, navigate, refreshUser]);


  // --- Actions ---
  const handlePurchase = async () => {
    if (!user || !video || purchasing) return;
    
    // Prevent purchase if low balance
    if ((user.balance || 0) < video.price) {
        setError("Insufficient Balance to Unlock");
        return;
    }

    setPurchasing(true);
    setError('');
    try {
      await db.purchaseVideo(user.id, video.id);
      refreshUser();
      setIsUnlocked(true);
    } catch (e: any) {
      setError(e.message || "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const toggleLike = async (isLike: boolean) => {
    if (!user || !video) return;
    const res = await db.toggleLike(user.id, video.id, isLike);
    setInteraction(res);
    const v = await db.getVideo(video.id);
    if(v) setVideo(v); 
  };

  const toggleWatchLater = async () => {
    if (!user || !video) return;
    const list = await db.toggleWatchLater(user.id, video.id);
    setIsWatchLater(list.includes(video.id));
    refreshUser();
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !video || !newComment.trim()) return;
    const c = await db.addComment(user.id, video.id, newComment);
    setComments(prev => [c, ...prev]);
    setNewComment('');
  };

  if (loading) return <div className="p-20 text-center text-slate-500 flex flex-col items-center gap-4"><RefreshCw className="animate-spin text-indigo-500" size={32}/> Loading content...</div>;
  
  if (loadingError || !video) return (
      <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-4">
          <AlertCircle size={48} className="text-red-500" />
          <p>Failed to load video or video does not exist.</p>
          <button onClick={loadData} className="px-6 py-2 bg-slate-800 rounded-lg text-white hover:bg-slate-700">Retry</button>
      </div>
  );

  const canAfford = (user?.balance || 0) >= video.price;

  return (
    <div className="max-w-5xl mx-auto pb-4"> 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6"> 
        
        {/* Left Column: Player & Info */}
        <div className="lg:col-span-2 space-y-3">
          
          {/* Player Container */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 group select-none">
            {isUnlocked ? (
              <>
                <video 
                  ref={videoRef}
                  src={video.videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full"
                  poster={video.thumbnailUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                />
                
                {/* Auto-Play Overlay */}
                {countdown !== null && countdown > 0 && nextVideo && (
                  <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                    <p className="text-slate-400 text-sm mb-2 uppercase tracking-widest font-bold">
                       {autoStatus === 'SKIPPING_WATCHED' ? 'Skipping Watched Video' : 
                        autoStatus === 'AUTO_BUYING' ? 'Auto-Purchasing Next' : 'Up Next'}
                    </p>
                    <h3 className="text-xl font-bold text-white mb-4 line-clamp-2">{nextVideo.title}</h3>
                    
                    <div className="relative w-12 h-12 flex items-center justify-center mb-6">
                       <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                         <path className="text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                         <path className="text-indigo-500 transition-all duration-1000 ease-linear" strokeDasharray={`${(countdown / 3) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                       </svg>
                       <span className="text-xl font-mono font-bold text-white">{countdown}</span>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setCountdown(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium text-sm">Cancel</button>
                      <button onClick={() => setCountdown(0)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium flex items-center gap-2 text-sm">
                        <SkipForward size={14} /> Play Now
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Locked State - REFACTORED FOR BETTER VISIBILITY */
              <div 
                onClick={canAfford ? handlePurchase : undefined}
                className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-all ${canAfford ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {/* Background Image - NO BLUR, just clean */}
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${video.thumbnailUrl})` }}></div>
                {/* Subtle Gradient only at bottom to make text readable, not full overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                
                {/* Compact Center Card */}
                <div className="relative z-20 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl w-auto min-w-[200px] text-center transform transition-transform active:scale-95 hover:bg-black/70">
                  
                  {/* Price */}
                  <div className="mb-2">
                     <span className="text-4xl font-black text-amber-400 drop-shadow-md tracking-tight">
                       {video.price}
                     </span>
                     <span className="text-amber-200/80 font-bold uppercase text-[10px] ml-1">Saldo</span>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center justify-center gap-2 text-white mb-2">
                     {purchasing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                     ) : (
                        <Lock size={16} className="text-slate-300" />
                     )}
                     <span className="font-bold text-sm">
                       {purchasing ? 'Unlocking...' : (canAfford ? 'Tap to Unlock' : 'Locked')}
                     </span>
                  </div>

                  {/* Errors */}
                  {error && (
                    <div className="text-red-400 text-[10px] bg-red-950/80 px-2 py-1 rounded flex items-center justify-center gap-1 mt-2">
                        <AlertCircle size={10}/>{error}
                    </div>
                  )}
                  
                  {!canAfford && !error && (
                      <div className="text-red-300 text-[10px] bg-red-950/60 px-2 py-1 rounded border border-red-900/50 mt-2">
                          Low Balance ({user?.balance})
                      </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info Bar */}
          <div className="px-1">
            <h1 className="text-lg md:text-xl font-bold text-slate-100 leading-tight">{video.title}</h1>
            <div className="flex flex-wrap justify-between items-center mt-2 gap-3">
               <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">{video.creatorName[0]}</div>
                    <span className="font-semibold text-slate-300">{video.creatorName}</span>
                  </div>
                  <span>•</span>
                  <span>{video.views} views</span>
               </div>
               
               {/* Actions */}
               <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleLike(true)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors text-xs font-medium ${interaction?.liked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <ThumbsUp size={14} /> {video.likes}
                  </button>
                  <button 
                    onClick={toggleWatchLater}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors text-xs font-medium ${isWatchLater ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <Clock size={14} />
                  </button>
               </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
             <p className="text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{video.description}</p>
          </div>

          {/* Comments Section */}
          <div className="mt-6">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <MessageSquare size={14} /> Comments ({comments.length})
            </h3>
            
            <form onSubmit={postComment} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..." 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 text-white text-sm"
              />
              <button 
                 type="submit" 
                 disabled={!newComment.trim()}
                 className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg"
              >
                <Send size={16} />
              </button>
            </form>

            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                    {c.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-xs font-semibold text-slate-300">{c.username}</span>
                       <span className="text-[10px] text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-400">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Related Videos */}
        <div className="space-y-2 mt-4 lg:mt-0">
           <h3 className="font-bold text-slate-200 text-sm px-1">Up Next</h3>
           <div className="flex flex-col gap-2">
             {relatedVideos.map(rv => (
               <RelatedVideoItem key={rv.id} rv={rv} userId={user?.id} />
             ))}
           </div>
        </div>

      </div>
    </div>
  );
}
