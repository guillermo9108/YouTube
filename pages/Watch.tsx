
import React, { useEffect, useState, useRef } from 'react';
import { Lock, Play, AlertCircle, ShoppingCart, ThumbsUp, ThumbsDown, Clock, MessageSquare, Send, SkipForward, Volume2, VolumeX, RefreshCw, Info } from 'lucide-react';
import { db } from '../services/db';
import { Video, Comment, UserInteraction, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from '../components/Router';

const RelatedVideoItem: React.FC<{rv: Video, userId?: string}> = ({rv, userId}) => {
   const [watched, setWatched] = useState(false);
   const [purchased, setPurchased] = useState(false);

   useEffect(() => {
     if(userId) {
        db.getInteraction(userId, rv.id).then(i => setWatched(i.isWatched)).catch(() => {});
        db.hasPurchased(userId, rv.id).then(setPurchased).catch(() => {});
     }
   }, [userId, rv.id]);

   return (
    <Link to={`/watch/${rv.id}`} className="flex gap-3 group">
      <div className="relative w-32 aspect-video shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 group-hover:border-indigo-500 transition-colors">
         <img src={rv.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
         {watched && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-[10px] font-bold text-white bg-slate-800/80 px-1.5 py-0.5 rounded">WATCHED</span></div>}
         {!purchased && !watched && <div className="absolute bottom-1 right-1 bg-amber-400 text-black text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm">{rv.price} $</div>}
      </div>
      <div className="min-w-0 py-1 flex flex-col justify-center">
         <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors">{rv.title}</h4>
         <div className="flex items-center gap-1.5 mt-1">
             {rv.creatorAvatarUrl ? (
                 <img src={rv.creatorAvatarUrl} className="w-3 h-3 rounded-full object-cover" alt="" />
             ) : (
                 <div className="w-3 h-3 rounded-full bg-slate-700 flex items-center justify-center text-[6px] text-white">{rv.creatorName?.[0]}</div>
             )}
             <p className="text-[10px] text-slate-500 truncate">{rv.creatorName}</p>
         </div>
         <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400"><span>{rv.views} views</span></div>
      </div>
    </Link>
   );
};

export default function Watch() {
  const params = useParams();
  const id = params?.id; 
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  // Video Data State
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Interaction State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Playback Control State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextVideo, setNextVideo] = useState<Video | null>(null);
  const [autoStatus, setAutoStatus] = useState<'IDLE' | 'SKIPPING_WATCHED' | 'AUTO_BUYING' | 'PLAYING_NEXT' | 'WAITING_CONFIRMATION'>('IDLE');
  const [showDebug, setShowDebug] = useState(false);

  // ID Change Handler - Optimized to prevent unmounting of video player
  useEffect(() => {
    if (!id) {
        setErrorMsg("No Video ID provided in URL");
        setLoading(false);
        return;
    }

    let isMounted = true;
    
    // We do NOT clear video state immediately to keep the player mounted during transition
    setLoading(true);
    setErrorMsg('');
    setComments([]);
    setRelatedVideos([]);
    setCountdown(null);
    setNextVideo(null);

    const fetchVideo = async () => {
        try {
            console.log("Fetching video:", id);
            const v = await db.getVideo(id);
            if (!isMounted) return;
            
            if (!v) {
                setErrorMsg("Video not found or deleted (404)");
                setLoading(false);
                return;
            }
            
            // Update Video Data
            setVideo(v);

            // Fetch secondary data
            if (user) {
                db.hasPurchased(user.id, v.id).then(res => isMounted && setIsUnlocked(res)).catch(e => console.warn("Purchase check failed", e));
                db.getInteraction(user.id, v.id).then(res => isMounted && setInteraction(res)).catch(e => console.warn("Interaction fetch failed", e));
                if (user.watchLater) setIsWatchLater(user.watchLater.includes(v.id));
            }

            db.getComments(v.id).then(res => isMounted && setComments(res || [])).catch(e => console.warn("Comments failed", e));
            db.getRelatedVideos(v.id).then(res => isMounted && setRelatedVideos(res || [])).catch(e => console.warn("Related failed", e));

            setLoading(false);
        } catch (e: any) {
            if (isMounted) {
                console.error("Watch Error:", e);
                setErrorMsg(e.message || "Connection Error");
                setLoading(false);
            }
        }
    };

    fetchVideo();

    return () => { isMounted = false; };
  }, [id, user]); 

  // Auto-play effect
  useEffect(() => {
    if (!loading && video && isUnlocked && videoRef.current) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => console.log("Auto-play blocked by browser"));
        }
    }
  }, [loading, video, isUnlocked]);

  const handleVideoEnded = async () => {
    if (!video || !user) return;
    
    // SERIES/NOVELA LOGIC
    if (video.category === VideoCategory.SERIES || video.category === VideoCategory.NOVELAS) {
         try {
             const creatorVideos = await db.getVideosByCreator(video.creatorId);
             const seriesVideos = creatorVideos
                 .filter(v => v.category === video.category)
                 .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
             
             const currentIndex = seriesVideos.findIndex(v => v.id === video.id);
             if (currentIndex !== -1 && currentIndex < seriesVideos.length - 1) {
                 prepareNextVideo(seriesVideos[currentIndex + 1]);
                 return;
             }
         } catch (e) { }
    }

    // DEFAULT LOGIC
    if (relatedVideos.length > 0) {
        for (const v of relatedVideos) {
             const vInt = await db.getInteraction(user.id, v.id);
             if (vInt.isWatched) continue;
             prepareNextVideo(v);
             return;
        }
    }
  };

  const prepareNextVideo = async (target: Video) => {
      if (!user) return;
      const owned = await db.hasPurchased(user.id, target.id);
      setNextVideo(target);
      if (owned) {
          setAutoStatus('PLAYING_NEXT');
          setCountdown(3);
      } else if (target.price <= user.autoPurchaseLimit && user.balance >= target.price) {
          setAutoStatus('AUTO_BUYING');
          setCountdown(3);
      } else {
          setAutoStatus('WAITING_CONFIRMATION');
      }
  };

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

  const handlePurchase = async () => {
      if (!user || !video || purchasing) return;
      if (user.balance < video.price) { alert("Insufficient Balance"); return; }
      setPurchasing(true);
      try {
          await db.purchaseVideo(user.id, video.id);
          refreshUser();
          setIsUnlocked(true);
      } catch (e) { alert("Purchase failed"); } finally { setPurchasing(false); }
  };

  const postComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !video || !newComment.trim()) return;
      const c = await db.addComment(user.id, video.id, newComment);
      setComments([c, ...comments]);
      setNewComment('');
  };

  const handleRate = async (rating: 'like' | 'dislike') => {
      if (!user || !video) return;
      const res = await db.rateVideo(user.id, video.id, rating);
      setInteraction(res);
      // Correctly update video stats from server response
      if (res.newLikeCount !== undefined) {
          setVideo(prev => prev ? { ...prev, likes: res.newLikeCount!, dislikes: res.newDislikeCount! } : null);
      }
  };

  // Initial Loading State (Only if no video data exists yet)
  if (loading && !video) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-500"><RefreshCw className="animate-spin text-indigo-500" size={32} /><p>Loading video...</p></div>;
  
  if ((!video && !loading) || errorMsg) return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-slate-400">
          <AlertCircle size={48} className="text-red-500" />
          <div className="text-center px-4">
              <h2 className="text-xl font-bold text-white">Video Unavailable</h2>
              <p className="text-sm mt-1 mb-4">{errorMsg || "The video ID might be incorrect, deleted, or you may be offline."}</p>
              <div className="flex gap-2 justify-center">
                  <div className="text-xs font-mono bg-slate-900 p-2 rounded text-slate-500">ID: {id}</div>
                  <button onClick={() => setShowDebug(!showDebug)} className="text-xs bg-slate-800 p-2 rounded hover:text-white"><Info size={14}/></button>
              </div>
              {showDebug && <div className="mt-4 text-[10px] text-left bg-black p-2 rounded font-mono max-w-xs overflow-auto">Backend: /api/index.php?action=get_video&id={id}</div>}
          </div>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">Reload Page</button>
      </div>
  );

  const canAfford = (user?.balance || 0) >= (video?.price || 0);

  return (
    <div className="max-w-5xl mx-auto pb-6" key={video?.id || 'loading'}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">
        <div className="lg:col-span-2 space-y-2">
             <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                
                {/* Loader Overlay for Transitions */}
                {loading && (
                    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
                        <RefreshCw className="animate-spin text-indigo-500 mb-2" size={32} />
                        <span className="text-slate-500 text-xs">Loading next video...</span>
                    </div>
                )}

                {video && (
                  isUnlocked ? (
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
                                // UPDATED: 30% Threshold
                                if (e.currentTarget.currentTime / e.currentTarget.duration > 0.30 && interaction && !interaction.isWatched && user) { 
                                    db.markWatched(user.id, video.id); 
                                    setInteraction({...interaction, isWatched: true}); 
                                } 
                            }} 
                        />
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
                    <div onClick={canAfford ? handlePurchase : undefined} className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-cover bg-center ${canAfford ? 'cursor-pointer' : ''}`} style={{backgroundImage: `url(${video.thumbnailUrl})`}}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity hover:bg-black/40" />
                        <div className="relative z-20 flex flex-col items-center p-3 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md shadow-2xl transform transition-transform active:scale-95 max-w-[200px]">
                             <div className="flex items-center gap-1 mb-1"><span className="text-3xl font-black text-amber-400 drop-shadow-lg">{video.price}</span><span className="text-[10px] font-bold text-amber-200 uppercase mt-1">Saldo</span></div>
                             <div className="flex items-center gap-2 text-white/90">{purchasing ? <RefreshCw className="animate-spin" size={14}/> : <Lock size={14}/>}<span className="font-bold text-[10px] uppercase tracking-wider">{purchasing ? 'Unlocking...' : (canAfford ? 'Tap to Unlock' : 'Locked')}</span></div>
                             {!canAfford && <div className="mt-2 text-[9px] bg-red-500/20 text-red-200 px-2 py-0.5 rounded border border-red-500/20">Insufficient Funds</div>}
                        </div>
                    </div>
                  )
                )}
             </div>
             
             {video && (
             <div className="px-1">
                 <h1 className="text-lg md:text-xl font-bold text-white leading-tight break-words line-clamp-3 md:line-clamp-none">{video.title}</h1>
                 <div className="flex items-center justify-between mt-2">
                     <div className="flex items-center gap-3 text-xs text-slate-400">
                         {/* CREATOR INFO LINKED TO CHANNEL */}
                         <Link to={`/channel/${video.creatorId}`} className="flex items-center gap-2 hover:text-white transition-colors group">
                            {video.creatorAvatarUrl ? (
                                <img src={video.creatorAvatarUrl} className="w-6 h-6 rounded-full object-cover border border-slate-700" alt={video.creatorName} />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">{video.creatorName[0]}</div>
                            )}
                            <span className="text-slate-300 font-medium group-hover:underline">{video.creatorName}</span>
                         </Link>
                         
                         <span>{video.views} views</span>
                         <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-slate-500">{video.category || 'OTHER'}</span>
                     </div>
                     <div className="flex gap-2">
                         <div className="flex items-center bg-slate-800 rounded-full overflow-hidden">
                             <button onClick={() => handleRate('like')} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-colors border-r border-slate-700 ${interaction?.liked ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
                                 <ThumbsUp size={14} fill={interaction?.liked ? "currentColor" : "none"}/> {video.likes}
                             </button>
                             <button onClick={() => handleRate('dislike')} className={`px-3 py-1.5 text-xs font-bold transition-colors ${interaction?.disliked ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}>
                                 <ThumbsDown size={14} fill={interaction?.disliked ? "currentColor" : "none"}/>
                             </button>
                         </div>
                         <button onClick={() => user && db.toggleWatchLater(user.id, video.id).then(l => setIsWatchLater(l.includes(video.id)))} className={`px-3 py-1.5 rounded-full transition-colors ${isWatchLater ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}><Clock size={14}/></button>
                     </div>
                 </div>
                 <div className="mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed">{video.description}</div>
             </div>
             )}

             <div className="mt-4">
                 <h3 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2"><MessageSquare size={14}/> Comments</h3>
                 <form onSubmit={postComment} className="flex gap-2 mb-4"><input type="text" value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"/><button disabled={!newComment.trim()} type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-500 disabled:opacity-50"><Send size={16}/></button></form>
                 <div className="space-y-3">
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-3">
                            <Link to={`/channel/${c.userId}`} className="shrink-0">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden border border-slate-700">
                                    {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : c.username[0]}
                                </div>
                            </Link>
                            <div>
                                <div className="flex gap-2 items-baseline">
                                    <Link to={`/channel/${c.userId}`} className="text-xs font-bold text-slate-300 hover:underline">{c.username}</Link>
                                    <span className="text-[10px] text-slate-600">{new Date(c.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-400">{c.text}</p>
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
        </div>
        <div>
            <h3 className="font-bold text-sm text-slate-400 mb-3 uppercase tracking-wider mt-6 lg:mt-0">Up Next</h3>
            <div className="space-y-2">{relatedVideos.map(rv => <RelatedVideoItem key={rv.id} rv={rv} userId={user?.id} />)}</div>
        </div>
      </div>
    </div>
  );
}
