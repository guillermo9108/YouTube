
import React, { useEffect, useState, useRef } from 'react';
import { Lock, Play, AlertCircle, ShoppingCart, ThumbsUp, Clock, MessageSquare, Send, SkipForward, Volume2, VolumeX, RefreshCw } from 'lucide-react';
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
  const params = useParams();
  const id = params?.id; 
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  // State
  const [video, setVideo] = useState<Video | null>(null);
  const [status, setStatus] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Content State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [isWatchLater, setIsWatchLater] = useState(false);

  // Actions State
  const [purchasing, setPurchasing] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Auto-play / Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextVideo, setNextVideo] = useState<Video | null>(null);
  const [autoStatus, setAutoStatus] = useState<'IDLE' | 'SKIPPING_WATCHED' | 'AUTO_BUYING' | 'PLAYING_NEXT' | 'WAITING_CONFIRMATION'>('IDLE');

  const loadData = async () => {
    if (!id) {
        setStatus('ERROR');
        setErrorMsg('No Video ID provided');
        return;
    }
    if (!user) return; // Wait for auth

    setStatus('LOADING');
    try {
        const v = await db.getVideo(id);
        if (!v) {
            throw new Error('Video not found or deleted');
        }
        setVideo(v);
        
        // Fetch auxiliary data
        const [purchased, interact, comms, related] = await Promise.all([
            db.hasPurchased(user.id, v.id),
            db.getInteraction(user.id, v.id),
            db.getComments(v.id),
            db.getRelatedVideos(v.id)
        ]);

        setIsUnlocked(purchased);
        setInteraction(interact);
        setComments(comms);
        setRelatedVideos(related);
        setIsWatchLater(user.watchLater.includes(v.id));
        
        setStatus('READY');
    } catch (e: any) {
        console.error("Watch Load Error:", e);
        setStatus('ERROR');
        setErrorMsg(e.message || 'Connection failed');
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  // Auto-Play Trigger
  useEffect(() => {
    if (status === 'READY' && isUnlocked && videoRef.current) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Auto-play prevented by browser policy");
            });
        }
    }
  }, [status, isUnlocked, id]);

  // Logic to find next video
  const handleVideoEnded = async () => {
    if (relatedVideos.length === 0 || !user) return;
    
    // Find first valid candidate
    let target: Video | null = null;
    let targetStatus: typeof autoStatus = 'WAITING_CONFIRMATION';

    for (const v of relatedVideos) {
        const vInt = await db.getInteraction(user.id, v.id);
        if (vInt.isWatched) continue; // Skip watched

        const owned = await db.hasPurchased(user.id, v.id);
        if (owned) {
            target = v;
            targetStatus = 'PLAYING_NEXT';
            break;
        }

        // Auto-buy check
        if (v.price <= user.autoPurchaseLimit && user.balance >= v.price) {
            target = v;
            targetStatus = 'AUTO_BUYING';
            break;
        }

        // If we found an unpurchased one but can't auto-buy, stop here and offer it
        target = v;
        targetStatus = 'WAITING_CONFIRMATION';
        break;
    }

    if (target) {
        setNextVideo(target);
        setAutoStatus(targetStatus);
        if (targetStatus !== 'WAITING_CONFIRMATION') {
            setCountdown(3);
        }
    }
  };

  // Countdown Timer
  useEffect(() => {
      if (countdown === null || countdown <= 0) {
          if (countdown === 0 && nextVideo && user) {
              if (autoStatus === 'AUTO_BUYING') {
                  db.purchaseVideo(user.id, nextVideo.id)
                    .then(() => navigate(`/watch/${nextVideo.id}`))
                    .catch(() => setAutoStatus('WAITING_CONFIRMATION'));
              } else {
                  navigate(`/watch/${nextVideo.id}`);
              }
          }
          return;
      }
      const t = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
      return () => clearTimeout(t);
  }, [countdown, nextVideo, autoStatus, user, navigate]);


  // Actions
  const handlePurchase = async () => {
      if (!user || !video || purchasing) return;
      if (user.balance < video.price) {
          alert("Insufficient Balance");
          return;
      }
      setPurchasing(true);
      try {
          await db.purchaseVideo(user.id, video.id);
          refreshUser();
          setIsUnlocked(true);
      } catch (e) {
          alert("Purchase failed");
      } finally {
          setPurchasing(false);
      }
  };

  const postComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !video || !newComment.trim()) return;
      const c = await db.addComment(user.id, video.id, newComment);
      setComments([c, ...comments]);
      setNewComment('');
  };

  // Render Loading
  if (status === 'LOADING') return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-500">
          <RefreshCw className="animate-spin text-indigo-500" size={32} />
          <p>Loading video...</p>
      </div>
  );

  // Render Error
  if (status === 'ERROR' || !video) return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-slate-400">
          <AlertCircle size={48} className="text-red-500" />
          <div className="text-center">
              <h2 className="text-xl font-bold text-white">Video Unavailable</h2>
              <p className="text-sm mt-1">{errorMsg || "The video ID might be incorrect or deleted."}</p>
              <div className="mt-2 text-xs font-mono bg-slate-900 p-1 px-3 rounded inline-block text-slate-600">ID: {id}</div>
          </div>
          <button onClick={loadData} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              Retry
          </button>
      </div>
  );

  const canAfford = (user?.balance || 0) >= video.price;

  return (
    <div className="max-w-5xl mx-auto pb-6" key={video.id}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-3">
             
             {/* Player Wrapper */}
             <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                {isUnlocked ? (
                    <>
                        <video 
                            ref={videoRef}
                            src={video.videoUrl}
                            poster={video.thumbnailUrl}
                            className="w-full h-full"
                            controls
                            playsInline
                            onEnded={handleVideoEnded}
                            onTimeUpdate={(e) => {
                                // Mark watched at 95%
                                if (e.currentTarget.currentTime / e.currentTarget.duration > 0.95 && interaction && !interaction.isWatched && user) {
                                    db.markWatched(user.id, video.id);
                                    setInteraction({...interaction, isWatched: true});
                                }
                            }}
                        />
                        {/* Autoplay Overlay */}
                        {countdown !== null && countdown > 0 && nextVideo && (
                            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 animate-in fade-in">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Up Next</p>
                                <h3 className="text-xl font-bold text-white mb-6 text-center px-4">{nextVideo.title}</h3>
                                <div className="text-4xl font-mono font-bold text-indigo-400 mb-6">{countdown}</div>
                                <div className="flex gap-4">
                                    <button onClick={() => setCountdown(null)} className="px-4 py-2 bg-slate-800 rounded text-white text-sm">Cancel</button>
                                    <button onClick={() => setCountdown(0)} className="px-4 py-2 bg-indigo-600 rounded text-white text-sm font-bold">Play Now</button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Locked Overlay */
                    <div onClick={canAfford ? handlePurchase : undefined} className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-cover bg-center ${canAfford ? 'cursor-pointer' : ''}`} style={{backgroundImage: `url(${video.thumbnailUrl})`}}>
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity hover:bg-black/50" />
                        
                        <div className="relative z-20 flex flex-col items-center p-6 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl transform transition-transform active:scale-95">
                             <div className="flex items-center gap-2 mb-2">
                                <span className="text-4xl font-black text-amber-400 drop-shadow-lg">{video.price}</span>
                                <span className="text-[10px] font-bold text-amber-200 uppercase mt-2">Saldo</span>
                             </div>
                             
                             <div className="flex items-center gap-2 text-white/90">
                                {purchasing ? <RefreshCw className="animate-spin" size={16}/> : <Lock size={16}/>}
                                <span className="font-bold text-xs uppercase tracking-wider">{purchasing ? 'Unlocking...' : (canAfford ? 'Tap to Unlock' : 'Locked')}</span>
                             </div>
                             
                             {!canAfford && (
                                 <div className="mt-3 text-[10px] bg-red-500/20 text-red-200 px-2 py-1 rounded border border-red-500/20">
                                     Insufficient Funds
                                 </div>
                             )}
                        </div>
                    </div>
                )}
             </div>

             {/* Metadata */}
             <div className="px-1">
                 <h1 className="text-lg md:text-xl font-bold text-white leading-tight">{video.title}</h1>
                 <div className="flex items-center justify-between mt-2">
                     <div className="flex items-center gap-3 text-xs text-slate-400">
                         <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">{video.creatorName[0]}</div>
                             <span className="text-slate-300">{video.creatorName}</span>
                         </div>
                         <span>{video.views} views</span>
                     </div>
                     <div className="flex gap-2">
                         <button 
                            onClick={() => user && db.toggleLike(user.id, video.id, true).then(setInteraction)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${interaction?.liked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                         >
                             <ThumbsUp size={14}/> {video.likes + (interaction?.liked ? 1 : 0)}
                         </button>
                         <button 
                            onClick={() => user && db.toggleWatchLater(user.id, video.id).then(l => setIsWatchLater(l.includes(video.id)))}
                            className={`px-3 py-1.5 rounded-full transition-colors ${isWatchLater ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}
                         >
                             <Clock size={14}/>
                         </button>
                     </div>
                 </div>
                 
                 <div className="mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-xs text-slate-300">
                     {video.description}
                 </div>
             </div>

             {/* Comments */}
             <div className="mt-6">
                 <h3 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2"><MessageSquare size={14}/> Comments</h3>
                 <form onSubmit={postComment} className="flex gap-2 mb-4">
                     <input type="text" value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"/>
                     <button disabled={!newComment.trim()} type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-500 disabled:opacity-50"><Send size={16}/></button>
                 </form>
                 <div className="space-y-3">
                     {comments.map(c => (
                         <div key={c.id} className="flex gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">{c.username[0]}</div>
                             <div>
                                 <div className="flex gap-2 items-baseline">
                                     <span className="text-xs font-bold text-slate-300">{c.username}</span>
                                     <span className="text-[10px] text-slate-600">{new Date(c.timestamp).toLocaleDateString()}</span>
                                 </div>
                                 <p className="text-xs text-slate-400">{c.text}</p>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
        </div>

        {/* Sidebar */}
        <div>
            <h3 className="font-bold text-sm text-slate-400 mb-3 uppercase tracking-wider">Up Next</h3>
            <div className="space-y-2">
                {relatedVideos.map(rv => <RelatedVideoItem key={rv.id} rv={rv} userId={user?.id} />)}
            </div>
        </div>

      </div>
    </div>
  );
}
