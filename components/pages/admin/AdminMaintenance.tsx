import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../../services/db';
import { VideoCategory, SmartCleanerResult } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Wrench, Trash2, Database, Brush, Activity, Server, 
    HardDrive, CheckCircle, Percent, Clock, Eye, ThumbsDown, 
    Settings2, Info, AlertTriangle, Loader2, Play, Check, X, ShieldAlert, Zap, FileText, RefreshCw
} from 'lucide-react';

const SystemHealthCard = ({ icon: Icon, label, status, color }: any) => (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center gap-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color} bg-opacity-20`}>
            <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        <div>
            <div className="text-xs text-slate-500 uppercase font-bold">{label}</div>
            <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                {status} <CheckCircle size={12} className="text-emerald-500"/>
            </div>
        </div>
    </div>
);

export default function AdminMaintenance() {
    const toast = useToast();
    const [cleaning, setCleaning] = useState(false);
    const [cleanerPreview, setCleanerPreview] = useState<SmartCleanerResult | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const logIntervalRef = useRef<number | null>(null);
    
    // Configuración Janitor V6
    const [config, setConfig] = useState({
        category: 'ALL',
        minDays: 30,
        maxViews: 10,
        minDislikes: 5,
        operator: 'OR' // OR = cumple cualquiera, AND = debe cumplir todos
    });

    // Estado de progreso real
    const [execution, setExecution] = useState<{ progress: number, current: string, total: number } | null>(null);

    const fetchLogs = async (silent = false) => {
        if (!silent) setLoadingLogs(true);
        try {
            const data = await db.request<string[]>('action=admin_get_logs');
            setLogs(data || []);
        } catch (e) {} finally {
            if (!silent) setLoadingLogs(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        logIntervalRef.current = window.setInterval(() => fetchLogs(true), 10000);
        return () => { if (logIntervalRef.current) clearInterval(logIntervalRef.current); };
    }, []);

    const handleClearLogs = async () => {
        if (!confirm("¿Deseas vaciar el archivo de logs?")) return;
        try {
            await db.request('action=admin_clear_logs');
            setLogs([]);
            toast.success("Logs vaciados");
        } catch (e: any) { toast.error(e.message); }
    };

    const handleCleanupOrphans = async () => {
        if (!confirm("Esta acción eliminará FÍSICAMENTE los archivos (videos, fotos, avatares) que no estén registrados en la base de datos. ¿Continuar?")) return;
        setCleaning(true);
        try {
            const res = await db.adminCleanupSystemFiles();
            toast.success(`Eliminados: ${res.videos} videos, ${res.thumbnails} miniaturas.`);
            fetchLogs();
        } catch (e: any) { toast.error("Error: " + e.message); }
        finally { setCleaning(false); }
    };

    const handleRepairDb = async () => {
        setCleaning(true);
        try {
            await db.adminRepairDb();
            toast.success("Base de datos reparada y sincronizada.");
            fetchLogs();
        } catch (e: any) { toast.error("Error: " + e.message); }
        finally { setCleaning(false); }
    };

    const handlePreviewCleaner = async () => {
        setCleaning(true);
        try {
            const res = await db.request<SmartCleanerResult>(`action=admin_smart_cleaner_preview`, {
                method: 'POST',
                body: JSON.stringify(config)
            });
            setCleanerPreview(res);
            toast.info(`Simulación completada: ${res.preview.length} candidatos.`);
        } catch (e: any) { toast.error("Error: " + e.message); }
        finally { setCleaning(false); }
    };

    const handleExecuteCleaner = async () => {
        if (!cleanerPreview || cleanerPreview.preview.length === 0) return;
        if (!confirm(`PELIGRO: Vas a eliminar permanentemente ${cleanerPreview.preview.length} videos de forma IRREVERSIBLE. ¿Continuar?`)) return;
        
        setCleaning(true);
        const ids = cleanerPreview.preview.map(v => v.id);
        const total = ids.length;
        setExecution({ progress: 0, current: 'Iniciando limpieza...', total });

        const chunkSize = 10;
        let deletedTotal = 0;

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            try {
                const res = await db.request<{deleted: number}>(`action=admin_smart_cleaner_execute`, {
                    method: 'POST',
                    body: JSON.stringify({ videoIds: chunk })
                });
                deletedTotal += res.deleted;
                const progress = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
                setExecution({ progress, current: `Borrando: ${chunk.length} archivos...`, total });
            } catch (e) {
                console.error("Error en lote de limpieza", e);
            }
        }

        toast.success(`Purga completada. Eliminados: ${deletedTotal} videos.`);
        setExecution(null);
        setCleanerPreview(null);
        setCleaning(false);
        fetchLogs();
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* System Health Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SystemHealthCard icon={Activity} label="Estado API" status="Online" color="bg-emerald-500" />
                <SystemHealthCard icon={Database} label="Base de Datos" status="Conectado" color="bg-blue-500" />
                <SystemHealthCard icon={HardDrive} label="Almacenamiento" status="Escritura OK" color="bg-purple-500" />
                <SystemHealthCard icon={Server} label="Cola Tareas" status="Activa" color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel de Configuración Smart Cleaner */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><Brush size={20}/></div>
                            <h3 className="font-bold text-white">Janitor Engine V6</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-2 flex items-center gap-1"><Database size={10}/> Alcance (Categoría)</label>
                                <select 
                                    value={config.category} 
                                    onChange={e => setConfig({...config, category: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl p-3 outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Todo el servidor</option>
                                    {(Object.values(VideoCategory) as string[]).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                                </select>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Clock size={10}/> Antigüedad</label>
                                        <span className="text-[10px] font-bold text-indigo-400">{config.minDays} días</span>
                                    </div>
                                    <input type="range" min="1" max="365" value={config.minDays} onChange={e => setConfig({...config, minDays: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Eye size={10}/> Umbral Vistas (Max)</label>
                                        <span className="text-[10px] font-bold text-emerald-400">{config.maxViews} vistas</span>
                                    </div>
                                    <input type="range" min="0" max="1000" step="5" value={config.maxViews} onChange={e => setConfig({...config, maxViews: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><ThumbsDown size={10}/> Umbral Dislikes (Min)</label>
                                        <span className="text-[10px] font-bold text-red-400">{config.minDislikes} dislikes</span>
                                    </div>
                                    <input type="range" min="1" max="100" value={config.minDislikes} onChange={e => setConfig({...config, minDislikes: parseInt(e.target.value)})} className="w-full accent-red-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>
                            </div>

                            <button 
                                onClick={handlePreviewCleaner} 
                                disabled={cleaning}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/10 transition-all flex items-center justify-center gap-2"
                            >
                                {cleaning ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20}/>}
                                Simular Purga
                            </button>
                        </div>
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="grid grid-cols-1 gap-3">
                        <button onClick={handleCleanupOrphans} disabled={cleaning} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl transition-all group">
                             <Trash2 size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
                             <div className="text-left">
                                 <span className="block text-xs font-bold text-white uppercase tracking-wider">Borrar Huérfanos</span>
                                 <span className="block text-[9px] text-slate-500 uppercase">Ficheros sin DB</span>
                             </div>
                        </button>
                        <button onClick={handleRepairDb} disabled={cleaning} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all group">
                             <Database size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                             <div className="text-left">
                                 <span className="block text-xs font-bold text-white uppercase tracking-wider">Sincronizar MariaDB</span>
                                 <span className="block text-[9px] text-slate-500 uppercase">Reparar Tablas</span>
                             </div>
                        </button>
                    </div>
                </div>

                {/* Panel de Resultados / Auditoría / Logs */}
                <div className="lg:col-span-2 space-y-6">
                    {execution ? (
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-8 text-center animate-in zoom-in-95">
                            <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Limpieza en Progreso</h3>
                            <p className="text-slate-400 text-sm mb-6">{execution.current}</p>
                            <div className="max-w-md mx-auto">
                                <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
                                    <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500" style={{ width: `${execution.progress}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-4 uppercase font-bold tracking-widest">No cierres esta pestaña</p>
                            </div>
                        </div>
                    ) : cleanerPreview ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px] animate-in slide-in-from-right-4">
                            <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><CheckCircle size={16} className="text-amber-500"/> Plan de Ejecución</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Se recuperarán <span className="text-emerald-400">{cleanerPreview.stats.spaceReclaimed}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCleanerPreview(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={20}/></button>
                                    <button onClick={handleExecuteCleaner} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-red-900/20 flex items-center gap-2 transition-transform active:scale-95">
                                        <Trash2 size={16}/> Ejecutar Purga
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-slate-900/50">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950/80 sticky top-0 z-10">
                                        <tr className="text-[9px] uppercase font-black text-slate-500">
                                            <th className="p-4">Video</th>
                                            <th className="p-4">Vistas</th>
                                            <th className="p-4">Razón</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cleanerPreview.preview.map((v: any) => (
                                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 text-xs font-bold text-white truncate max-w-[150px]">{v.title}</td>
                                                <td className="p-4 text-[10px] text-slate-400">{v.views}</td>
                                                <td className="p-4"><span className="text-[9px] font-black text-amber-500 uppercase">{v.reason}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-400" />
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Incidentes del Sistema</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchLogs()} className={`p-2 hover:bg-slate-800 rounded-full text-slate-500 ${loadingLogs ? 'animate-spin' : ''}`} title="Refrescar"><RefreshCw size={16}/></button>
                                    <button onClick={handleClearLogs} className="p-2 hover:bg-red-900/30 rounded-full text-slate-500 hover:text-red-400" title="Vaciar Logs"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="flex-1 bg-black/40 overflow-y-auto p-4 font-mono text-[10px] space-y-1.5 custom-scrollbar">
                                {logs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50 italic">
                                        <CheckCircle size={32} className="mb-2" />
                                        No hay incidentes registrados.
                                    </div>
                                ) : (
                                    logs.map((log, i) => {
                                        const isError = log.includes('ERROR') || log.includes('INCIDENTE');
                                        const isAction = log.includes('RESPOND ACTION');
                                        return (
                                            <div key={i} className={`p-2 rounded border border-transparent ${isError ? 'bg-red-900/10 border-red-500/10 text-red-400' : (isAction ? 'text-slate-500' : 'text-slate-400')}`}>
                                                <span className="opacity-30 mr-2">[{i+1}]</span>
                                                {log}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="p-2 bg-slate-950/80 border-t border-slate-800 text-[9px] text-slate-600 text-center uppercase font-bold tracking-widest">
                                Mostrando últimos 100 eventos críticos
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}