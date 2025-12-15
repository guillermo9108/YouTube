
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { FolderSearch, Loader2, Terminal, Film, Play, AlertCircle, Wand2, Database, Edit3, Sparkles } from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Cargando...');
    const processedRef = useRef(false);

    // CRITICAL FIX: If video is local, browsers cannot load "/volume1/..." or "C:/" directly.
    // We MUST use the PHP stream proxy.
    let streamSrc = video.videoUrl;
    const isLocal = Boolean(video.isLocal) || (video as any).isLocal === 1 || (video as any).isLocal === "1";

    if (isLocal) {
        streamSrc = `api/index.php?action=stream&id=${video.id}`;
    }

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        
        processedRef.current = false;
        setStatus('Iniciando...');
        
        // Reset
        vid.currentTime = 0;
        vid.src = streamSrc;
        vid.load();

        const startPlay = async () => {
            try {
                vid.muted = true; // Always mute for autoplay
                await vid.play();
                setStatus('Procesando...');
            } catch (e) {
                console.warn("Autoplay blocked or load error", e);
                setStatus('Esperando click manual...');
                // Fallback: try to force metadata load at least
                if (vid.readyState >= 1) {
                    setStatus('Listo para captura');
                }
            }
        };
        
        // Small delay to ensure DOM is ready
        const timer = setTimeout(startPlay, 250);
        return () => clearTimeout(timer);
    }, [video.id, streamSrc]); 

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (!vid || processedRef.current) return;

        // Ensure we have loaded some video data (skip black frames at 0s)
        if (vid.currentTime > 1.5 && vid.videoWidth > 0) {
            vid.pause();
            processedRef.current = true;
            setStatus('Capturando...');

            const duration = vid.duration && isFinite(vid.duration) ? vid.duration : 0;
            
            try {
                const canvas = document.createElement('canvas');
                canvas.width = vid.videoWidth || 640;
                canvas.height = vid.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (blob) {
                            const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
                            onComplete(duration, file);
                        } else {
                            // If canvas is tainted or empty, save duration but no thumb
                            onComplete(duration, null);
                        }
                    }, 'image/jpeg', 0.8);
                } else {
                    onComplete(duration, null);
                }
            } catch (err) {
                console.error("Canvas error", err);
                onComplete(duration, null);
            }
        }
    };

    const handleError = (e: any) => {
        if (processedRef.current) return;
        console.error("Video Load Error", streamSrc, e);
        setStatus("Error de Reproducción. Saltando...");
        
        // Auto-skip after delay if it fails to play (e.g. codec not supported)
        setTimeout(() => {
            if (!processedRef.current) {
                processedRef.current = true;
                // Return 0 duration and null thumb so the queue continues
                onComplete(0, null);
            }
        }, 1500); 
    };

    return (
        <div className="w-full max-w-lg mx-auto mb-4">
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video group">
                <video 
                    ref={videoRef} 
                    className="w-full h-full object-contain" 
                    controls={true} 
                    playsInline
                    muted={true}
                    preload="auto"
                    crossOrigin="anonymous" 
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                />
                
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 z-20 pointer-events-none">
                    <div className="flex items-center gap-2">
                        {status === 'Procesando...' || status === 'Capturando...' ? (
                            <Loader2 size={12} className="animate-spin text-emerald-400"/>
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        )}
                        <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">{status}</span>
                    </div>
                </div>
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 px-2 truncate">
                Src: {streamSrc}
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    
    // Config
    const [localPath, setLocalPath] = useState('');
    const [step2Limit, setStep2Limit] = useState(''); 
    
    // States
    const [isIndexing, setIsIndexing] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [isRectifying, setIsRectifying] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    
    // Data
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const [organizeProgress, setOrganizeProgress] = useState({processed: 0, total: 0});
    const [rectifyProgress, setRectifyProgress] = useState(0);

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
        });
    }, []);

    const addToLog = (msg: string) => {
        setScanLog(prev => [`> ${msg}`, ...prev].slice(0, 100));
    };

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

    const startBrowserScan = async () => {
        addToLog("Cargando videos pendientes...");
        const limit = step2Limit ? parseInt(step2Limit) : 0; 
        
        try {
            const pending = await db.getUnprocessedVideos(limit);

            if (pending.length === 0) {
                addToLog("No hay videos pendientes (PENDING).");
                return;
            }
            
            addToLog(`Iniciando escáner para ${pending.length} videos.`);
            setScanQueue(pending);
            setCurrentScanIndex(0);
            setActiveScan(true);
        } catch (e: any) {
            addToLog(`Error cargando cola: ${e.message}`);
        }
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

    const handleSmartOrganize = async () => {
        setIsOrganizing(true);
        setOrganizeProgress({processed: 0, total: 100}); 
        addToLog("Iniciando organización por lotes...");
        
        const processBatch = async () => {
            try {
                const res = await db.smartOrganizeLibrary();
                
                if (res.details) res.details.forEach((d: string) => addToLog(d));
                
                if (res.remaining && res.remaining > 0) {
                    addToLog(`Quedan ${res.remaining} videos. Continuando...`);
                    const remaining = res.remaining || 0;
                    setOrganizeProgress(prev => ({
                        processed: prev.processed + res.processed, 
                        total: prev.processed + res.processed + remaining
                    }));
                    setTimeout(processBatch, 500);
                } else {
                    addToLog("Organización Finalizada.");
                    toast.success("Paso 3 Completado");
                    setIsOrganizing(false);
                    db.invalidateCache('get_videos');
                    db.setHomeDirty();
                }
            } catch (e: any) {
                addToLog(`Error: ${e.message}`);
                setIsOrganizing(false);
            }
        };

        processBatch();
    };

    const handleRectifyTitles = async () => {
        if (!confirm("Esto reanalizará TODOS los videos de la librería (no pendientes) para corregir sus nombres y descripciones basándose en la estructura de carpetas actual. ¿Continuar?")) return;
        
        setIsRectifying(true);
        setRectifyProgress(0);
        addToLog("Iniciando rectificación masiva...");
        
        const processRectifyBatch = async (lastId = '') => {
            try {
                const res = await db.rectifyLibraryTitles(lastId);
                
                setRectifyProgress(prev => prev + res.processed);
                
                if (!res.completed) {
                    addToLog(`Procesados ${res.processed} videos...`);
                    setTimeout(() => processRectifyBatch(res.lastId), 200); 
                } else {
                    addToLog("Rectificación completada.");
                    toast.success("Títulos actualizados correctamente");
                    setIsRectifying(false);
                    db.invalidateCache('get_videos');
                    db.setHomeDirty();
                }
            } catch (e: any) {
                addToLog(`Error Rectificación: ${e.message}`);
                setIsRectifying(false);
            }
        };

        processRectifyBatch();
    };

    // --- STEP 5: AI ORGANIZATION ---
    const handleAiOrganize = async () => {
        setIsAiProcessing(true);
        addToLog("Contactando Google Gemini...");
        
        // Recursive batching logic handled by backend? No, backend handles one batch. We loop here.
        const processAiBatch = async () => {
            try {
                const res = await db.organizeWithAi();
                if (res.processed === 0) {
                    addToLog("AI: " + res.message);
                    setIsAiProcessing(false);
                    toast.success("Organización IA Completada");
                    return;
                }

                addToLog(`AI: Clasificados ${res.processed} videos.`);
                // Recursion
                setTimeout(processAiBatch, 1000); 
            } catch (e: any) {
                addToLog(`Error AI: ${e.message}`);
                setIsAiProcessing(false);
            }
        };

        processAiBatch();
    };

    const getEstimatedTime = (count: number, secsPerItem: number) => {
        const totalSecs = count * secsPerItem;
        const mins = Math.floor(totalSecs / 60);
        const secs = Math.floor(totalSecs % 60);
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center gap-3 mb-2">
                <Database size={24} className="text-indigo-400"/>
                <h2 className="text-2xl font-bold text-white">Gestión de Librería</h2>
            </div>

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
                        disabled={isIndexing || activeScan || isOrganizing || isRectifying || isAiProcessing}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                        <FolderSearch size={16}/> Escanear
                    </button>
                </div>
                {isIndexing && <div className="mt-2 h-1 bg-blue-900/30 w-full overflow-hidden rounded"><div className="h-full bg-blue-500 w-1/3 animate-progress-indeterminate"></div></div>}
            </div>

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
                            disabled={isIndexing || isOrganizing || isRectifying || isAiProcessing}
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
                    </div>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                        Organización Básica
                    </h3>
                    {isOrganizing && <Loader2 className="animate-spin text-purple-500"/>}
                </div>

                {!isOrganizing ? (
                    <button 
                        onClick={handleSmartOrganize} 
                        disabled={isIndexing || activeScan || isRectifying || isAiProcessing}
                        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Wand2 size={18}/> Organizar y Publicar
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Procesando lotes...</span>
                            <span>{organizeProgress.processed} completados</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 animate-pulse w-full"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* STEP 4: RECTIFY */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-amber-500/20 text-amber-400 w-6 h-6 rounded flex items-center justify-center text-xs">4</span>
                        Rectificar Títulos
                    </h3>
                    {isRectifying && <Loader2 className="animate-spin text-amber-500"/>}
                </div>
                
                <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-2 rounded border border-slate-800/50">
                    Reanalizará carpetas y actualizará nombres basándose en la estructura actual.
                </p>

                {!isRectifying ? (
                    <button 
                        onClick={handleRectifyTitles} 
                        disabled={isIndexing || activeScan || isOrganizing || isAiProcessing}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Edit3 size={18}/> Corregir Nombres
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Analizando librería...</span>
                            <span>{rectifyProgress} procesados</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 animate-pulse w-full"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* STEP 5: AI ORGANIZATION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-pink-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="bg-pink-500/20 text-pink-400 w-6 h-6 rounded flex items-center justify-center text-xs">5</span>
                        Organizar con IA
                    </h3>
                    {isAiProcessing && <Loader2 className="animate-spin text-pink-500"/>}
                </div>
                
                <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-2 rounded border border-slate-800/50">
                    Usa <strong>Google Gemini Flash</strong> (Gratis) para clasificar videos en categorías basándose en el nombre y la carpeta contenedora. Requiere API Key en Configuración.
                </p>

                {!isAiProcessing ? (
                    <button 
                        onClick={handleAiOrganize} 
                        disabled={isIndexing || activeScan || isOrganizing || isRectifying}
                        className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-900/20"
                    >
                        <Sparkles size={18}/> Clasificar con Inteligencia Artificial
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="text-xs text-pink-400 font-bold animate-pulse text-center">
                            Analizando con Gemini...
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 animate-progress-indeterminate"></div>
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
