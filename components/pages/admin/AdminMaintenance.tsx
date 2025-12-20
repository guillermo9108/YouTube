import React, { useState, useMemo } from 'react';
import { db } from '../../../services/db';
import { VideoCategory, SmartCleanerResult } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Wrench, Trash2, Database, Brush, Activity, Server, 
    HardDrive, CheckCircle, Percent, Clock, Eye, ThumbsDown, 
    Settings2, Info, AlertTriangle, Loader2, Play, Check, X, ShieldAlert, Zap
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

    const handleCleanupOrphans = async () => {
        if (!confirm("Esta acción eliminará FÍSICAMENTE los archivos (videos, fotos, avatares) que no estén registrados en la base de datos. ¿Continuar?")) return;
        setCleaning(true);
        try {
            const res = await db.adminCleanupSystemFiles();
            toast.success(`Eliminados: ${res.videos} videos, ${res.thumbnails} miniaturas.`);
        } catch (e: any) { toast.error("Error: " + e.message); }
        finally { setCleaning(false); }
    };

    const handleRepairDb = async () => {
        setCleaning(true);
        try {
            await db.adminRepairDb();
            toast.success("Base de datos reparada y sincronizada.");
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

        // Dividimos en lotes de 10 para mostrar progreso real en el UI
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

                            <div className="bg-indigo-900/10 p-3 rounded-xl border border-indigo-500/20">
                                <label className="text-[10px] font-bold text-indigo-300 uppercase block mb-3">Lógica de combinación:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setConfig({...config, operator: 'AND'})}
                                        className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${config.operator === 'AND' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                    >
                                        Y (Exigente)
                                    </button>
                                    <button 
                                        onClick={() => setConfig({...config, operator: 'OR'})}
                                        className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${config.operator === 'OR' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                    >
                                        O (Relajado)
                                    </button>
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
                </div>

                {/* Panel de Resultados / Auditoría */}
                <div className="lg:col-span-2 space-y-4">
                    {execution ? (
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-8 text-center animate-in zoom-in-95">
                            <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Limpieza en Progreso</h3>
                            <p className="text-slate-400 text-sm mb-6">{execution.current}</p>
                            
                            <div className="max-w-md mx-auto">
                                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2">
                                    <span>Progreso General</span>
                                    <span>{execution.progress}%</span>
                                </div>
                                <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                                        style={{ width: `${execution.progress}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-4 uppercase font-bold tracking-widest">
                                    No cierres esta pestaña hasta finalizar
                                </p>
                            </div>
                        </div>
                    ) : cleanerPreview ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[700px] animate-in slide-in-from-right-4">
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

                            <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-900/50">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950/80 sticky top-0 z-10">
                                        <tr className="text-[9px] uppercase font-black text-slate-500">
                                            <th className="p-4 border-b border-slate-800">Video / Categoría</th>
                                            <th className="p-4 border-b border-slate-800">Métricas (V / D)</th>
                                            <th className="p-4 border-b border-slate-800">Razón de Purga</th>
                                            <th className="p-4 border-b border-slate-800 text-right">Peso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cleanerPreview.preview.map((v: any) => (
                                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="text-xs font-bold text-white truncate max-w-[180px]">{v.title}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono">{v.category}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Eye size={10}/> {v.views}</span>
                                                        <span className="text-[10px] text-red-400 flex items-center gap-1"><ThumbsDown size={10}/> {v.dislikes}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-slate-950 border border-slate-800 text-[9px] font-black text-amber-500 px-2 py-1 rounded uppercase tracking-tighter">
                                                        {v.reason}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-mono text-xs text-slate-400">{v.size_fmt}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 border-dashed text-center">
                                <Brush size={48} className="text-slate-700 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-300">Smart Cleaner Inactivo</h3>
                                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
                                    Configura los filtros a la izquierda y pulsa "Simular Purga" para ver qué videos recomienda el Janitor eliminar del servidor.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button onClick={handleCleanupOrphans} disabled={cleaning} className="w-full p-5 bg-slate-900 border border-slate-800 hover:border-red-500/30 rounded-2xl text-left group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Trash2 size={24}/></div>
                                        <div>
                                            <span className="font-black text-slate-200 block text-xs uppercase tracking-widest">Borrar Huérfanos</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Limpiar archivos sin DB</span>
                                        </div>
                                    </div>
                                </button>

                                <button onClick={handleRepairDb} disabled={cleaning} className="w-full p-5 bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-2xl text-left group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Database size={24}/></div>
                                        <div>
                                            <span className="font-black text-slate-200 block text-xs uppercase tracking-widest">Reparar MariaDB</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Sincronizar Esquema</span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}