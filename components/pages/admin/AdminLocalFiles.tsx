import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, Move, Settings2, PlayCircle, 
    Filter, ChevronRight, PieChart, Database, Save, Map, FileJson, 
    Check, Eye, ShieldAlert, Zap, Layers, AlertTriangle, FileSearch, Trash, X
} from 'lucide-react';

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

    // Librarian State
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [paqueteMapper, setPaqueteMapper] = useState<Record<string, string>>({});
    const [showMapper, setShowMapper] = useState(false);
    const [simPlan, setSimPlan] = useState<any[]>([]);
    const [deepCleanOptions, setDeepCleanOptions] = useState({ removeSamples: true });

    // Converter State
    const [nonWebVideos, setNonWebVideos] = useState<Video[]>([]);
    const [isQueueRunning, setIsQueueRunning] = useState(false);
    const [queue, setQueue] = useState<any[]>([]);

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
            setNonWebVideos(all.filter(v => {
                const ext = v.videoUrl.split('.').pop()?.toLowerCase();
                return v.isLocal && ext && !['mp4', 'webm'].includes(ext);
            }));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleSearchCleanup = async () => {
        setIsSearching(true);
        try {
            const res = await db.request<Video[]>(`action=admin_file_cleanup_preview&type=${cleanupType}`);
            setCleanupPreview(res);
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const runPaquete = async (simulate: boolean) => {
        setIsOrganizing(true);
        setSimPlan([]);
        try {
            const res = await db.request<any>(`action=admin_organize_paquete`, {
                method: 'POST',
                body: JSON.stringify({ simulate, ...deepCleanOptions })
            });
            if (simulate) {
                setSimPlan(res.plan);
                toast.info(`Simulación completada: ${res.plan.length} operaciones calculadas.`);
            } else {
                toast.success(`Organización terminada. Movidos: ${res.moved}`);
                loadData();
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button onClick={() => setActiveTab(id)} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition-all border-b-2 font-bold text-[10px] uppercase tracking-wider ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <Icon size={18} /> {label}
        </button>
    );

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-4 animate-in fade-in pb-20 max-w-5xl mx-auto">
            <div className="flex bg-slate-900 border-b border-slate-800 sticky top-0 z-20 -mx-2 px-2 md:mx-0 md:rounded-t-xl overflow-hidden shadow-lg backdrop-blur-md">
                <TabBtn id="STORAGE" label="Dashboard" icon={PieChart} />
                <TabBtn id="JANITOR" label="Limpieza" icon={Trash2} />
                <TabBtn id="LIBRARIAN" label="Librarian" icon={Wand2} />
                <TabBtn id="CONVERTER" label="Convertir" icon={PlayCircle} />
            </div>

            {activeTab === 'STORAGE' && (
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-0">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Almacenamiento</h4>
                                <HardDrive size={20} className="text-indigo-500" />
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative w-20 h-20 shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500" strokeWidth="3" strokeDasharray={`${Math.round((stats?.disk_free / stats?.disk_total) * 100)}, 100`} />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center font-black text-white text-xs">{Math.round((stats?.disk_free / stats?.disk_total) * 100)}%</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white">{stats?.disk_free} GB</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Libres de {stats?.disk_total} GB</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Librería</h4>
                            <div className="text-4xl font-black text-emerald-400">{stats?.db_videos}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Videos locales activos</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'JANITOR' && (
                <div className="space-y-4 px-2 md:px-0">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 size={20}/></div>
                            <h3 className="font-bold text-white">The Janitor</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm">
                                <option value="LOW_PERFORMANCE">Bajo Rendimiento (Borrador)</option>
                                <option value="ORPHAN_DB">Registros Huérfanos (Limpiar DB)</option>
                            </select>
                            <button onClick={handleSearchCleanup} disabled={isSearching} className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                                {isSearching ? <Loader2 className="animate-spin" size={18}/> : <FileSearch size={18}/>} Escanear Basura
                            </button>
                        </div>
                    </div>
                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center font-black text-[10px] text-indigo-400 uppercase">
                                <span>{cleanupPreview.length} archivos para eliminar</span>
                                <button className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1"><Trash size={12}/> Vaciar Todo</button>
                            </div>
                            <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
                                {cleanupPreview.map(v => (
                                    <div key={v.id} className="p-4 flex justify-between items-center text-sm">
                                        <span className="text-white truncate pr-4">{v.title}</span>
                                        <span className="text-slate-500 shrink-0 font-mono text-xs">{v.views} views</span>
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
                                <h3 className="font-bold text-white">The Librarian Engine</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowMapper(!showMapper)} className="p-2 bg-slate-800 text-indigo-400 rounded-lg hover:bg-slate-700 transition-colors"><Map size={20}/></button>
                            </div>
                        </div>

                        {showMapper && (
                            <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800 animate-in slide-in-from-top-2">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><Map size={14}/> Mapeador de Carpetas</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {PAQUETE_CATEGORIES.map(cat => (
                                        <div key={cat.id} className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">{cat.id} {cat.label}</label>
                                            <input type="text" placeholder="Ruta personalizada" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2 text-indigo-400"><ShieldAlert size={14}/> Opciones de Limpieza Inteligente</h4>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={deepCleanOptions.removeSamples}
                                            onChange={e => setDeepCleanOptions({...deepCleanOptions, removeSamples: e.target.checked})}
                                            className="w-4 h-4 accent-indigo-500" 
                                        />
                                        <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Eliminar "Samples" (&lt; 20MB)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button onClick={() => runPaquete(true)} disabled={isOrganizing} className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin" size={20}/> : <Eye size={20}/>} Simular Cambios
                                </button>
                                <button onClick={() => runPaquete(false)} disabled={isOrganizing} className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20}/>} Ejecutar Organización Real
                                </button>
                            </div>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="font-black text-[10px] text-amber-500 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Plan de Organización (Auditoría)</h4>
                                {/* Added fix for missing X icon import */}
                                <button onClick={() => setSimPlan([])} className="text-slate-500 hover:text-white"><X size={16}/></button>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-950/50 sticky top-0 text-slate-500 uppercase font-black text-[9px]">
                                        <tr>
                                            <th className="p-4 border-b border-slate-800">Archivo Original</th>
                                            <th className="p-4 border-b border-slate-800">Destino Calculado</th>
                                            <th className="p-4 border-b border-slate-800">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {simPlan.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 text-slate-400 font-mono text-[10px] break-all max-w-[200px]">{p.old || p.file}</td>
                                                <td className="p-4">
                                                    <div className="text-white font-bold">{p.title}</div>
                                                    <div className="text-[10px] text-indigo-400 uppercase font-black">{p.category}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                                                        p.action.includes('SKIP') ? 'bg-amber-900/30 text-amber-400' : 
                                                        p.action.includes('OVERWRITE') ? 'bg-blue-900/30 text-blue-400' : 
                                                        p.action === 'DELETE' ? 'bg-red-900/30 text-red-400' :
                                                        'bg-emerald-900/30 text-emerald-400'
                                                    }`}>
                                                        {p.action}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'CONVERTER' && (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                    <PlayCircle size={64}/>
                    <div className="font-bold text-sm uppercase tracking-widest">Conversor FFmpeg próximamente</div>
                </div>
            )}
        </div>
    );
}
