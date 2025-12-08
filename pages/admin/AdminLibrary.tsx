
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Play, Image as ImageIcon, Terminal, FileVideo } from 'lucide-react';

const ScannerPlayer = ({ video, onComplete, onSkip }: { video: Video, onComplete: (dur: number, thumb: File | null) => void, onSkip: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing...');
    
    const hasRealThumbnail = video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder');

    useEffect(() => {
        // If we already have a thumbnail from the server (Synology @eaDir), we are lenient.
        if (hasRealThumbnail) {
            setStatus('Thumbnail detected on server. Verifying...');
        } else {
            setStatus('Loading video stream...');
        }

        const timeout = setTimeout(() => {
            // TIMEOUT HANDLER
            // If the browser hangs (common with huge MKV files), we FORCE IMPORT.
            // We assume the file exists since the server indexed it.
            if (hasRealThumbnail) {
                setStatus('Timeout. Using server thumbnail.');
                onComplete(0, null);
            } else {
                setStatus('Timeout. Importing as Generic Video.');
                onComplete(0, null);
            }
        }, 12000); // 12s timeout

        return () => clearTimeout(timeout);
    }, [video, hasRealThumbnail]);

    const handleLoadedMetadata = () => {
        const vid = videoRef.current;
        if (!vid) return;
        
        const duration = (!isNaN(vid.duration) && vid.duration > 0) ? vid.duration : 0;

        if (hasRealThumbnail) {
            // Best case: We have server thumb + browser got duration
            setStatus('Metadata loaded. Saving...');
            setTimeout(() => onComplete(duration, null), 300);
        } else {
            // Need to capture thumb manually
            setStatus('Metadata loaded. Seeking for thumbnail...');
            vid.currentTime = Math.min(5, duration * 0.1); // Seek to 5s or 10%
        }
    };

    const handleSeeked = async () => {
        if (hasRealThumbnail) return;

        const vid = videoRef.current;
        if (!vid) return;

        setStatus('Capturing frame...');
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.7));
                if (blob) {
                    const file = new File([blob], "thumb.jpg", { type: 'image/jpeg' });
                    onComplete(vid.duration || 0, file);
                    return;
                }
            }
        } catch (e) {
            console.error(e);
        }
        // Fallback if canvas fails but played
        onComplete(vid.duration || 0, null);
    };

    const handleError = () => {
        // CRITICAL: NEVER SKIP. ALWAYS IMPORT.
        if (hasRealThumbnail) {
            setStatus('Format not supported by browser, but thumbnail found. Importing...');
            setTimeout(() => onComplete(0, null), 500);
        } else {
            setStatus('Format not supported (MKV/AVI?). Importing with generic Icon.');
            setTimeout(() => onComplete(0, null), 500);
        }
    };

    // Use cache busting to prevent 404 caching
    const videoSrc = `${video.videoUrl}${video.videoUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4">
                {hasRealThumbnail ? (
                    <>
                        <img src={video.thumbnailUrl} className="w-full h-full object-cover opacity-60" alt="Server Thumb" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <ImageIcon size={48} className="text-emerald-500 mb-2"/>
                            <span className="text-emerald-400 font-bold text-sm bg-black/50 px-3 py-1 rounded border border-emerald-500/30">Synology Thumbnail Found</span>
                        </div>
                        {/* Invisible video to try getting duration */}
                        <video ref={videoRef} src={videoSrc} className="absolute opacity-0 pointer-events-none" muted preload="metadata" onLoadedMetadata={handleLoadedMetadata} onError={handleError} />
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <FileVideo size={64} className="text-slate-500"/>
                        </div>
                        <video 
                            ref={videoRef} 
                            src={videoSrc} 
                            crossOrigin="anonymous" 
                            className="w-full h-full object-contain relative z-10" 
                            muted 
                            playsInline 
                            autoPlay 
                            onLoadedMetadata={handleLoadedMetadata} 
                            onSeeked={handleSeeked}
                            onError={handleError} 
                        />
                    </>
                )}
                
                <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-3 py-1.5 rounded backdrop-blur-md font-mono border border-white/10 flex items-center gap-2 z-20">
                    <div className={`w-2 h-2 rounded-full ${status.includes('Error') || status.includes('Generic') ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                    {status}
                </div>
            </div>
            <div className="text-center text-xs text-slate-500 mb-2">
                Scanning: {video.videoUrl.split('/').pop()}
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    
    const [localPath, setLocalPath] = useState('');
    const [isIndexing, setIsIndexing] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    
    // VISUAL SCANNER STATE
    const [activeScan, setActiveScan] = useState(false);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
    }, []);

    // --- STEP 1: INDEXING (Finds files + Synology Thumbs) ---
    const handleIndexLibrary = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        setScanLog(['Starting Indexing...', 'Searching for video files and Synology thumbnails...']);
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) {
                setScanLog(prev => [...prev, `Found ${res.totalFound} compatible files.`, `New imported to queue: ${res.newToImport}`]);
                if (res.newToImport > 0) setScanLog(prev => [...prev, "Please run the 'Process & Import' step next."]);
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

    // --- STEP 2: BROWSER SCANNER (The Main Importer) ---
    const startBrowserScan = async () => {
        setScanLog(prev => [...prev, "Fetching queue for processing..."]);
        const pending = await db.getUnprocessedVideos();
        if (pending.length === 0) {
            setScanLog(prev => [...prev, "No pending videos found. Run Step 1 first."]);
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
            setScanLog(prev => [...prev, `Processed: ${item.title}`]);
        } catch (e: any) {
            setScanLog(prev => [...prev, `Failed to save: ${item.title}`]);
        }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Import Complete!");
            setScanLog(prev => [...prev, "All done! Videos are now live."]);
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escáner de Librería</h3>
                <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80">
                    <strong>Instrucciones:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-slate-300">
                        <li>Introduce la ruta absoluta (ej: /volume1/videos).</li>
                        <li>Ejecuta <strong>Paso 1</strong> para buscar archivos y miniaturas de Synology (@eaDir).</li>
                        <li>Ejecuta <strong>Paso 2</strong> para finalizar la importación.</li>
                    </ol>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                    <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleIndexLibrary} disabled={isIndexing || activeScan} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                        {isIndexing ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Indexar Archivos
                    </button>
                    
                    <button onClick={startBrowserScan} disabled={isIndexing || activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                        <Play size={20}/> Paso 2: Procesar e Importar
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4 h-[500px]">
                <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 flex-1 overflow-y-auto shadow-inner relative">
                    <div className="absolute top-2 right-2 text-slate-600 opacity-50 pointer-events-none"><Terminal size={16}/></div>
                    {scanLog.map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1 break-all">{line}</div>)}
                    {(isIndexing || activeScan) && <div className="animate-pulse text-emerald-500">_</div>}
                </div>
            </div>

            {/* ACTIVE SCANNER OVERLAY */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <ScannerPlayer 
                        video={scanQueue[currentScanIndex]} 
                        onComplete={handleVideoProcessed} 
                        onSkip={() => handleVideoProcessed(0, null)} 
                    />
                    <div className="mt-4 text-slate-500 font-mono text-xs">
                        Processing {currentScanIndex + 1} of {scanQueue.length}
                    </div>
                </div>
            )}
        </div>
    );
}
