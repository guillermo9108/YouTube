
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video, SystemSettings } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    FolderSearch, Loader2, Terminal, Film, Wand2, Database, RefreshCw, 
    CheckCircle2, Clock, AlertTriangle, ShieldAlert, Sparkles, Layers, 
    HardDrive, List, Play, ChevronRight 
} from 'lucide-react';

interface ScannerPlayerProps {
    video: Video;
    onComplete: (dur: number, thumb: File | null, success: boolean, clientIncompatible?: boolean) => void;
}

const ScannerPlayer: React.FC<ScannerPlayerProps> = ({ video, onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Iniciando...');
    const processedRef = useRef(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        vid.src = video.videoUrl.includes('action=stream') ? video.videoUrl : `api/index.php?action=stream&id=${video.id}`;
        vid.muted = true;
        
        timeoutRef.current = window.setTimeout(() => {
            if (!processedRef.current) {
                const dur = (vid.duration && isFinite(vid.duration)) ? vid.duration : 0;
                onComplete(dur, null, dur > 0, true);
                processedRef.current = true;
            }
        }, 10000);

        vid.play().catch(() => {
            setStatus('Codec no soportado');
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [video]);

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (vid.videoWidth === 0 && vid.duration > 0) {
            processedRef.current = true;
            setStatus('Incompatible (Audio Mode)');
            onComplete(vid.duration, null, true, true);
        }
    };

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        if (processedRef.current) return;

        if (vid.currentTime > 1.2 && vid.videoWidth > 0) {
            processedRef.current = true;
            setStatus('Capturando...');
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vid, 0, 0);
                canvas.toBlob(blob => {
                    const file = blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null;
                    onComplete(vid.duration, file, true, false);
                }, 'image/jpeg', 0.8);
            } else onComplete(vid.duration, null, true, false);
        }
    };

    return (
        <div className="bg-black rounded-lg overflow-hidden aspect-video relative border border-slate-800 shadow-2xl">
            <video 
                ref={videoRef} 
                className="w-full h-full object-contain" 
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate} 
                onError={() => {
                    if (!processedRef.current) {
                        onComplete(0, null, false, true);
                        processedRef.current = true;
                    }
                }} 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="bg-indigo-600 px-2 py-0.5 rounded text-[9px] text-white font-black uppercase animate-pulse">Scanner</span>
                <span className="text-[10px] text-slate-300 font-mono truncate max-w-[200px]">{status}</span>
            </div>
        </div>
    );
};

export default function AdminLibrary() {
    const toast = useToast();
    const [localPath, setLocalPath] = useState('');
    const [libraryPaths, setLibraryPaths] = useState<string[]>([]);
    const [isIndexing, setIsIndexing] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [isReorganizingAll, setIsReorganizingAll] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scanQueue, setScanQueue] = useState<Video[]>([]);
    const [currentScanIndex, setCurrentScanIndex] = useState(0);
    const [stats, setStats] = useState({ pending: 0, processing: 0, public: 0, broken: 0, general: 0, total: 0 });

    const loadSettings = async () => {
        try {
            const s = await db.getSystemSettings();
            setLocalPath(s.localLibraryPath || '');
            setLibraryPaths(s.libraryPaths || []);
        } catch(e) {}
    };

    const loadStats = async () => {
        try {
            const all = await db.getAllVideos();
            const unprocessed = await db.getUnprocessedVideos(9999, 'normal');
            const procCount = all.filter(v => v.category === 'PROCESSING').length;
            const brokenCount = all.filter(v => Number(v.duration) <= 0 || v.thumbnailUrl.includes('default.jpg')).length;
            const generalCount = all.filter(v => v.category === 'GENERAL').length;
            
            setStats({ 
                pending: unprocessed.length, 
                processing: procCount,
                public: all.filter(v => !['PENDING', 'PROCESSING', 'FAILED_METADATA'].includes(v.category)).length,
                broken: brokenCount,
                general: generalCount,
                total: all.length + unprocessed.length
            });
        } catch(e) {}
    };

    useEffect(() => { 
        loadSettings();
        loadStats();
    }, []);

    const addToLog = (msg: string) => { setScanLog(prev => [`> ${msg}`, ...prev].slice(0, 50)); };

    const handleStep1 = async (useGlobalPaths: boolean = false) => {
        // Permitimos escanear si hay una ruta escrita O si hay rutas configuradas globalmente
        if (!useGlobalPaths && !localPath.trim()) {
            toast.warning("Escribe una ruta o usa el escaneo de volúmenes configurados.");
            return;
        }

        setIsIndexing(true);
        addToLog(useGlobalPaths ? 'Iniciando escaneo MULTI-VOLUMEN...' : `Escaneando ruta: ${localPath}`);
        
        try {
            // Sincronizamos la ruta local si se escribió algo
            if (localPath.trim()) {
                await db.updateSystemSettings({ localLibraryPath: localPath });
            }

            // Si es global, pasamos string vacío para que el backend use los libraryPaths de MariaDB
            const res = await db.scanLocalLibrary(useGlobalPaths ? '' : localPath);
            
            if (res.errors && res.errors.length > 0) {
                res.errors.forEach((err: string) => addToLog(`ERROR: ${err}`));
            }

            addToLog(`Escaneo completado. Encontrados: ${res.totalFound}. Nuevos: ${res.newToImport}`);
            toast.success("Paso 1 Finalizado");
            loadStats();
        } catch (e: any) { addToLog(`ERROR CRÍTICO: ${e.message}`); }
        finally { setIsIndexing(false); }
    };

    const handleStep2 = async () => {
        addToLog("Buscando videos PENDING...");
        try {
            const pending = await db.getUnprocessedVideos(50, 'normal');
            if (pending.length === 0) {
                addToLog("No hay videos PENDING.");
                return;
            }
            setScanQueue(pending);
            setCurrentScanIndex(0);
            setActiveScan(true);
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
    };

    const handleVideoProcessed = async (duration: number, thumbnail: File | null, success: boolean, clientIncompatible: boolean = false) => {
        const item = scanQueue[currentScanIndex];
        try {
            const fd = new FormData();
            fd.append('id', item.id);
            fd.append('duration', String(duration));
            fd.append('success', success ? '1' : '0');
            fd.append('clientIncompatible', clientIncompatible ? '1' : '0');
            if (thumbnail) fd.append('thumbnail', thumbnail);

            await db.request(`action=update_video_metadata`, { method: 'POST', body: fd });
            
            let logMsg = success ? `[OK] ${item.title}` : `[FAIL] ${item.title}`;
            if (clientIncompatible) logMsg += " (Servidor extraerá thumb)";
            addToLog(logMsg);
        } catch (e) { console.error(e); }
        
        if (currentScanIndex + 1 >= scanQueue.length) {
            setActiveScan(false);
            toast.success("Lote procesado");
            loadStats();
        } else {
            setCurrentScanIndex(prev => prev + 1);
        }
    };

    const handleStep3 = async () => {
        setIsOrganizing(true);
        addToLog("Iniciando Organización de videos...");
        try {
            const res = await db.smartOrganizeLibrary();
            addToLog(`Procesados: ${res.processed}. Pendientes: ${res.remaining}`);
            if (res.processed > 0) {
                toast.success("Publicación completada");
                db.setHomeDirty();
            } else addToLog("No hay videos en PROCESSING.");
            loadStats();
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsOrganizing(false); }
    };

    const handleStep4 = async () => {
        setIsFixing(true);
        addToLog("Iniciando Mantenimiento Avanzado...");
        try {
            const res = await db.fixLibraryMetadata();
            addToLog(`Mantenimiento completado.`);
            addToLog(`- Videos rotos reseteados: ${res.fixedBroken}`);
            addToLog(`- Videos re-categorizados: ${res.reCategorized}`);
            if (res.fixedBroken > 0 || res.reCategorized > 0) {
                toast.success("Mantenimiento finalizado");
                db.setHomeDirty();
            } else {
                addToLog("No se requirieron cambios.");
            }
            loadStats();
        } catch (e: any) { addToLog(`Error: ${e.message}`); }
        finally { setIsFixing(false); }
    };

    const handleStep5 = async () => {
        if (!confirm("Esto analizará TODOS los videos de la base de datos y los moverá a sus categorías/precios correctos según la configuración actual de Admin. ¿Continuar?")) return;
        
        setIsReorganizingAll(true);
        addToLog("Iniciando Re-sincronización Global...");
        try {
            const res = await db.reorganizeAllVideos();
            addToLog(`Re-sincronización finalizada.`);
            addToLog(`- Videos actualizados: ${res.processed} de ${res.total}`);
            toast.success("Librería actualizada al 100%");
            db.setHomeDirty();
            loadStats();
        } catch (e: any) { addToLog(`Error Global: ${e.message}`); }
        finally { setIsReorganizingAll(false); }
    };

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto px-2">
            <h2 className="text-2xl font-black flex items-center gap-2 text-white uppercase italic tracking-tighter">
                <Database className="text-indigo-500"/> Gestión de Librería
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center shadow-lg">
                    <div className="text-slate-500 text-[10px] font-black uppercase mb-1">P1: Registro</div>
                    <div className="text-xl font-black text-amber-500 flex items-center justify-center gap-1"><Clock size={16}/> {stats.pending}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center shadow-lg">
                    <div className="text-slate-500 text-[10px] font-black uppercase mb-1">P2: Extracción</div>
                    <div className="text-xl font-black text-blue-500 flex items-center justify-center gap-1"><RefreshCw size={16}/> {stats.processing}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center shadow-lg">
                    <div className="text-slate-500 text-[10px] font-black uppercase mb-1">P3: Listos</div>
                    <div className="text-xl font-black text-emerald-500 flex items-center justify-center gap-1"><CheckCircle2 size={16}/> {stats.public}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center shadow-lg">
                    <div className="text-slate-500 text-[10px] font-black uppercase mb-1">P4: Mantenimiento</div>
                    <div className="text-xl font-black text-red-500 flex items-center justify-center gap-1"><ShieldAlert size={16}/> {stats.broken + stats.general}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center shadow-lg">
                    <div className="text-slate-500 text-[10px] font-black uppercase mb-1">TOTAL DB</div>
                    <div className="text-xl font-black text-indigo-400 flex items-center justify-center gap-1"><Layers size={16}/> {stats.total}</div>
                </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl space-y-8">
                
                {/* PASO 1: REGISTRO FÍSICO */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">1</div>
                        <div>
                            <h3 className="font-black text-white text-sm uppercase tracking-widest leading-none">Registro Físico Multi-Disco</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Sincroniza archivos desde todos tus volúmenes</p>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                        {/* Listado de Rutas Activas */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-600 uppercase flex items-center gap-1 ml-1"><List size={10}/> Volúmenes a Procesar:</label>
                            <div className="flex flex-wrap gap-2">
                                <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-mono text-indigo-400 flex items-center gap-2">
                                    <HardDrive size={12}/> {localPath || '/root'} (Principal)
                                </div>
                                {libraryPaths.map((path, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-mono text-slate-300 flex items-center gap-2">
                                        <HardDrive size={12} className="text-slate-500"/> {path}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 pt-2">
                            <div className="flex-1 flex gap-2">
                                <input 
                                    type="text" 
                                    value={localPath} 
                                    onChange={e => setLocalPath(e.target.value)} 
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-indigo-500 transition-colors" 
                                    placeholder="Ruta específica para un escaneo rápido..." 
                                />
                                <button 
                                    onClick={() => handleStep1(false)} 
                                    disabled={isIndexing || !localPath.trim()} 
                                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white px-5 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    Escanear Esta
                                </button>
                            </div>
                            <button 
                                onClick={() => handleStep1(true)} 
                                disabled={isIndexing} 
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 py-3 md:px-8 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95"
                            >
                                {isIndexing ? <RefreshCw className="animate-spin" size={16}/> : <Layers size={16}/>} 
                                Escanear Todos los Discos
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PASO 2 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">2</div>
                            <h3 className="font-black text-white text-xs uppercase tracking-widest">Extracción de Medios</h3>
                        </div>
                        <button onClick={handleStep2} disabled={activeScan || stats.pending === 0} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl transition-all flex items-center justify-center gap-2">
                            <Film size={18}/> Iniciar Extracción ({stats.pending})
                        </button>
                    </div>

                    {/* PASO 3 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">3</div>
                            <h3 className="font-black text-white text-xs uppercase tracking-widest">Organización IA</h3>
                        </div>
                        <button onClick={handleStep3} disabled={isOrganizing || stats.processing === 0} className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl transition-all flex items-center justify-center gap-2">
                            {isOrganizing ? <RefreshCw className="animate-spin" size={18}/> : <Wand2 size={18}/>} Publicar ({stats.processing})
                        </button>
                    </div>
                </div>

                {/* BOTONES ADICIONALES */}
                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                    <button onClick={handleStep4} disabled={isFixing || (stats.broken === 0 && stats.general === 0)} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 py-3 rounded-xl font-bold text-[9px] uppercase tracking-[0.1em] text-slate-400 flex items-center justify-center gap-2">
                        {isFixing ? <RefreshCw className="animate-spin" size={14}/> : <ShieldAlert size={14}/>} Mantenimiento ({stats.broken})
                    </button>
                    <button onClick={handleStep5} disabled={isReorganizingAll || stats.total === 0} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 py-3 rounded-xl font-bold text-[9px] uppercase tracking-[0.1em] text-slate-400 flex items-center justify-center gap-2">
                        {isReorganizingAll ? <Loader2 className="animate-spin" size={14}/> : <Layers size={14}/>} Sincronizar Todo
                    </button>
                </div>
            </div>

            {/* CONSOLA LOG */}
            <div className="bg-black/80 p-4 rounded-2xl border border-slate-800 h-48 overflow-y-auto font-mono text-[10px] text-slate-500 shadow-inner custom-scrollbar">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                    <Terminal size={12} className="text-slate-600"/>
                    <span className="font-black uppercase tracking-widest opacity-40">System Output</span>
                </div>
                {scanLog.map((l, i) => (
                    <div key={i} className={`py-1 ${l.includes('ERROR') ? 'text-red-400' : (l.includes('[OK]') ? 'text-emerald-400' : (l.includes('MULTI') ? 'text-indigo-400' : ''))}`}>
                        <span className="opacity-20 mr-2">[{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                        {l}
                    </div>
                ))}
                {scanLog.length === 0 && <p className="italic opacity-30">Esperando comandos...</p>}
            </div>

            {/* MODAL DE ESCANEO ACTIVO */}
            {activeScan && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-700 w-full max-w-md text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800">
                            <div className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_15px_rgba(79,70,229,0.6)]" style={{ width: `${((currentScanIndex + 1) / scanQueue.length) * 100}%` }}></div>
                        </div>
                        
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 mb-4 animate-bounce">
                                <Film size={32}/>
                            </div>
                            <h4 className="font-black text-white uppercase tracking-tighter text-xl leading-none">
                                Procesando Archivo
                            </h4>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
                                {currentScanIndex + 1} de {scanQueue.length}
                            </p>
                        </div>

                        <p className="text-[10px] text-indigo-400 mb-6 truncate font-mono bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10 italic">
                            {scanQueue[currentScanIndex].title}
                        </p>
                        
                        <ScannerPlayer key={scanQueue[currentScanIndex].id} video={scanQueue[currentScanIndex]} onComplete={handleVideoProcessed} />
                        
                        <button onClick={() => setActiveScan(false)} className="mt-8 w-full bg-red-950/20 hover:bg-red-900/40 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl border border-red-900/30 transition-all active:scale-95">Detener Escáner</button>
                    </div>
                </div>
            )}
        </div>
    );
}
