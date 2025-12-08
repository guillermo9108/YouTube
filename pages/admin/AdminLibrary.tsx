
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Play, Maximize, X, Info, VolumeX, Volume2, Image as ImageIcon, Server, Terminal } from 'lucide-react';
import { useServerTask } from '../../context/ServerTaskContext';

// --- VISIBLE SCANNER PLAYER COMPONENT (Legacy/Browser-Based) ---
const ScannerPlayer = ({ video, onComplete, onSkip }: { video: Video, onComplete: (dur: number, thumb: File | null) => void, onSkip: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Checking...');
    const [isMuted, setIsMuted] = useState(true);
    
    const hasRealThumbnail = video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder');

    useEffect(() => {
        if (hasRealThumbnail) {
            setStatus('Metadata Only (Fast Mode)...');
        } else {
            setStatus('Loading Video...');
        }

        const timer = setTimeout(() => {
            const vid = videoRef.current;
            if (hasRealThumbnail) {
                onComplete(0, null);
            } else if (vid && vid.duration > 0 && !isNaN(vid.duration)) {
                onComplete(vid.duration, null);
            } else {
                onSkip();
            }
        }, hasRealThumbnail ? 5000 : 30000); 

        return () => clearTimeout(timer);
    }, [video, hasRealThumbnail]);

    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (!vid) return;

        if (hasRealThumbnail) {
            setStatus('Saving Metadata...');
            const duration = (!isNaN(vid.duration) && vid.duration > 0) ? vid.duration : 0;
            setTimeout(() => onComplete(duration, null), 200); 
        } else {
            setStatus('Waiting for playback...');
            vid.play().catch(e => {
                if (vid.duration > 0) {
                    setStatus('Autoplay blocked - Saving duration only');
                    setTimeout(() => onComplete(vid.duration, null), 1000);
                }
            });
        }
    };

    const handleTimeUpdate = async () => {
        if (hasRealThumbnail) return;

        const vid = videoRef.current;
        if (!vid) return;

        if (vid.currentTime > 1.5) {
            setStatus('Capturing Frame...');
            vid.pause();
            
            let thumbnail: File | null = null;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360; 
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.7));
                    if (blob) thumbnail = new File([blob], "thumb.jpg", { type: 'image/jpeg' });
                }
            } catch (e) {
                console.warn("Thumbnail capture failed (CORS/Taint):", e);
            }

            setStatus('Saving...');
            const duration = (!isNaN(vid.duration) && vid.duration > 0) ? vid.duration : 0;
            onComplete(duration, thumbnail);
        }
    };

    const handleError = (e: any) => {
        if (hasRealThumbnail) {
             onComplete(0, null);
             return;
        }
        setStatus(`Error: Playback Failed`);
        setTimeout(onSkip, 1500);
    };

    const videoSrc = `${video.videoUrl}${video.videoUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4">
                {hasRealThumbnail ? (
                    <>
                        <img src={video.thumbnailUrl} className="w-full h-full object-cover opacity-50" alt="Server Thumb" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <ImageIcon size={48} className="text-emerald-500 mb-2"/>
                            <span className="text-emerald-400 font-bold text-sm bg-black/50 px-2 py-1 rounded">Thumbnail Found</span>
                        </div>
                        <video ref={videoRef} src={videoSrc} className="absolute opacity-0 pointer-events-none" preload="metadata" muted onLoadedMetadata={handleLoadedMetadata} onError={handleError} />
                    </>
                ) : (
                    <video key={video.id} ref={videoRef} src={videoSrc} crossOrigin="anonymous" className="w-full h-full object-contain" muted={isMuted} playsInline autoPlay onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onError={handleError} />
                )}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded backdrop-blur-md font-mono border border-white/10 flex items-center gap-2 z-10">
                    <div className={`w-2 h-2 rounded-full ${status.includes('Error') ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                    {status}
                </div>
            </div>
            <div className="flex gap-4 w-full">
                <button onClick={onSkip} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-200 py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider border border-red-900/30">Force Skip</button>
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const { startScan: startServerScan, isScanning: isServerScanning, log: serverLog, progress: serverProgress } = useServerTask();
    
    const [localPath, setLocalPath] = useState('');
    const [isIndexing, setIsIndexing] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    
    // VISUAL SCANNER STATE
    const [activeScan, setActiveScan] = useState(false);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const wakeLock = useRef<any>(null);

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
        return () => { if (wakeLock.current) wakeLock.current.release(); };
    }, []);

    // --- STEP 1: INDEXING ---
    const handleIndexLibrary = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        setScanLog(['Starting Indexing...', 'This may take a while for large libraries...']);
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) {
                setScanLog(prev => [...prev, `Found ${res.totalFound} files.`, `New imported: ${res.newToImport}`]);
                if (res.newToImport > 0) setScanLog(prev => [...prev, "Use 'Server Processing' (Step 2) to analyze them."]);
                else setScanLog(prev => [...prev, "Library is up to date."]);
            } else {
                setScanLog(prev => [...prev, `Error: ${res.errors || 'Unknown'}`]);
            }
        } catch (e: any) {
            setScanLog(prev => [...prev, `Critical Error: ${e.message}`]);
        } finally {
            setIsIndexing(false);
        }
    };

    // --- STEP 2: SERVER PROCESSING (FFMPEG) ---
    // Reusing ServerTaskContext logic but triggering the "processScanBatch" manually in loop
    const handleServerFFmpegScan = async () => {
        if(isServerScanning) return;
        // Reuse context method if path set, or custom loop here
        startServerScan(localPath); // This triggers the ServerTaskContext loop which calls db.processScanBatch
    };

    // --- LEGACY: BROWSER SCANNER ---
    const startBrowserScan = async () => {
        setScanLog(prev => [...prev, "Fetching unprocessed videos for Browser Scan..."]);
        const pending = await db.getUnprocessedVideos();
        if (pending.length === 0) {
            setScanLog(prev => [...prev, "No pending videos found."]);
            return;
        }
        setScanQueue(pending);
        setCurrentScanIndex(0);
        setActiveScan(true);
    };

    const stopActiveScan = () => { setActiveScan(false); setScanQueue([]); };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
        const item = scanQueue[currentScanIndex];
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
            setScanLog(prev => [...prev, `Browser Processed: ${item.title}`]);
        } catch (e: any) {
            setScanLog(prev => [...prev, `Failed: ${item.title}`]);
        }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Browser Scan Complete!");
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escáner de Servidor (NAS)</h3>
                <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80">
                    <strong>Instrucciones:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-slate-300">
                        <li>Introduce la ruta absoluta de tus videos (ej: /volume1/videos).</li>
                        <li>Ejecuta <strong>Paso 1</strong> para encontrar archivos nuevos.</li>
                        <li>Ejecuta <strong>Paso 2</strong> para que el servidor (FFmpeg) extraiga datos.</li>
                    </ol>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                </div>

                <button onClick={handleIndexLibrary} disabled={isIndexing || isServerScanning || activeScan} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {isIndexing ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Indexar Archivos
                </button>
                
                <button onClick={handleServerFFmpegScan} disabled={isIndexing || isServerScanning || activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                    {isServerScanning ? <Loader2 className="animate-spin"/> : <Server size={20}/>} Paso 2: Procesar con FFmpeg (Servidor)
                </button>

                <div className="border-t border-slate-800 pt-4 mt-2">
                    <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold text-center">Opciones Alternativas</p>
                    <button onClick={startBrowserScan} disabled={isIndexing || isServerScanning || activeScan} className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold py-2 rounded-lg flex items-center justify-center gap-2 text-xs">
                        <Play size={14}/> Escáner Visual (Navegador)
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4 h-[600px]">
                <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 flex-1 overflow-y-auto shadow-inner relative">
                    <div className="absolute top-2 right-2 text-slate-600 opacity-50 pointer-events-none"><Terminal size={16}/></div>
                    {(isServerScanning ? serverLog : scanLog).map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1 break-all">{line}</div>)}
                    {(isServerScanning || isIndexing) && <div className="animate-pulse text-emerald-500">_</div>}
                </div>
                
                {isServerScanning && (
                    <div className="bg-slate-900 p-4 rounded-xl border border-emerald-900/50">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Progreso del Servidor</span>
                            <span>{serverProgress.current} / {serverProgress.total}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${serverProgress.percent}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* ACTIVE BROWSER SCANNER OVERLAY */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <ScannerPlayer video={scanQueue[currentScanIndex]} onComplete={handleVideoProcessed} onSkip={() => handleVideoProcessed(0, null)} />
                </div>
            )}
        </div>
    );
}
