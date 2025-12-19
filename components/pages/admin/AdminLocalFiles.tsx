
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { HardDrive, Trash2, Wand2, RefreshCw, Loader2, FileVideo, AlertCircle, CheckCircle, Info, Move, Settings2, PlayCircle } from 'lucide-react';

export default function AdminLocalFiles() {
    const toast = useToast();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Cleanup State
    const [cleanupType, setCleanupType] = useState<'ORPHAN_DB' | 'LOW_PERFORMANCE'>('ORPHAN_DB');
    const [cleanupPreview, setCleanupPreview] = useState<Video[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [cleanupParams, setCleanupParams] = useState({ days: 30, views: 5 });

    // Organizer State
    const [isOrganizing, setIsOrganizing] = useState(false);

    // Transcoder State
    const [nonWebVideos, setNonWebVideos] = useState<Video[]>([]);
    const [isTranscoding, setIsTranscoding] = useState<string | null>(null);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await db.request<any>('action=admin_get_local_stats');
            setStats(res);
            
            // Auto-load non-web videos
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

    const handleSearchCleanup = async () => {
        setIsSearching(true);
        try {
            const res = await db.request<Video[]>(`action=admin_file_cleanup_preview&type=${cleanupType}&days=${cleanupParams.days}&views=${cleanupParams.views}`);
            setCleanupPreview(res);
            if (res.length === 0) toast.info("No se encontraron archivos para limpiar.");
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const handleExecuteCleanup = async (deletePhysical: boolean) => {
        if (cleanupPreview.length === 0) return;
        const msg = deletePhysical 
            ? `¿Confirmas eliminar ${cleanupPreview.length} archivos FÍSICAMENTE del disco y de la base de datos?`
            : `¿Confirmas eliminar solo los registros de la base de datos para ${cleanupPreview.length} videos?`;
        
        if (!confirm(msg)) return;

        setIsExecuting(true);
        try {
            const ids = cleanupPreview.map(v => v.id);
            await db.request(`action=admin_file_cleanup_execute`, {
                method: 'POST',
                body: JSON.stringify({ ids, deletePhysical })
            });
            toast.success("Limpieza completada.");
            setCleanupPreview([]);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsExecuting(false); }
    };

    const handleOrganize = async () => {
        if (!confirm("Esto moverá físicamente los archivos en tu disco duro para organizarlos por categorías. ¿Deseas continuar?")) return;
        setIsOrganizing(true);
        try {
            const res = await db.request<any>(`action=admin_organize_physical_files`);
            toast.success(`Organización terminada. Movidos: ${res.moved}`);
            if (res.errors?.length > 0) toast.warning(`${res.errors.length} archivos no pudieron moverse.`);
            loadStats();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    const handleTranscode = async (id: string) => {
        setIsTranscoding(id);
        toast.info("Iniciando conversión... Esto puede tardar varios minutos.");
        try {
            await db.request(`action=admin_transcode_video`, {
                method: 'POST',
                body: JSON.stringify({ id })
            });
            toast.success("Video optimizado correctamente.");
            loadStats();
        } catch (e: any) { toast.error("Error FFmpeg: " + e.message); }
        finally { setIsTranscoding(null); }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Storage Overview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><HardDrive size={120}/></div>
                <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><HardDrive className="text-indigo-400"/> Estado del Almacenamiento Local</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Espacio Libre</span>
                            <div className="text-2xl font-black text-emerald-400">{stats?.disk_free} GB</div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{width: `${(stats?.disk_free / stats?.disk_total) * 100}%`}}></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Videos en DB</span>
                            <div className="text-2xl font-black text-white">{stats?.db_videos}</div>
                            <p className="text-[10px] text-slate-500">Archivos locales registrados</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Formatos no Web</span>
                            <div className="text-2xl font-black text-amber-400">{nonWebVideos.length}</div>
                            <p className="text-[10px] text-slate-500">Requieren conversión</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500">FFmpeg</span>
                            <div className={`text-sm font-bold flex items-center gap-1 mt-2 ${stats?.ffmpeg_available ? 'text-emerald-400' : 'text-red-400'}`}>
                                {stats?.ffmpeg_available ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                                {stats?.ffmpeg_available ? 'INSTALADO' : 'NO DISPONIBLE'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs font-mono text-slate-500">
                        <Settings2 size={14}/> Ruta: {stats?.path}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PHYSICAL ORGANIZER */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-white text-lg flex items-center gap-2"><Move className="text-blue-400"/> Organizador Físico</h3>
                            <p className="text-xs text-slate-500 mt-1">Mueve archivos automáticamente a carpetas por categoría.</p>
                        </div>
                        <button 
                            onClick={handleOrganize}
                            disabled={isOrganizing}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isOrganizing ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                            Organizar Disco
                        </button>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                        <div className="flex items-center gap-2 text-blue-300 font-bold"><Info size={14}/> Estructura Destino:</div>
                        <code className="block bg-black/50 p-2 rounded text-indigo-300">
                            {stats?.path}/SERIES/La Casa de Papel.mp4<br/>
                            {stats?.path}/MOVIES/Inception.mkv
                        </code>
                        <p>Útil para mantener el NAS limpio y facilitar backups externos.</p>
                    </div>
                </div>

                {/* TRANSCODER LIST */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-lg">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-4"><PlayCircle className="text-amber-400"/> Optimización Web (FFmpeg)</h3>
                    {nonWebVideos.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm italic opacity-50 py-10">
                            <CheckCircle size={32} className="mb-2 text-emerald-500"/>
                            Todos los videos están en formato óptimo.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {nonWebVideos.map(v => (
                                <div key={v.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between group">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-white truncate">{v.title}</div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                            <span className="uppercase text-amber-500 font-bold">{v.videoUrl.split('.').pop()}</span>
                                            <span>&rarr; MP4</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleTranscode(v.id)}
                                        disabled={!!isTranscoding || !stats?.ffmpeg_available}
                                        className={`p-2 rounded-lg transition-colors ${isTranscoding === v.id ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white disabled:opacity-30'}`}
                                    >
                                        {isTranscoding === v.id ? <RefreshCw className="animate-spin" size={16}/> : <Settings2 size={16}/>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* SMART CLEANUP SECTION */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-white text-lg flex items-center gap-2"><Trash2 className="text-red-400"/> Limpieza Inteligente de Disco</h3>
                        <p className="text-xs text-slate-500">Busca y elimina contenido innecesario.</p>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={cleanupType} 
                            onChange={e => setCleanupType(e.target.value as any)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        >
                            <option value="ORPHAN_DB">Registros huérfanos (DB sin Archivo)</option>
                            <option value="LOW_PERFORMANCE">Baja Popularidad (Sin vistas)</option>
                        </select>
                        <button 
                            onClick={handleSearchCleanup}
                            disabled={isSearching}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                        >
                            {isSearching ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                            Escanear
                        </button>
                    </div>
                </div>

                {cleanupType === 'LOW_PERFORMANCE' && (
                    <div className="p-4 bg-slate-950/30 border-b border-slate-800 flex gap-6 items-center">
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Antigüedad &gt;</span>
                             <input type="number" value={cleanupParams.days} onChange={e => setCleanupParams({...cleanupParams, days: parseInt(e.target.value)})} className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                             <span className="text-[10px] text-slate-600">días</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Vistas &le;</span>
                             <input type="number" value={cleanupParams.views} onChange={e => setCleanupParams({...cleanupParams, views: parseInt(e.target.value)})} className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                         </div>
                    </div>
                )}

                <div className="p-0 min-h-[300px]">
                    {cleanupPreview.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-50">
                            <Trash2 size={48} className="mb-4" />
                            <p className="text-sm">Inicia un escaneo para ver candidatos a eliminar.</p>
                        </div>
                    ) : (
                        <>
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase font-bold border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-3 text-red-400">Estado</th>
                                            <th className="px-6 py-3">Título / Ruta</th>
                                            <th className="px-6 py-3 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cleanupPreview.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 rounded bg-red-900/20 text-red-400 font-bold border border-red-900/30">
                                                        {cleanupType === 'ORPHAN_DB' ? 'Archivo Perdido' : 'Impopular'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white">{v.title}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-md">{v.videoUrl}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => setCleanupPreview(prev => prev.filter(x => x.id !== v.id))} className="text-slate-500 hover:text-white">Saltar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                                <div className="text-sm text-slate-400">Total Candidatos: <strong className="text-white">{cleanupPreview.length}</strong></div>
                                <div className="flex gap-3">
                                    <button 
                                        disabled={isExecuting}
                                        onClick={() => handleExecuteCleanup(false)}
                                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                                    >
                                        Limpiar Solo Base Datos
                                    </button>
                                    <button 
                                        disabled={isExecuting}
                                        onClick={() => handleExecuteCleanup(true)}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        {isExecuting ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>}
                                        Eliminar Físicamente Todo
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
