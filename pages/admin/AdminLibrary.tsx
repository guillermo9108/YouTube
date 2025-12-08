
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Play, Maximize, X, Info, VolumeX, Volume2 } from 'lucide-react';

// --- VISIBLE SCANNER PLAYER COMPONENT ---
const ScannerPlayer = ({ video, onComplete, onSkip }: { video: Video, onComplete: (dur: number, thumb: File | null) => void, onSkip: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Loading...');
    const [isMuted, setIsMuted] = useState(true);
    const attemptRef = useRef(0);

    useEffect(() => {
        // Safety timeout - Give it 30s to load and play 1.5s
        const timer = setTimeout(() => {
            console.warn("Scanner timeout for", video.title);
            const vid = videoRef.current;
            if (vid && vid.duration > 0 && !isNaN(vid.duration)) {
                // If we at least got duration, save it without thumb
                onComplete(vid.duration, null);
            } else {
                onSkip();
            }
        }, 30000);
        return () => clearTimeout(timer);
    }, [video]);

    const handleTimeUpdate = async () => {
        const vid = videoRef.current;
        if (!vid) return;

        // Wait until we have played at least 1.5 seconds to ensure we have a valid frame
        if (vid.currentTime > 1.5) {
            setStatus('Capturing...');
            vid.pause();
            
            let thumbnail: File | null = null;

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360; 
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Draw current frame
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.7));
                    if (blob) {
                        thumbnail = new File([blob], "thumb.jpg", { type: 'image/jpeg' });
                    }
                }
            } catch (e) {
                console.warn("Thumbnail capture failed (CORS/Taint):", e);
            }

            setStatus('Saving...');
            // Ensure duration is valid
            const duration = (!isNaN(vid.duration) && vid.duration > 0) ? vid.duration : 0;
            onComplete(duration, thumbnail);
        }
    };

    const handleError = (e: any) => {
        const err = videoRef.current?.error;
        console.error("Scanner Video Error:", err, video.videoUrl);
        setStatus(`Playback Error: ${err?.code || 'Unknown'}`);
        
        // Retry once logic could go here, but for now we skip to keep queue moving
        setTimeout(onSkip, 1000);
    };

    const handlePlaying = () => {
        setStatus('Playing...');
    };

    const handleWaiting = () => {
        setStatus('Buffering...');
    };

    // Use a timestamp to prevent caching of failed requests
    // Force absolute path handling if needed, though 'api/...' usually works
    const videoSrc = `${video.videoUrl}${video.videoUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4">
                <video
                    key={video.id}
                    ref={videoRef}
                    src={videoSrc} 
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                    muted={isMuted}
                    autoPlay
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onPlaying={handlePlaying}
                    onWaiting={handleWaiting}
                    onError={handleError}
                />
                
                {/* Status Overlay */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded backdrop-blur-md font-mono border border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.includes('Error') ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                    {status}
                </div>

                {/* Mute Toggle */}
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute bottom-2 right-2 bg-black/60 p-2 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                    {isMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
                </button>
            </div>

            <div className="flex gap-4 w-full">
                <button onClick={onSkip} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-200 py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider border border-red-900/30">
                    Force Skip Video
                </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-4 text-center max-w-sm">
                The video will play automatically. Once it reaches 1.5 seconds, a snapshot will be taken and it will proceed to the next video.
            </p>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const [localPath, setLocalPath] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    
    // ACTIVE SCANNER STATE
    const [activeScan, setActiveScan] = useState(false);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const wakeLock = useRef<any>(null);

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
        
        return () => {
            if (wakeLock.current) wakeLock.current.release();
        };
    }, []);

    const handleScanLibrary = async () => {
        if (!localPath.trim()) return;
        setIsScanning(true);
        setScanLog(['Starting Server Indexing...']);
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath }); // Save path implicitly
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) {
                setScanLog(prev => [...prev, `Found ${res.totalFound} files.`, `New imported: ${res.newToImport}`]);
                if (res.newToImport > 0) setScanLog(prev => [...prev, "Use 'Active Processor' to analyze them."]);
            } else {
                setScanLog(prev => [...prev, `Error: ${res.errors || 'Unknown'}`]);
            }
        } catch (e: any) {
            setScanLog(prev => [...prev, `Critical Error: ${e.message}`]);
        } finally {
            setIsScanning(false);
        }
    };

    // --- ACTIVE SCANNER CONTROL ---

    const startActiveScan = async () => {
        setScanLog(prev => [...prev, "Fetching unprocessed videos..."]);
        const pending = await db.getUnprocessedVideos();
        if (pending.length === 0) {
            setScanLog(prev => [...prev, "No pending videos found."]);
            toast.info("No pending videos found");
            return;
        }

        setScanQueue(pending);
        setCurrentScanIndex(0);
        setActiveScan(true);
        
        try {
            if ('wakeLock' in navigator) {
                wakeLock.current = await (navigator as any).wakeLock.request('screen');
                toast.success("Scanner Active - Keep screen on");
            }
        } catch(e) { console.warn("Wake Lock failed", e); }
    };

    const stopActiveScan = () => {
        setActiveScan(false);
        setScanQueue([]);
        if (wakeLock.current) {
            wakeLock.current.release();
            wakeLock.current = null;
        }
    };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
        const item = scanQueue[currentScanIndex];
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            setScanLog(prev => [...prev, `Processed: ${item.title} (${Math.floor(duration)}s)`]);
        } catch (e: any) {
            setScanLog(prev => [...prev, `Failed to save: ${item.title}`]);
        }
        
        // Move to next
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Batch Complete!");
            setScanLog(prev => [...prev, "Batch Complete."]);
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    const handleVideoSkip = async () => {
        const item = scanQueue[currentScanIndex];
        setScanLog(prev => [...prev, `Skipped: ${item.title}`]);
        // Mark as processed with 0 duration to avoid loop (sets category to UNKNOWN)
        await db.updateVideoMetadata(item.id, 0, null);
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Batch Complete!");
            setScanLog(prev => [...prev, "Batch Complete."]);
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escaneo de Librería Local</h3>
                <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80">
                    <strong>Método Híbrido:</strong> Servidor Indexa &rarr; Cliente (Tu móvil) Procesa.
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                </div>

                <button onClick={handleScanLibrary} disabled={isScanning || activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {isScanning ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Indexar Archivos
                </button>
                
                <button onClick={startActiveScan} disabled={isScanning || activeScan} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {activeScan ? <Loader2 className="animate-spin"/> : <Play size={20}/>} Paso 2: Procesar (Escáner Visual)
                </button>
            </div>

            <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                {scanLog.map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1">{line}</div>)}
            </div>

            {/* ACTIVE SCANNER OVERLAY */}
            {activeScan && scanQueue.length > 0 && currentScanIndex < scanQueue.length && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <div className="absolute top-0 left-0 right-0 p-4 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10">
                        <div className="text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Maximize className="text-indigo-400 animate-pulse"/> Active Visual Scanner</h2>
                            <p className="text-sm text-slate-400">Processing {currentScanIndex + 1} of {scanQueue.length}</p>
                        </div>
                        <button onClick={stopActiveScan} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full"><X/></button>
                    </div>

                    <ScannerPlayer 
                        video={scanQueue[currentScanIndex]}
                        onComplete={handleVideoProcessed}
                        onSkip={handleVideoSkip}
                    />
                    
                    <div className="mt-8 text-slate-500 text-sm max-w-md text-center">
                        <Info size={16} className="inline mr-1"/>
                        Do not close this window. The app is scanning your videos to extract duration and thumbnails.
                    </div>
                </div>
            )}
        </div>
    );
}
