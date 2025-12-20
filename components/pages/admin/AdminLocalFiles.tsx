import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { HardDrive, Trash2, Wand2, RefreshCw, Loader2, FileVideo, AlertCircle, CheckCircle, Info, Move, Settings2, PlayCircle, Filter, ChevronRight, PieChart, Database, ListFilter, Trash, CheckSquare, Square } from 'lucide-react';

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
    const [organizeStrategy, setOrganizeStrategy] = useState<'CATEGORY_FOLDERS' | 'FLATTEN'>('CATEGORY_FOLDERS');
    const [organizeDryRun, setOrganizeDryRun] = useState(false);

    // Converter State
    const [nonWebVideos, setNonWebVideos] = useState<Video[]>([]);
    const [isTranscoding, setIsTranscoding] = useState<string | null>(null);
    const [transcodePreset, setTranscodePreset] = useState<'fast' | 'medium' | 'slow'>('fast');

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
        
        const msg = deletePhysical 
            ? `¿ELIMINAR ${targets.length} ARCHIVOS DEL DISCO? Esta acción no se puede deshacer.`
            : `¿Eliminar ${targets.length} registros de la base de datos? Los archivos físicos se mantendrán.`;
        
        if (!confirm(msg)) return;

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

    const handleOrganize = async () => {
        setIsOrganizing(true);
        try {
            const res = await db.request<any>(`action=admin_organize_physical_files`, {
                method: 'POST',
                body: JSON.stringify({ strategy: organizeStrategy, dryRun: organizeDryRun })
            });
            if (organizeDryRun) {
                alert(`Simulación terminada: Se moverían ${res.preview?.length || 0} archivos.`);
            } else {
                toast.success(`Movidos: ${res.moved}`);
                loadStats();
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    const handleTranscode = async (id: string) => {
        setIsTranscoding(id);
        try {
            await db.request(`action=admin_transcode_video`, {
                method: 'POST',
                body: JSON.stringify({ id, preset: transcodePreset })
            });
            toast.success("Video optimizado.");
            loadStats();
        } catch (e: any) { toast.error("FFmpeg error: " + e.message); }
        finally { setIsTranscoding(null); }
    };

    const totalReclaimable = useMemo(() => {
        const bytes = cleanupPreview
            .filter(v => selectedIds.has(v.id))
            .reduce((acc, v) => acc + ((v as any).size_bytes || 0), 0);
        return (bytes / 1024 / 1024 / 1024).toFixed(2);
    }, [cleanupPreview, selectedIds]);

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
            {/* Header Tabs (Mobile Focused) */}
            <div className="flex bg-slate-900 border-b border-slate-800 sticky top-0 z-20 -mx-2 px-2 md:mx-0 md:rounded-t-xl overflow-hidden">
                <TabBtn id="STORAGE" label="Dashboard" icon={PieChart} />
                <TabBtn id="JANITOR" label="Limpieza" icon={Trash2} />
                <TabBtn id="LIBRARIAN" label="Organizar" icon={Move} />
                <TabBtn id="CONVERTER" label="Convertir" icon={PlayCircle} />
            </div>

            {activeTab === 'STORAGE' && (
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Estado del Disco</h4>
                                <HardDrive size={20} className="text-indigo-500" />
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative w-24 h-24 shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500" strokeWidth="3" strokeDasharray={`${(stats?.disk_free / stats?.disk_total) * 100}, 100`} />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center text-center">
                                        <div className="text-xl font-black text-white leading-none">{Math.round((stats?.disk_free / stats?.disk_total) * 100)}%</div>
                                        <div className="text-[8px] text-slate-500 font-bold uppercase mt-1">Libre</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-3xl font-black text-white">{stats?.disk_free} GB</div>
                                    <div className="text-xs text-slate-500">De un total de {stats?.disk_total} GB</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Base de Datos</h4>
                                <Database size={20} className="text-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-2xl font-black text-white">{stats?.db_videos}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Videos Locales</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-amber-400">{nonWebVideos.length}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Legacy (No-MP4)</div>
                                </div>
                            </div>
                            <div className={`mt-4 px-3 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 ${stats?.ffmpeg_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {stats?.ffmpeg_available ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                                FFMPEG: {stats?.ffmpeg_available ? 'SOPORTE ACTIVADO' : 'SOPORTE DESACTIVADO'}
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
                        <Info size={20} className="text-indigo-400 shrink-0" />
                        <div className="text-xs text-slate-400 italic">Ruta de trabajo: <span className="font-mono text-slate-300 not-italic break-all">{stats?.path}</span></div>
                    </div>
                    <button onClick={loadStats} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
                        <RefreshCw size={18}/> Actualizar Métricas
                    </button>
                </div>
            )}

            {activeTab === 'JANITOR' && (
                <div className="space-y-4 animate-in slide-in-from-right-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 size={20}/></div>
                            <div>
                                <h3 className="font-bold text-white leading-none">The Janitor (Limpiador)</h3>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Mantenimiento de salud de disco</p>
                            </div>
                        </div>

                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estrategia de Búsqueda</label>
                                    <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all">
                                        <option value="ORPHAN_DB">Registros Huérfanos (DB sin Archivo)</option>
                                        <option value="LOW_PERFORMANCE">Baja Popularidad (Pocas Vistas)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tamaño Mínimo (MB)</label>
                                    <input type="number" min="0" value={cleanupParams.minSizeMB} onChange={e => setCleanupParams({...cleanupParams, minSizeMB: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500" placeholder="Ej: 500" />
                                </div>
                            </div>

                            {cleanupType === 'LOW_PERFORMANCE' && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Antigüedad &gt;</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={cleanupParams.days} onChange={e => setCleanupParams({...cleanupParams, days: parseInt(e.target.value)})} className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-sm text-white" />
                                            <span className="text-[10px] text-slate-600 font-bold uppercase">Días</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vistas &le;</label>
                                        <input type="number" value={cleanupParams.views} onChange={e => setCleanupParams({...cleanupParams, views: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-sm text-white" />
                                    </div>
                                </div>
                            )}

                            <button onClick={handleSearchCleanup} disabled={isSearching} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all">
                                {isSearching ? <Loader2 className="animate-spin"/> : <RefreshCw size={20}/>} Escanear Disco
                            </button>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center sticky top-[60px] z-10 backdrop-blur">
                                <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                    {selectedIds.size === cleanupPreview.length ? <CheckSquare size={18} className="text-indigo-400" /> : <Square size={18} />} Marcar Todos
                                </button>
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{selectedIds.size} Seleccionados</div>
                            </div>

                            <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                                {cleanupPreview.map(v => (
                                    <div key={v.id} onClick={() => toggleSelect(v.id)} className={`p-4 flex gap-4 transition-colors cursor-pointer ${selectedIds.has(v.id) ? 'bg-indigo-500/10' : 'hover:bg-slate-800/50'}`}>
                                        <div className={`w-5 h-5 rounded border mt-1 shrink-0 flex items-center justify-center ${selectedIds.has(v.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'}`}>
                                            {selectedIds.has(v.id) && <CheckCircle size={14} className="text-white"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-white truncate leading-tight">{v.title}</div>
                                            <div className="text-[10px] text-slate-500 font-mono truncate mt-1">{v.videoUrl}</div>
                                            <div className="flex gap-3 mt-2">
                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded uppercase">{(v as any).size_bytes ? ((v as any).size_bytes / 1024 / 1024).toFixed(0) + ' MB' : '- MB'}</span>
                                                <span className="text-[9px] font-bold text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded uppercase border border-red-900/30">{cleanupType === 'ORPHAN_DB' ? 'Registro Vacío' : v.views + ' vistas'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-slate-950 border-t border-slate-800">
                                <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 mb-4 flex flex-col items-center">
                                    <span className="text-xs text-red-300 font-bold uppercase tracking-widest">Espacio recuperable</span>
                                    <span className="text-3xl font-black text-red-500">{totalReclaimable} GB</span>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <button disabled={selectedIds.size === 0 || isExecuting} onClick={() => handleExecuteCleanup(true)} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-red-900/20 active:scale-95 transition-all">
                                        {isExecuting ? <Loader2 className="animate-spin" /> : <Trash size={20}/>} Eliminar FÍSICAMENTE ({selectedIds.size})
                                    </button>
                                    <button disabled={selectedIds.size === 0 || isExecuting} onClick={() => handleExecuteCleanup(false)} className="w-full py-3 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest">
                                        Limpiar solo registros DB
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-4 animate-in slide-in-from-right-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center"><Move size={20}/></div>
                            <div>
                                <h3 className="font-bold text-white leading-none">The Librarian (Bibliotecario)</h3>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Ordenamiento físico del servidor</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Estrategia de carpetas</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => setOrganizeStrategy('CATEGORY_FOLDERS')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${organizeStrategy === 'CATEGORY_FOLDERS' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-600'}`}>
                                            <div>
                                                <div className="text-sm font-bold">Por Categoría</div>
                                                <div className="text-[10px] opacity-70">Mueve archivos a: /SERIES/Video.mp4</div>
                                            </div>
                                            {organizeStrategy === 'CATEGORY_FOLDERS' && <CheckCircle size={16}/>}
                                        </button>
                                        <button onClick={() => setOrganizeStrategy('FLATTEN')} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${organizeStrategy === 'FLATTEN' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-600'}`}>
                                            <div>
                                                <div className="text-sm font-bold">Aplanar Estructura</div>
                                                <div className="text-[10px] opacity-70">Mueve todo a la raíz de la librería</div>
                                            </div>
                                            {organizeStrategy === 'FLATTEN' && <CheckCircle size={16}/>}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-800">
                                    <input type="checkbox" id="dryrun" checked={organizeDryRun} onChange={e => setOrganizeDryRun(e.target.checked)} className="w-5 h-5 accent-indigo-500 rounded border-slate-700 bg-slate-950" />
                                    <label htmlFor="dryrun" className="text-xs font-bold text-slate-300 flex items-center gap-2 cursor-pointer">
                                        Modo Simulación (Solo reporte) <InfoTooltip text="Muestra cuántos archivos se verían afectados sin realizar cambios reales en el disco." />
                                    </label>
                                </div>

                                <button onClick={handleOrganize} disabled={isOrganizing} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin"/> : <Wand2 size={20}/>} Ejecutar Organización
                                </button>
                            </div>

                            <div className="bg-amber-900/10 border border-amber-900/20 p-4 rounded-xl flex gap-3">
                                <AlertCircle className="text-amber-500 shrink-0" size={20}/>
                                <p className="text-[11px] text-amber-200/70 leading-relaxed italic">
                                    Recomendado: Asegúrate de que las categorías de tus videos estén bien definidas antes de organizar, de lo contrario irán a la carpeta <strong>GENERAL</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'CONVERTER' && (
                <div className="space-y-4 animate-in slide-in-from-right-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center"><PlayCircle size={20}/></div>
                            <div>
                                <h3 className="font-bold text-white leading-none">Media Converter (FFmpeg)</h3>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Optimización para reproducción Web</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preset de Calidad</label>
                                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                    {['fast', 'medium', 'slow'].map((p: any) => (
                                        <button key={p} onClick={() => setTranscodePreset(p)} className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${transcodePreset === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {nonWebVideos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                    <CheckCircle size={48} className="text-emerald-500 mb-2"/>
                                    <span className="font-bold text-xs">Todos los videos son compatibles</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {nonWebVideos.map(v => (
                                        <div key={v.id} className={`bg-slate-950 p-4 rounded-xl border flex items-center justify-between group transition-all ${isTranscoding === v.id ? 'border-amber-500 ring-1 ring-amber-500/20' : 'border-slate-800'}`}>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="text-xs font-bold text-white truncate">{v.title}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-amber-500 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{v.videoUrl.split('.').pop()}</span>
                                                    <ChevronRight size={10} className="text-slate-700"/>
                                                    <span className="text-[9px] font-black text-emerald-400 uppercase">MP4 (H264)</span>
                                                </div>
                                                {isTranscoding === v.id && (
                                                    <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                                        <div className="h-full bg-amber-500 animate-progress-indeterminate"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => handleTranscode(v.id)}
                                                disabled={!!isTranscoding || !stats?.ffmpeg_available}
                                                className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${isTranscoding === v.id ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white disabled:opacity-20'}`}
                                            >
                                                {isTranscoding === v.id ? <Loader2 className="animate-spin"/> : <RefreshCw size={20}/>}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-flex items-center align-middle cursor-help">
        <Info size={12} className="text-slate-500 hover:text-indigo-400 transition-colors" />
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
            <p className="leading-relaxed">{text}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-700"></div>
        </div>
    </div>
);
