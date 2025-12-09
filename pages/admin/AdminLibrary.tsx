
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { Video } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, SkipForward, Play, AlertCircle, Wand2, Database, Clock, Pause, Check } from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando...');
    const processedRef = useRef(false);

    const getVideoSrc = (v: Video) => {
        if (v.videoUrl.startsWith('http') || v.videoUrl.startsWith('blob')) return v.videoUrl;
        return `api/index.php?action=stream&id=${v.id}`;
    };

    const streamSrc = getVideoSrc(video);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        processedRef.current = false;
        setStatus('Iniciando...');

        const startPlay = async () => {
            try {
                // Force mute for speed and stability
                vid.muted = true;
                await vid.play();
                setStatus('Procesando...');
            } catch (e) {
                console.warn("Autoplay blocked", e);
                setStatus('Esperando click manual...');
            }
        };
        const timer = setTimeout(startPlay, 200);
        return () => clearTimeout(timer);
    }, [video, streamSrc]); 

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!vid || processedRef.current) return;

        // Process quickly at 1.5s
        if (vid.currentTime > 1.5) {
            vid.pause();
            processedRef.current = true;
            setStatus('Capturando...');

            const duration = vid.duration && isFinite(vid.duration) ? vid.duration : 0;
            let file: File | null = null;

            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth || 640;
                canvas.height = vid.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (blob) file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                        onComplete(duration, file);
                    }, 'image/jpeg', 0.8);
                } else {
                    onComplete(duration, null);
                }
            } catch (err) {
                onComplete(duration, null);
            }
        }
    };

    const handleError = () => {
        if (processedRef.current) return;
        setStatus("Error. Saltando...");
        setTimeout(() => {
            if (!processedRef.current) {
                processedRef.current = true;
                onComplete(0, null);
            }
        }, 2000); // Wait 2s then skip
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative mb-4">
            <div className="relative aspect-video bg-black flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    src={streamSrc} 
                    className="w-full h-full object-contain" 
                    controls
                    playsInline
                    muted={true}
                    preload="auto"
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-white z-10 pointer-events-none">
                    {status}
                </div>
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    
    // Config
    const [localPath, setLocalPath] = useState('');
    const [step2Limit, setStep2Limit] = useState(''); // Empty = All
    
    // States
    const [isIndexing, setIsIndexing] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    
    // Data
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const [organizeProgress, setOrganizeProgress] = useState({processed: 0, total: 0});

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
    }, []);

    const addToLog = (msg: string) => {
        setScanLog(prev => [`> ${msg}`, ...prev].slice(0, 100));
    };

    // --- STEP 1: INDEX ---
    const handleIndexLibrary = async () => {
        if (!localPath.trim()) return;
        setIsIndexing(true);
        setScanLog([]); 
        addToLog('Indexando archivos...');
        
        try {
            await db.updateSystemSettings({ localLibraryPath: localPath });
            const res = await db.scanLocalLibrary(localPath);
            if (res.success) {
                addToLog(`Encontrados: ${res.totalFound}`);
                addToLog(`Nuevos: ${res.newToImport}`);
                toast.success("Paso 1 Completado");
            }
        } catch (e: any) {
            addToLog(`Error: ${e.message}`);
        } finally {
            setIsIndexing(false);
        }
    };

    // --- STEP 2: SCAN ---
    const startBrowserScan = async () => {
        addToLog("Cargando videos pendientes...");
        // API supports limit param. Empty/0 = All.
        const limit = step2Limit ? parseInt(step2Limit) : 0; 
        
        // Custom URL builder to pass limit
        const response = await fetch(`api/index.php?action=get_unprocessed_videos&limit=${limit}`);
        const json = await response.json();
        const pending = json.data || [];

        if (pending.length === 0) {
            addToLog("No hay videos pendientes (PENDING).");
            return;
        }
        
        addToLog(`Iniciando escáner para ${pending.length} videos.`);
        setScanQueue(pending);
        setCurrentScanIndex(0);
        setActiveScan(true);
    };

    const stopActiveScan = () => { setActiveScan(false); setScanQueue([]); };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
        const item = scanQueue[currentScanIndex];
        try {
            await db.updateVideoMetadata(item.id, duration, thumbnail);
        } catch (e) { console.error(e); }
        
        const nextIdx = currentScanIndex + 1;
        if (nextIdx >= scanQueue.length) {
            stopActiveScan();
            toast.success("Paso 2 Completado");
            addToLog("Escaneo visual finalizado.");
        } else {
            setCurrentScanIndex(nextIdx);
        }
    };

    // --- STEP 3: ORGANIZE ---
    const handleSmartOrganize = async () => {
        setIsOrganizing(true);
        setOrganizeProgress({processed: 0, total: 100}); // Indeterminate start
        addToLog("Iniciando organización por lotes...");
        
        const processBatch = async () => {
            try {
                const res = await db.smartOrganizeLibrary();
                
                if (res.details) res.details.forEach(d => addToLog(d));
                
                // If remaining > 0, continue recursively
                if (res.remaining && res.remaining > 0) {
                    addToLog(`Quedan ${res.remaining} videos. Continuando...`);
                    // Update progress visually (fake progress for batching)
                    setOrganizeProgress(prev => ({processed: prev.processed + res.processed, total: prev.processed + res.processed + res.remaining}));
                    setTimeout(processBatch, 500); // Small delay to prevent freeze
                } else {
                    addToLog("Organización Finalizada.");
                    toast.success("Paso 3 Completado");
                    setIsOrganizing(false);
                    db.invalidateCache('index.php?action=get_videos');
                    db.setHomeDirty();
                }
            } catch (e: any) {
                addToLog(`Error: ${e.message}`);
                setIsOrganizing(false);
            }
        };

        processBatch();
    };

    // Helpers
    const getEstimatedTime = (count: number, secsPerItem: number) => {
        const totalSecs = count * secsPerItem;
        const mins = Math.floor(totalSecs / 60);
        const secs = Math.floor(totalSecs % 60);
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Database size={24} className="text-indigo-400"/>
                <h2 className="text-2xl font-bold text-white">Gestión de Librería</h2>
            </div>

            {/* STEP 1: INDEX */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                        Indexar Archivos
                    </h3>
                    {isIndexing && <Loader2 className="animate-spin text-blue-500"/>}
                </div>
                
                <div className="flex gap-3">
                    <input 
                        type="text" 
                        value={localPath} 
                        onChange={e => setLocalPath(e.target.value)} 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white" 
                        placeholder="/storage/..." 
                    />
                    <button 
                        onClick={handleIndexLibrary} 
                        disabled={isIndexing || activeScan || isOrganizing}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                        <FolderSearch size={16}/> Escanear
                    </button>
                </div>
                {isIndexing && <div className="mt-2 h-1 bg-blue-900/30 w-full overflow-hidden rounded"><div className="h-full bg-blue-500 w-1/3 animate-progress-indeterminate"></div></div>}
            </div>

            {/* STEP 2: PROCESS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-emerald-500/20 text-emerald-400 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                        Extracción de Datos
                    </h3>
                    {activeScan && <div className="text-xs font-mono text-emerald-400 animate-pulse">PROCESANDO</div>}
                </div>

                {!activeScan ? (
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Límite (Opcional)</label>
                            <input 
                                type="number" 
                                value={step2Limit} 
                                onChange={e => setStep2Limit(e.target.value)} 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" 
                                placeholder="Sin límite (Todos)" 
                            />
                        </div>
                        <button 
                            onClick={startBrowserScan} 
                            disabled={isIndexing || isOrganizing}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm flex items-center gap-2 h-[38px]"
                        >
                            <Film size={16}/> Iniciar Escáner
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Video {currentScanIndex + 1} de {scanQueue.length}</span>
                            <span>Estimado: {getEstimatedTime(scanQueue.length - currentScanIndex, 2.5)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${((currentScanIndex) / scanQueue.length) * 100}%`}}></div>
                        </div>
                        
                        {/* THE SCANNER MODAL EMBEDDED OR OVERLAY - Keep Overlay for focus */}
                    </div>
                )}
            </div>

            {/* STEP 3: ORGANIZE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                        Organización Inteligente
                    </h3>
                    {isOrganizing && <Loader2 className="animate-spin text-purple-500"/>}
                </div>

                {!isOrganizing ? (
                    <button 
                        onClick={handleSmartOrganize} 
                        disabled={isIndexing || activeScan}
                        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Wand2 size={18}/> Organizar y Publicar Todos
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Procesando lotes...</span>
                            <span>{organizeProgress.processed} completados</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            {/* Indeterminate if total unknown, else determinate */}
                            <div className="h-full bg-purple-500 animate-pulse w-full"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* LOG CONSOLE */}
            <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 h-48 overflow-y-auto shadow-inner relative">
                <div className="absolute top-2 right-2 opacity-50"><Terminal size={14}/></div>
                {scanLog.length === 0 && <div className="text-slate-600 italic">Esperando comandos...</div>}
                {scanLog.map((line, i) => (
                    <div key={i} className="pb-0.5 border-b border-slate-900/50 truncate">{line}</div>
                ))}
            </div>

            {/* OVERLAY SCANNER PLAYER (HIDDEN BUT ACTIVE) */}
            {activeScan && scanQueue.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 p-6 shadow-2xl">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Film className="text-emerald-400"/> Escaneando...</h3>
                        <ScannerPlayer 
                            key={scanQueue[currentScanIndex].id}
                            video={scanQueue[currentScanIndex]} 
                            onComplete={handleVideoProcessed} 
                        />
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Progreso: {Math.round(((currentScanIndex) / scanQueue.length) * 100)}%</span>
                                <span>{currentScanIndex + 1}/{scanQueue.length}</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${((currentScanIndex) / scanQueue.length) * 100}%`}}></div>
                            </div>
                            <button onClick={stopActiveScan} className="w-full mt-4 py-2 text-red-400 hover:bg-slate-800 rounded text-xs font-bold">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
