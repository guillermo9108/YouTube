
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { HardDrive, Trash2, Wand2, RefreshCw, Loader2, FileVideo, AlertCircle, CheckCircle, Info, Move, Settings2, PlayCircle, Filter, ChevronRight, PieChart, Database, ListFilter, Trash, CheckSquare, Square, Layers, Play, Pause, FastForward, Clock } from 'lucide-react';

export default function AdminLocalFiles() {
    const toast = useToast();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'STORAGE' | 'JANITOR' | 'LIBRARIAN' | 'CONVERTER'>('STORAGE');
    
    // Janitor (Cleanup) State
    const [cleanupType, setCleanupType] = useState<'ORPHAN_DB' | 'LOW_PERFORMANCE'>('ORPHAN_DB');
    const [cleanupPreview, setCleanupPreview] = useState<Video[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSearching, setIsSearching] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [cleanupParams, setCleanupParams] = useState({ days: 30, views: 5, minSizeMB: 0 });

    // Librarian (Organizer) State
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [organizeStrategy, setOrganizeStrategy] = useState<'CATEGORY_FOLDERS' | 'FLATTEN' | 'SERIES_NESTING'>('CATEGORY_FOLDERS');
    const [organizeDryRun, setOrganizeDryRun] = useState(false);

    // Converter State
    const [nonWebVideos, setNonWebVideos] = useState<Video[]>([]);
    const [transcodePreset, setTranscodePreset] = useState<'fast' | 'medium' | 'slow'>('fast');
    
    // Queue System
    const [queue, setQueue] = useState<{ id: string, title: string, status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' }[]>([]);
    const [isQueueRunning, setIsQueueRunning] = useState(false);
    const queueAbortRef = useRef(false);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await db.request<any>('action=admin_get_local_stats');
            setStats(res);
            const all = await db.getAllVideos();
            const badFormat = all.filter(v => {
                const ext = v.videoUrl.split('.').pop()?.toLowerCase();
                return v.isLocal && ext && !['mp4', 'webm'].includes(ext);
            });
            setNonWebVideos(badFormat);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadStats(); }, []);

    // --- JANITOR LOGIC ---
    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === cleanupPreview.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(cleanupPreview.map(v => v.id)));
    };

    const handleSearchCleanup = async () => {
        setIsSearching(true);
        setCleanupPreview([]);
        setSelectedIds(new Set());
        try {
            const query = `action=admin_file_cleanup_preview&type=${cleanupType}&days=${cleanupParams.days}&views=${cleanupParams.views}&minSizeMB=${cleanupParams.minSizeMB}`;
            const res = await db.request<Video[]>(query);
            setCleanupPreview(res);
            if (res.length === 0) toast.info("No se hallaron archivos.");
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const handleExecuteCleanup = async (deletePhysical: boolean) => {
        const targets = cleanupPreview.filter(v => selectedIds.has(v.id));
        if (targets.length === 0) return;
        if (!confirm(deletePhysical ? `¿ELIMINAR ${targets.length} ARCHIVOS DEL DISCO?` : `¿Eliminar ${targets.length} registros DB?`)) return;

        setIsExecuting(true);
        try {
            await db.request(`action=admin_file_cleanup_execute`, {
                method: 'POST',
                body: JSON.stringify({ ids: Array.from(selectedIds), deletePhysical })
            });
            toast.success("Limpieza finalizada.");
            setCleanupPreview(prev => prev.filter(v => !selectedIds.has(v.id)));
            setSelectedIds(new Set());
            loadStats();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsExecuting(false); }
    };

    // --- LIBRARIAN LOGIC ---
    const handleOrganize = async () => {
        setIsOrganizing(true);
        try {
            const res = await db.request<any>(`action=admin_organize_physical_files`, {
                method: 'POST',
                body: JSON.stringify({ strategy: organizeStrategy, dryRun: organizeDryRun })
            });
            if (organizeDryRun) alert(`Simulación: Se moverían ${res.preview?.length || 0} archivos.`);
            else { toast.success(`Movidos: ${res.moved}`); loadStats(); }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    // --- CONVERTER QUEUE LOGIC ---
    const startConversionQueue = () => {
        if (nonWebVideos.length === 0) return;
        const initialQueue = nonWebVideos.map(v => ({ id: v.id, title: v.title, status: 'PENDING' as const }));
        setQueue(initialQueue);
        setIsQueueRunning(true);
        queueAbortRef.current = false;
        processNextInQueue(initialQueue, 0);
    };

    const processNextInQueue = async (currentQueue: typeof queue, index: number) => {
        if (index >= currentQueue.length || queueAbortRef.current) {
            setIsQueueRunning(false);
            if (!queueAbortRef.current) toast.success("Cola de conversión finalizada");
            loadStats();
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

        // Delay para no saturar procesos si el NAS es lento
        setTimeout(() => processNextInQueue(currentQueue, index + 1), 1000);
    };

    const stopQueue = () => {
        queueAbortRef.current = true;
        setIsQueueRunning(false);
        toast.info("Cola detenida por el usuario");
    };

    const totalReclaimable = useMemo(() => {
        const bytes = cleanupPreview
            .filter(v => selectedIds.has(v.id))
            .reduce((acc, v) => acc + ((v as any).size_bytes || 0), 0);
        return (bytes / 1024 / 1024 / 1024).toFixed(2);
    }, [cleanupPreview, selectedIds]);

    const queueProgress = useMemo(() => {
        if (queue.length === 0) return 0;
        const done = queue.filter(q => q.status === 'DONE' || q.status === 'FAILED').length;
        return Math.round((done / queue.length) * 100);
    }, [queue]);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition-all border-b-2 font-bold text-[10px] uppercase tracking-wider ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div className="space-y-4 animate-in fade-in pb-20 max-w-4xl mx-auto">
            {/* Header Tabs (Sticky) */}
            <div className="flex bg-slate-900 border-b border-slate-800 sticky top-0 z-20 -mx-2 px-2 md:mx-0 md:rounded-t-xl overflow-hidden shadow-lg backdrop-blur-md">
                <TabBtn id="STORAGE" label="Dashboard" icon={PieChart} />
                <TabBtn id="JANITOR" label="Limpieza" icon={Trash2} />
                <TabBtn id="LIBRARIAN" label="Organizar" icon={Move} />
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
                                    <div className="absolute inset-0 flex items-center justify-center text-center">
                                        <div className="text-xl font-black text-white">{Math.round((stats?.disk_free / stats?.disk_total) * 100)}%</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-3xl font-black text-white">{stats?.disk_free} GB</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Disponibles de {stats?.disk_total} GB</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Contenido Local</h4>
                                <Database size={20} className="text-emerald-500" />
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-4xl font-black text-white">{stats?.db_videos}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Archivos en base de datos</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-amber-500">{nonWebVideos.length}</div>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">Legacy / Otros</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={loadStats} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                        <RefreshCw size={18}/> Actualizar Métricas
                    </button>
                </div>
            )}

            {activeTab === 'JANITOR' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 size={20}/></div>
                            <h3 className="font-bold text-white">The Janitor</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm">
                                <option value="ORPHAN_DB">Registros Huérfanos (DB sin Archivo)</option>
                                <option value="LOW_PERFORMANCE">Poca Popularidad (Liberar Espacio)</option>
                            </select>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-500 shrink-0">PESO &gt;</label>
                                <input type="number" value={cleanupParams.minSizeMB} onChange={e => setCleanupParams({...cleanupParams, minSizeMB: parseInt(e.target.value) || 0})} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" placeholder="MB" />
                            </div>
                            <button onClick={handleSearchCleanup} disabled={isSearching} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                {isSearching ? <Loader2 className="animate-spin"/> : <RefreshCw size={18}/>} Escanear
                            </button>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center sticky top-[58px] z-10">
                                <button onClick={toggleAll} className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                    {selectedIds.size === cleanupPreview.length ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} />} Marcar Todos
                                </button>
                                <span className="text-[10px] font-black text-indigo-400 uppercase">{selectedIds.size} Seleccionados</span>
                            </div>
                            <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
                                {cleanupPreview.map(v => (
                                    <div key={v.id} onClick={() => toggleSelect(v.id)} className={`p-4 flex gap-3 cursor-pointer ${selectedIds.has(v.id) ? 'bg-indigo-500/10' : 'active:bg-slate-800'}`}>
                                        <div className={`w-5 h-5 rounded border mt-0.5 shrink-0 flex items-center justify-center ${selectedIds.has(v.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'}`}>
                                            {selectedIds.has(v.id) && <CheckCircle size={14} className="text-white"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{v.title}</div>
                                            <div className="text-[9px] text-slate-500 truncate font-mono">{v.videoUrl}</div>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[9px] font-bold text-red-400 bg-red-900/10 px-1 rounded uppercase">{(v as any).size_bytes ? ((v as any).size_bytes / 1024 / 1024).toFixed(0) + ' MB' : '-'}</span>
                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1 rounded uppercase">{v.views} vistas</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-950 border-t border-slate-800">
                                <div className="text-center mb-4">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Recuperarás aprox:</div>
                                    <div className="text-2xl font-black text-red-500">{totalReclaimable} GB</div>
                                </div>
                                <button disabled={selectedIds.size === 0 || isExecuting} onClick={() => handleExecuteCleanup(true)} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                                    {isExecuting ? <Loader2 className="animate-spin" /> : <Trash size={18}/>} ELIMINAR {selectedIds.size} ARCHIVOS
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center"><Move size={20}/></div>
                            <h3 className="font-bold text-white">The Librarian</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'CATEGORY_FOLDERS', label: 'Por Categoría', desc: '/ACCION/Peli.mp4', icon: Layers },
                                    { id: 'SERIES_NESTING', label: 'Series Independientes', desc: '/NARUTO/Ep 1.mp4', icon: ListFilter },
                                    { id: 'FLATTEN', label: 'Aplanar Raíz', desc: '/Todo_Aqui.mp4', icon: Square },
                                ].map(s => (
                                    <button 
                                        key={s.id} 
                                        onClick={() => setOrganizeStrategy(s.id as any)} 
                                        className={`p-4 rounded-xl border text-left flex items-center gap-4 transition-all ${organizeStrategy === s.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-500'}`}
                                    >
                                        <s.icon size={20} className={organizeStrategy === s.id ? 'text-indigo-400' : ''}/>
                                        <div>
                                            <div className="text-sm font-bold">{s.label}</div>
                                            <div className="text-[10px] font-mono opacity-60">{s.desc}</div>
                                        </div>
                                        {organizeStrategy === s.id && <CheckCircle size={16} className="ml-auto text-indigo-400"/>}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                                <input type="checkbox" id="dry-run" checked={organizeDryRun} onChange={e => setOrganizeDryRun(e.target.checked)} className="w-5 h-5 accent-indigo-500" />
                                <label htmlFor="dry-run" className="text-xs font-bold text-slate-400 flex-1">Modo Simulación (No mueve nada)</label>
                            </div>

                            <button onClick={handleOrganize} disabled={isOrganizing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                                {isOrganizing ? <Loader2 className="animate-spin"/> : <Wand2 size={20}/>} Organizar Biblioteca
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
                                    <p className="text-[9px] text-slate-500 font-bold uppercase">Optimización FFmpeg</p>
                                </div>
                            </div>
                            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 scale-90 origin-right">
                                {['fast', 'medium', 'slow'].map((p: any) => (
                                    <button key={p} onClick={() => setTranscodePreset(p)} className={`px-2 py-1 rounded text-[9px] font-black uppercase ${transcodePreset === p ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{p}</button>
                                ))}
                            </div>
                        </div>

                        {nonWebVideos.length > 0 ? (
                            <div className="space-y-4">
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Archivos pendientes</span>
                                    <span className="text-4xl font-black text-amber-500">{nonWebVideos.length}</span>
                                    <p className="text-[10px] text-slate-600 mt-2 text-center">Formatos como MKV, AVI o MOV requieren conversión para streaming.</p>
                                </div>

                                {!isQueueRunning ? (
                                    <button onClick={startConversionQueue} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                                        <FastForward size={20}/> Convertir Todo
                                    </button>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in">
                                        <div className="relative h-4 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_10px_#10b981]" style={{ width: `${queueProgress}%` }}></div>
                                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference">{queueProgress}% COMPLETADO</span>
                                        </div>
                                        <button onClick={stopQueue} className="w-full py-2 bg-red-900/20 text-red-500 border border-red-900/30 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                                            <Pause size={14}/> Detener Cola
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-10 text-center opacity-40 grayscale flex flex-col items-center gap-2">
                                <CheckCircle size={48} className="text-emerald-500"/>
                                <span className="font-bold text-xs uppercase">No hay tareas pendientes</span>
                            </div>
                        )}
                    </div>

                    {/* Queue Status List */}
                    {queue.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-2">
                            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <span className="text-xs font-bold text-white flex items-center gap-2"><Clock size={14}/> Cola de Trabajo</span>
                                <span className="text-[10px] font-bold text-slate-500">{queue.filter(q => q.status === 'DONE').length} / {queue.length}</span>
                            </div>
                            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
                                {queue.map((item, i) => (
                                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{item.title}</div>
                                            <div className={`text-[9px] font-black uppercase ${item.status === 'PROCESSING' ? 'text-amber-400 animate-pulse' : (item.status === 'DONE' ? 'text-emerald-400' : (item.status === 'FAILED' ? 'text-red-500' : 'text-slate-600'))}`}>
                                                {item.status}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {item.status === 'PROCESSING' ? <Loader2 size={16} className="animate-spin text-amber-400"/> : (item.status === 'DONE' ? <CheckCircle size={16} className="text-emerald-500"/> : (item.status === 'FAILED' ? <AlertCircle size={16} className="text-red-500"/> : <Clock size={16} className="text-slate-700"/>))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
