import React, { useEffect, useState, useRef } from 'react';
import { Lock, Play, AlertCircle, ShoppingCart, ThumbsUp, ThumbsDown, Clock, MessageSquare, Send, SkipForward, Volume2, VolumeX, RefreshCw, Info, Wallet, Trash2 } from 'lucide-react';
import { db } from '../services/db';
import { Video, Comment, UserInteraction, VideoCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from '../components/Router';

// Helper for relative time (Fixed for Seconds timestamp)
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
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Balance Request Modal
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqAmount, setReqAmount] = useState(0);

  // Playback Control State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextVideo, setNextVideo] = useState<Video | null>(null);
  const [autoStatus, setAutoStatus] = useState<'IDLE' | 'SKIPPING_WATCHED' | 'AUTO_BUYING' | 'PLAYING_NEXT' | 'WAITING_CONFIRMATION'>('IDLE');
  const [showDebug, setShowDebug] = useState(false);
  const repairAttempted = useRef(false);

  // ID Change Handler
  useEffect(() => {
    if (!id) {
        setErrorMsg("No Video ID provided in URL");
        setLoading(false);
        return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');
    setComments([]);
    setRelatedVideos([]);
    setCountdown(null);
    setNextVideo(null);
    repairAttempted.current = false;

    const fetchVideo = async () => {
        try {
            const v = await db.getVideo(id);
            if (!isMounted) return;
            
            if (!v) {
                setErrorMsg("Video not found or deleted (404)");
                setLoading(false);
                return;
            }
            
            setVideo(v);
            
            // Unlock Check
            if (user) {
                if (user.role === 'ADMIN' || user.id === v.creatorId) {
                     setIsUnlocked(true);
                } else {
                    db.hasPurchased(user.id, v.id).then(res => isMounted && setIsUnlocked(res)).catch(e => console.warn("Purchase check failed", e));
                }
                
                db.getInteraction(user.id, v.id).then(res => isMounted && setInteraction(res)).catch(e => console.warn("Interaction fetch failed", e));
                if (user.watchLater) setIsWatchLater(user.watchLater.includes(v.id));
            }

            db.getComments(v.id).then(res => isMounted && setComments(res || [])).catch(e => console.warn("Comments failed", e));
            db.getRelatedVideos(v.id).then(res => isMounted && setRelatedVideos(res || [])).catch(e => console.warn("Related failed", e));

            setLoading(false);
        } catch (e: any) {
            if (isMounted) {
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
            playPromise.catch((e) => {
                if (videoRef.current) {
                    videoRef.current.muted = true;
                    videoRef.current.play().catch(() => {});
                }
            });
        }
    }
  }, [loading, video, isUnlocked]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      // Mark Watched Logic
      if (el.currentTime / el.duration > 0.30 && interaction && !interaction.isWatched && user && video) { 
          db.markWatched(user.id, video.id); 
          setInteraction({...interaction, isWatched: true}); 
      }
      
      // Thumbnail Repair Logic: Capture frame at > 1 sec if missing
      if (!repairAttempted.current && el.currentTime > 1.0 && video && isUnlocked) {
          repairAttempted.current = true;
          if (video.thumbnailUrl.includes('placeholder')) {
              try {
                  const canvas = document.createElement('canvas');
                  canvas.width = el.videoWidth;
                  canvas.height = el.videoHeight;
                  canvas.getContext('2d')?.drawImage(el, 0, 0);
                  canvas.toBlob(blob => {
                      if(blob) db.repairThumbnail(video.id, new File([blob], "repaired.jpg", {type: 'image/jpeg'}));
                  }, 'image/jpeg', 0.6);
              } catch(e) {}
          }
      }
  };

  const handleVideoEnded = async () => {
    if (!video || !user) return;
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
      } else if (Number(target.price) <= Number(user.autoPurchaseLimit) && Number(user.balance) >= Number(target.price)) {
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
      
      // Admin Check: Just in case UI didn't update, admins are always unlocked.
      if (user.role === 'ADMIN') { setIsUnlocked(true); return; }

      if (Number(user.balance) < Number(video.price)) { 
          setReqAmount(Math.ceil(Number(video.price) - Number(user.balance)) + 5); // Suggest needing 5 more than deficit
          setShowReqModal(true);
          return; 
      }

      setPurchasing(true);
      try {
          await db.purchaseVideo(user.id, video.id);
          refreshUser();
          setIsUnlocked(true);
      } catch (e) { alert("Purchase failed"); } finally { setPurchasing(false); }
  };

  const submitBalanceRequest = async () => {
      if (!user) return;
      try {
          await db.requestBalance(user.id, reqAmount);
          alert("Request sent successfully to Admin!");
          setShowReqModal(false);
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const postComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !video || !newComment.trim() || isPostingComment) return;
      
      setIsPostingComment(true);
      try {
          const c = await db.addComment(user.id, video.id, newComment);
          setComments([c, ...comments]);
          setNewComment('');
      } catch(e) {
          console.error(e);
      } finally {
          setIsPostingComment(false);
      }
  };

  const handleRate = async (rating: 'like' | 'dislike') => {
      if (!user || !video) return;
      const res = await db.rateVideo(user.id, video.id, rating);
      setInteraction(res);
      if (res.newLikeCount !== undefined) {
          setVideo(prev => prev ? { ...prev, likes: res.newLikeCount!, dislikes: res.newDislikeCount! } : null);
      }
  };

  const handleDelete = async () => {
      if (!video || !user) return;
      if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
      
      try {
          await db.deleteVideo(video.id, user.id);
          navigate('/');
      } catch (e: any) {
          alert("Error deleting video: " + e.message);
      }
  };

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

  const canAfford = Number(user?.balance || 0) >= Number(video?.price || 0) || user?.role === 'ADMIN';
  const isOwner = user?.id === video?.creatorId;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-5xl mx-auto pb-6" key={video?.id || 'loading'}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">
        <div className="lg:col-span-2 space-y-2">
             <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
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
                            onTimeUpdate={handleTimeUpdate} 
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
                    <div onClick={handlePurchase} className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-cover bg-center cursor-pointer`} style={{backgroundImage: `url(${video.thumbnailUrl})`}}>
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
                 <div className="flex justify-between items-start gap-4">
                    <h1 className="text-lg md:text-xl font-bold text-white leading-tight break-words line-clamp-3 md:line-clamp-none flex-1">{video.title}</h1>
                    {(isOwner || isAdmin) && (
                        <button onClick={handleDelete} className="text-slate-500 hover:text-red-500 transition-colors p-1" title="Delete Video">
                            <Trash2 size={20} />
                        </button>
                    )}
                 </div>
                 <div className="flex items-center justify-between mt-2">
                     <div className="flex items-center gap-3 text-xs text-slate-400">
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
                             <button onClick={() => handleRate('dislike')} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-colors ${interaction?.disliked ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}>
                                 <ThumbsDown size={14} fill={interaction?.disliked ? "currentColor" : "none"}/> {video.dislikes}
                             </button>
                         </div>
                         <button onClick={() => user && db.toggleWatchLater(user.id, video.id).then(l => setIsWatchLater(l.includes(video.id)))} className={`px-3 py-1.5 rounded-full transition-colors ${isWatchLater ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}><Clock size={14}/></button>
                     </div>
                 </div>
                 <div className="mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed">{video.description}</div>
             </div>
             )}

             <div className="mt-6 border-t border-slate-800 pt-6">
                 <h3 className="font-bold text-sm text-slate-300 mb-4 flex items-center gap-2">
                    <MessageSquare size={16}/> Comments <span className="text-slate-500 text-xs font-normal">({comments.length})</span>
                 </h3>
                 
                 {user ? (
                     <form onSubmit={postComment} className="flex gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full rounded-full object-cover"/> : user.username[0]}
                        </div>
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                value={newComment} 
                                onChange={e=>setNewComment(e.target.value)} 
                                placeholder="Add a comment..." 
                                className="w-full bg-slate-900 border-b border-slate-700 px-0 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                            />
                            {newComment.trim() && (
                                <div className="flex justify-end mt-2 animate-in fade-in slide-in-from-top-1">
                                    <button 
                                        disabled={isPostingComment} 
                                        type="submit" 
                                        className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                    >
                                        {isPostingComment ? 'Posting...' : 'Comment'}
                                    </button>
                                </div>
                            )}
                        </div>
                     </form>
                 ) : (
                     <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-6 text-center">
                         <p className="text-sm text-slate-400 mb-2">Sign in to join the conversation</p>
                         <Link to="/login" className="inline-block px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-full transition-colors">Log In</Link>
                     </div>
                 )}

                 <div className="space-y-4">
                    {comments.length === 0 && <div className="text-center text-slate-600 text-sm py-4 italic">No comments yet. Be the first to share your thoughts!</div>}
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-3 group">
                            <Link to={`/channel/${c.userId}`} className="shrink-0 mt-0.5">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden border border-transparent group-hover:border-slate-600 transition-colors">
                                    {c.userAvatarUrl ? <img src={c.userAvatarUrl} className="w-full h-full object-cover"/> : c.username[0]}
                                </div>
                            </Link>
                            <div className="flex-1">
                                <div className="flex gap-2 items-baseline mb-0.5">
                                    <Link to={`/channel/${c.userId}`} className="text-xs font-bold text-slate-200 hover:text-white transition-colors">{c.username}</Link>
                                    <span className="text-[10px] text-slate-500">{formatTimeAgo(c.timestamp)}</span>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
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

      {/* Saldo Request Modal */}
      {showReqModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-sm rounded-xl border border-slate-700 p-6 shadow-2xl animate-in zoom-in-95">
                  <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
                          <AlertCircle size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-white">Insufficient Balance</h3>
                      <p className="text-sm text-slate-400 mt-1">
                          You need <span className="text-amber-400 font-bold">{video?.price} Saldo</span> but you only have <span className="text-slate-300">{user?.balance} Saldo</span>.
                      </p>
                  </div>
                  
                  <div className="bg-slate-950 p-4 rounded-lg mb-4 border border-slate-800">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Request Top-up Amount</label>
                      <div className="flex items-center gap-2">
                          <Wallet size={16} className="text-indigo-400"/>
                          <input 
                            type="number" 
                            value={reqAmount} 
                            onChange={e => setReqAmount(Math.max(1, parseInt(e.target.value)))}
                            className="flex-1 bg-transparent text-white font-bold outline-none border-b border-slate-700 focus:border-indigo-500 py-1"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowReqModal(false)} className="flex-1 py-2.5 rounded-lg font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
                      <button onClick={submitBalanceRequest} className="flex-1 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">Request Saldo</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}