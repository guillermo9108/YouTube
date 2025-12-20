import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { HardDrive, Trash2, Wand2, RefreshCw, Loader2, FileVideo, AlertCircle, CheckCircle, Info, Move, Settings2, PlayCircle, Filter, ChevronRight, PieChart, Database, ListFilter, Trash, CheckSquare, Square, Layers, Play, Pause, FastForward, Clock, Calendar, Hash, Eye, Tv, Map, FolderOpen, FileJson, Check, Save } from 'lucide-react';

const PAQUETE_CATEGORIES = [
    { id: "01", label: "Actualizaciones y Software" },
    { id: "02", label: "Series Extranjeras" },
    { id: "03", label: "Cine Estrenos" },
    { id: "04", label: "Cine Catálogo" },
    { id: "05", label: "Documentales" },
    { id: "06", label: "Revistas y PDF" },
    { id: "07", label: "Novelas" },
    { id: "08", label: "Programas TV" },
    { id: "09", label: "Dibujos Animados" },
    { id: "10", label: "Música y Clips" },
    { id: "11", label: "Deporte" },
    { id: "12", label: "Variedades" },
    { id: "13", label: "Trailers y Promos" }
];

export default function AdminLocalFiles() {
    const toast = useToast();
    const [stats, setStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'STORAGE' | 'JANITOR' | 'LIBRARIAN' | 'CONVERTER'>('STORAGE');
    
    // Janitor State
    const [cleanupType, setCleanupType] = useState<'ORPHAN_DB' | 'LOW_PERFORMANCE'>('LOW_PERFORMANCE');
    const [cleanupPreview, setCleanupPreview] = useState<Video[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSearching, setIsSearching] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [cleanupParams, setCleanupParams] = useState({ days: 30, views: 5, minSizeMB: 100 });

    // Librarian State
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [paqueteMapper, setPaqueteMapper] = useState<Record<string, string>>({});
    const [showMapper, setShowMapper] = useState(false);

    // Converter State
    const [nonWebVideos, setNonWebVideos] = useState<Video[]>([]);
    const [transcodePreset, setTranscodePreset] = useState<'fast' | 'medium' | 'slow'>('fast');
    const [queue, setQueue] = useState<{ id: string, title: string, status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' }[]>([]);
    const [isQueueRunning, setIsQueueRunning] = useState(false);
    const queueAbortRef = useRef(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sRes, statRes] = await Promise.all([
                db.getSystemSettings(),
                db.request<any>('action=admin_get_local_stats')
            ]);
            setSettings(sRes);
            setStats(statRes);
            setPaqueteMapper(sRes.paqueteMapper || {});

            const all = await db.getAllVideos();
            const badFormat = all.filter(v => {
                const ext = v.videoUrl.split('.').pop()?.toLowerCase();
                return v.isLocal && ext && !['mp4', 'webm'].includes(ext);
            });
            setNonWebVideos(badFormat);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    // --- JANITOR LOGIC ---
    const handleSearchCleanup = async () => {
        setIsSearching(true);
        setCleanupPreview([]);
        setSelectedIds(new Set());
        try {
            const query = `action=admin_file_cleanup_preview&type=${cleanupType}&days=${cleanupParams.days}&views=${cleanupParams.views}&minSizeMB=${cleanupParams.minSizeMB}`;
            const res = await db.request<Video[]>(query);
            setCleanupPreview(res);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const handleExecuteCleanup = async (deletePhysical: boolean) => {
        if (!confirm(deletePhysical ? "¿ELIMINAR ARCHIVOS REALES?" : "¿Borrar solo registros?")) return;
        setIsExecuting(true);
        try {
            await db.request(`action=admin_file_cleanup_execute`, {
                method: 'POST',
                body: JSON.stringify({ ids: Array.from(selectedIds), deletePhysical })
            });
            toast.success("Limpieza finalizada.");
            loadData();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsExecuting(false); }
    };

    // --- LIBRARIAN LOGIC ---
    const handleSaveMapper = async () => {
        try {
            await db.updateSystemSettings({ ...settings, paqueteMapper });
            toast.success("Mapeador guardado");
            setShowMapper(false);
        } catch (e) { toast.error("Fallo al guardar"); }
    };

    const handleOrganizePaquete = async () => {
        setIsOrganizing(true);
        try {
            // FIX: Removed duplicate action=action=
            const res = await db.request<any>(`action=admin_organize_paquete`, { method: 'POST' });
            toast.success(`Organización terminada. Movidos: ${res.moved}`);
            if (res.indexGenerated) toast.info("index.json generado correctamente");
            loadData();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    // --- CONVERTER LOGIC ---
    const startConversionQueue = () => {
        const initialQueue = nonWebVideos.map(v => ({ id: v.id, title: v.title, status: 'PENDING' as const }));
        setQueue(initialQueue);
        setIsQueueRunning(true);
        queueAbortRef.current = false;
        processNextInQueue(initialQueue, 0);
    };

    const processNextInQueue = async (currentQueue: typeof queue, index: number) => {
        if (index >= currentQueue.length || queueAbortRef.current) {
            setIsQueueRunning(false);
            loadData();
            return;
        }
        setQueue(prev => prev.map((item, i) => i === index ? { ...item, status: 'PROCESSING' } : item));
        try {
            await db.request(`action=admin_transcode_video`, {
                method: 'POST',
                body: JSON.stringify({ id: currentQueue[index].id, preset: transcodePreset })
            });
            setQueue(prev => prev.map((item, i) => i === index ? { ...item, status: 'DONE' } : item));
        } catch (e) {
            setQueue(prev => prev.map((item, i) => i === index ? { ...item, status: 'FAILED' } : item));
        }
        setTimeout(() => processNextInQueue(currentQueue, index + 1), 1000);
    };

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button onClick={() => setActiveTab(id)} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition-all border-b-2 font-bold text-[10px] uppercase tracking-wider ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <Icon size={18} /> {label}
        </button>
    );

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-4 animate-in fade-in pb-20 max-w-4xl mx-auto">
            <div className="flex bg-slate-900 border-b border-slate-800 sticky top-0 z-20 -mx-2 px-2 md:mx-0 md:rounded-t-xl overflow-hidden shadow-lg backdrop-blur-md">
                <TabBtn id="STORAGE" label="Dashboard" icon={PieChart} />
                <TabBtn id="JANITOR" label="Limpieza" icon={Trash2} />
                <TabBtn id="LIBRARIAN" label="Librarian" icon={Move} />
                <TabBtn id="CONVERTER" label="Convertir" icon={PlayCircle} />
            </div>

            {activeTab === 'STORAGE' && (
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-0">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Capacidad</h4>
                                <HardDrive size={20} className="text-indigo-500" />
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative w-24 h-24 shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500" strokeWidth="3" strokeDasharray={`${Math.min(100, Math.max(0, (stats?.disk_free / stats?.disk_total) * 100))}, 100`} />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center font-black text-white">{Math.round((stats?.disk_free / stats?.disk_total) * 100)}%</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white">{stats?.disk_free} GB</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Libres de {stats?.disk_total} GB</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Contenido</h4>
                                <Database size={20} className="text-emerald-500" />
                            </div>
                            <div className="text-4xl font-black text-white">{stats?.db_videos}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Videos en base de datos</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'JANITOR' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 size={20}/></div>
                            <h3 className="font-bold text-white">The Janitor (Limpieza Inteligente)</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm">
                                <option value="LOW_PERFORMANCE">Bajo Rendimiento (Borrador)</option>
                                <option value="ORPHAN_DB">Registros Huérfanos (DB Limpia)</option>
                            </select>
                            <button onClick={handleSearchCleanup} disabled={isSearching} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                {isSearching ? <Loader2 className="animate-spin" size={18}/> : <Filter size={18}/>} Escanear
                            </button>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-black text-indigo-400 uppercase">{cleanupPreview.length} Candidatos</span>
                                <button onClick={() => handleExecuteCleanup(true)} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-2"><Trash size={14}/> Eliminar Físicamente</button>
                            </div>
                            <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
                                {cleanupPreview.map(v => (
                                    <div key={v.id} className="p-4 flex justify-between items-center">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{v.title}</div>
                                            <div className="text-[10px] text-slate-500">{v.views} vistas</div>
                                        </div>
                                        <span className="text-[10px] font-mono text-red-400 bg-red-900/10 px-2 rounded">{(v as any).size_bytes ? ((v as any).size_bytes / 1024 / 1024).toFixed(0) + ' MB' : '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center"><Move size={20}/></div>
                                <div>
                                    <h3 className="font-bold text-white">The Librarian</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Arquitectura Estilo Paquete</p>
                                </div>
                            </div>
                            <button onClick={() => setShowMapper(!showMapper)} className="p-2 bg-slate-800 text-indigo-400 rounded-lg"><Map size={20}/></button>
                        </div>

                        {showMapper && (
                            <div className="mb-6 space-y-3 animate-in slide-in-from-top-4">
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><Map size={14}/> Mapeador de Carpetas</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {PAQUETE_CATEGORIES.map(cat => (
                                            <div key={cat.id} className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">{cat.id} {cat.label}</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ruta relativa o nombre" 
                                                    value={paqueteMapper[cat.id] || ""}
                                                    onChange={e => setPaqueteMapper({...paqueteMapper, [cat.id]: e.target.value})}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleSaveMapper} className="w-full mt-6 py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"><Save size={16}/> Guardar Mapeo</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 bg-indigo-500/10 text-indigo-400 rounded flex items-center justify-center font-bold text-xs">01-13</div>
                                        <h4 className="font-bold text-white text-sm">Organización Jerárquica</h4>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">Mueve físicamente los archivos a carpetas numeradas (01-13) para forzar el orden alfabético perfecto. Incluye normalización y limpieza de nombres.</p>
                                </div>
                                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded flex items-center justify-center font-bold text-xs"><FileJson size={14}/></div>
                                        <h4 className="font-bold text-white text-sm">Generación de Índice</h4>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">Crea automáticamente un archivo index.json en la raíz para búsquedas ultra-rápidas en el frontend.</p>
                                </div>
                            </div>

                            <button onClick={handleOrganizePaquete} disabled={isOrganizing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                                {isOrganizing ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>} Ejecutar Limpieza y Organización
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'CONVERTER' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center"><PlayCircle size={20}/></div>
                                <div>
                                    <h3 className="font-bold text-white">Media Converter</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Optimización FFmpeg</p>
                                </div>
                            </div>
                            <select value={transcodePreset} onChange={e => setTranscodePreset(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] font-black text-white">
                                <option value="fast">Rápido (Media)</option>
                                <option value="medium">Equilibrado</option>
                                <option value="slow">Calidad (Lento)</option>
                            </select>
                        </div>

                        {nonWebVideos.length > 0 ? (
                            <div className="space-y-4">
                                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center">
                                    <div className="text-4xl font-black text-amber-500 mb-2">{nonWebVideos.length}</div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Videos Legacy Detectados</p>
                                </div>
                                {!isQueueRunning ? (
                                    <button onClick={startConversionQueue} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                                        <FastForward size={20}/> Convertir Todo
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="relative h-4 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_10px_#10b981]" style={{ width: `${Math.round((queue.filter(q => q.status === 'DONE').length / queue.length) * 100)}%` }}></div>
                                        </div>
                                        <p className="text-center text-[10px] font-bold text-slate-500">Procesando cola...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-12 text-center opacity-30 flex flex-col items-center gap-3">
                                <CheckCircle size={48} className="text-emerald-500"/>
                                <span className="font-bold text-xs uppercase tracking-widest">Sin videos pendientes</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}