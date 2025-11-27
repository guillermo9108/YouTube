import React, { useEffect, useState, useRef } from 'react';
import { Lock, Play, AlertCircle, ShoppingCart, ThumbsUp, ThumbsDown, Clock, MessageSquare, Send, SkipForward, Repeat, Wallet } from 'lucide-react';
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
      <div className="relative w-40 aspect-video shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 group-hover:border-indigo-500 transition-colors">
         <img src={rv.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
         {watched && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
             <span className="text-xs font-bold text-white bg-slate-800/80 px-2 py-1 rounded">WATCHED</span>
           </div>
         )}
         {!purchased && !watched && (
           <div className="absolute bottom-1 right-1 bg-amber-400 text-black text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm">
              {rv.price} $
           </div>
         )}
      </div>
      <div className="min-w-0 py-1">
         <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-indigo-400 transition-colors">{rv.title}</h4>
         <p className="text-xs text-slate-500 mt-1">{rv.creatorName}</p>
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

  // Load Video Data
  useEffect(() => {
    if (id && user) {
      setLoading(true);
      setCountdown(null);
      setAutoStatus('IDLE');
      
      const loadData = async () => {
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
         }
         setLoading(false);
      };
      loadData();
    }
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
        // Update local state without full reload
        setInteraction(prev => prev ? { ...prev, isWatched: true } : null);
      }
    }
  };

  // --- Auto-Play Logic ---

  const findNextPlayableVideo = async (candidates: Video[]): Promise<{ video: Video, status: typeof autoStatus } | null> => {
    if (!user) return null;
    
    // We iterate through candidates to find the best match
    for (const v of candidates) {
      const vInteract = await db.getInteraction(user.id, v.id);
      const isPurchased = await db.hasPurchased(user.id, v.id);
      
      if (vInteract.isWatched) return { video: v, status: 'SKIPPING_WATCHED' };
      if (isPurchased) return { video: v, status: 'PLAYING_NEXT' };
      
      // Not purchased
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
        setCountdown(3); // Start 3s timer
      }
    }
  };

  // Timer Effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0 && nextVideo && user) {
        // Execute Action
        if (autoStatus === 'AUTO_BUYING') {
           db.purchaseVideo(user.id, nextVideo.id)
             .then(() => {
               refreshUser();
               navigate(`/watch/${nextVideo.id}`);
             })
             .catch(e => setAutoStatus('WAITING_CONFIRMATION')); // Fallback if buy fails
        } else {
           // SKIPPING_WATCHED or PLAYING_NEXT
           if (autoStatus === 'SKIPPING_WATCHED') {
              // Find first unwatched if possible, else current
              navigate(`/watch/${nextVideo.id}`);
           } else {
              navigate(`/watch/${nextVideo.id}`);
           }
        }
      }
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(timer);
  }, [countdown, nextVideo, autoStatus, user, navigate, refreshUser]);


  // --- Actions ---

  const handlePurchase = async () => {
    if (!user || !video) return;
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
    // Reload video stats
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

  if (loading) return <div className="p-10 text-center text-slate-500">Loading video...</div>;
  if (!video) return <div className="p-10 text-center text-red-500">Video not found</div>;

  const canAfford = (user?.balance || 0) >= video.price;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Player & Info */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Player Container */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 group">
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
                    
                    <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                       <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                         <path className="text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                         <path className="text-indigo-500 transition-all duration-1000 ease-linear" strokeDasharray={`${(countdown / 3) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                       </svg>
                       <span className="text-2xl font-mono font-bold text-white">{countdown}</span>
                    </div>

                    <div className="flex gap-3">
                      <button 
                         onClick={() => setCountdown(null)} 
                         className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium"
                      >
                        Cancel
                      </button>
                      
                      {autoStatus === 'SKIPPING_WATCHED' && (
                        <button 
                           onClick={() => navigate(`/watch/${nextVideo.id}`)} 
                           className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium flex items-center gap-2"
                        >
                          <Repeat size={16} /> Rewatch
                        </button>
                      )}

                      {autoStatus !== 'SKIPPING_WATCHED' && (
                         <button 
                           onClick={() => setCountdown(0)} 
                           className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium flex items-center gap-2"
                        >
                          <SkipForward size={16} /> Play Now
                        </button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Confirmation Overlay (No Timer) */}
                {autoStatus === 'WAITING_CONFIRMATION' && nextVideo && (
                   <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                     <p className="text-slate-400 text-sm mb-2 uppercase tracking-widest font-bold">Up Next</p>
                     <h3 className="text-xl font-bold text-white mb-2">{nextVideo.title}</h3>
                     <p className="text-amber-400 font-bold mb-6">{nextVideo.price} Saldo</p>
                     
                     <div className="flex gap-3">
                        <button onClick={() => setAutoStatus('IDLE')} className="px-4 py-2 bg-slate-700 rounded-lg text-white">Cancel</button>
                        <Link to={`/watch/${nextVideo.id}`} className="px-4 py-2 bg-indigo-600 rounded-lg text-white font-bold flex items-center gap-2">
                           View & Buy
                        </Link>
                     </div>
                   </div>
                )}

              </>
            ) : (
              /* Locked State - REFINED VISIBILITY */
              <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
                
                {/* Background Image with heavy blur */}
                <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110" style={{ backgroundImage: `url(${video.thumbnailUrl})` }}></div>
                <div className="absolute inset-0 bg-slate-950/80"></div>
                
                <div className="relative z-20 flex flex-col items-center justify-center p-6 w-full max-w-sm">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border-2 border-slate-700 shadow-2xl">
                    <Lock size={32} className="text-slate-300" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-white mb-1 text-center shadow-black drop-shadow-md">{video.title}</h2>
                  <p className="text-slate-400 text-sm mb-8 text-center">
                    Locked Content by <span className="text-indigo-300 font-semibold">{video.creatorName}</span>
                  </p>
                  
                  {/* Price Tag */}
                  <div className="mb-8 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Price to Unlock</p>
                    <div className="text-6xl font-black text-amber-400 drop-shadow-lg">
                       {video.price} <span className="text-xl text-amber-200/80 font-bold tracking-wider">SALDO</span>
                    </div>
                  </div>

                  {error && (
                    <div className="w-full text-red-400 text-sm bg-red-950/80 border border-red-900/50 p-3 rounded-lg mb-4 flex items-center justify-center gap-2 animate-pulse">
                        <AlertCircle size={16}/>{error}
                    </div>
                  )}
                  
                  {!canAfford && !error && (
                      <div className="w-full text-red-300 text-xs bg-red-950/60 p-3 rounded-lg mb-4 border border-red-900/50 flex items-center justify-center gap-2">
                          <AlertCircle size={14} /> Insufficient Balance (Have: {user?.balance})
                      </div>
                  )}

                  <button 
                    onClick={handlePurchase}
                    disabled={purchasing || !canAfford}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl border-t border-white/10 ${
                      !canAfford 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black shadow-amber-900/40 hover:scale-105 hover:shadow-2xl active:scale-95 animate-pulse'
                    }`}
                  >
                     {purchasing ? (
                        <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-black/50 border-t-black rounded-full animate-spin"/> Processing...</span>
                     ) : (
                        <><ShoppingCart size={22} fill="currentColor" /> BUY NOW</>
                     )}
                  </button>
                  
                  <p className="text-[10px] text-slate-500 mt-4 text-center">
                     Instant access • Supports Creator
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info Bar */}
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{video.title}</h1>
            <div className="flex flex-wrap justify-between items-center mt-3 gap-4">
               <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{video.views} views</span>
                  <span>{new Date(video.createdAt).toLocaleDateString()}</span>
               </div>
               
               {/* Actions */}
               <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleLike(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${interaction?.liked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <ThumbsUp size={18} /> {video.likes}
                  </button>
                  <button 
                    onClick={() => toggleLike(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${interaction?.disliked ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <ThumbsDown size={18} />
                  </button>
                  <button 
                    onClick={toggleWatchLater}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isWatchLater ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <Clock size={18} /> {isWatchLater ? 'Saved' : 'Save'}
                  </button>
               </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs">{video.creatorName[0]}</div>
               <span className="font-semibold text-slate-200">{video.creatorName}</span>
             </div>
             <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{video.description}</p>
          </div>

          {/* Comments Section */}
          <div className="mt-8">
            <h3 className="font-bold text-lg text-slate-200 mb-4 flex items-center gap-2">
              <MessageSquare size={18} /> Comments ({comments.length})
            </h3>
            
            <form onSubmit={postComment} className="flex gap-3 mb-6">
              <input 
                type="text" 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..." 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-white"
              />
              <button 
                 type="submit" 
                 disabled={!newComment.trim()}
                 className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg"
              >
                <Send size={20} />
              </button>
            </form>

            <div className="space-y-4">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                    {c.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-sm font-semibold text-slate-300">{c.username}</span>
                       <span className="text-xs text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Related Videos */}
        <div className="space-y-4">
           <h3 className="font-bold text-slate-200">Up Next</h3>
           <div className="flex flex-col gap-3">
             {relatedVideos.map(rv => (
               <RelatedVideoItem key={rv.id} rv={rv} userId={user?.id} />
             ))}
           </div>
        </div>

      </div>
    </div>
  );
}