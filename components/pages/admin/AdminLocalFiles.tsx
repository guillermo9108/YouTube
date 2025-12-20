import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, Move, PlayCircle, 
    PieChart, Database, Eye, ShieldAlert, Zap, AlertTriangle, X, Info, Trash, FolderTree, CheckCircle, Shield
} from 'lucide-react';

export default function AdminLocalFiles() {
    const toast = useToast();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'STORAGE' | 'JANITOR' | 'LIBRARIAN'>('STORAGE');
    
    // Janitor State
    const [cleanupType, setCleanupType] = useState<'ORPHAN_DB' | 'LOW_PERFORMANCE'>('LOW_PERFORMANCE');
    const [cleanupPreview, setCleanupPreview] = useState<Video[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Librarian State
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [simPlan, setSimPlan] = useState<any[]>([]);
    const [libOptions, setLibOptions] = useState({ 
        removeSamples: true, 
        keepBestQuality: true, 
        cleanOrphanMeta: true,
        pruneEmptyFolders: true 
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const statRes = await db.request<any>('action=admin_get_local_stats');
            setStats(statRes);
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

    const runLibrarian = async (simulate: boolean) => {
        setIsOrganizing(true);
        if (simulate) setSimPlan([]);
        try {
            const res = await db.request<any>(`action=admin_organize_paquete`, {
                method: 'POST',
                body: JSON.stringify({ simulate, options: libOptions })
            });
            if (simulate) {
                setSimPlan(res.plan);
                toast.info(`Auditoría completa: ${res.plan.length} cambios proyectados.`);
            } else {
                toast.success(`Consolidación terminada. Movidos: ${res.moved}. Limpiados: ${res.cleaned}`);
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
                <TabBtn id="STORAGE" label="Capacidad" icon={PieChart} />
                <TabBtn id="JANITOR" label="Limpieza" icon={Trash2} />
                <TabBtn id="LIBRARIAN" label="Librarian V5" icon={FolderTree} />
            </div>

            {activeTab === 'STORAGE' && (
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-0">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Almacenamiento Local</h4>
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
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Database size={18} className="text-emerald-500"/> Videos en Biblioteca</h4>
                            <div className="text-4xl font-black text-white">{stats?.db_videos}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Registrados como locales</div>
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
                                <option value="LOW_PERFORMANCE">Bajo Rendimiento (Limpiar Antiguos)</option>
                                <option value="ORPHAN_DB">Registros Huérfanos (Limpiar DB)</option>
                            </select>
                            <button onClick={handleSearchCleanup} disabled={isSearching} className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                                {isSearching ? <Loader2 className="animate-spin" size={18}/> : <Trash size={18}/>} Escanear Basura
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
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center"><Move size={20}/></div>
                            <div>
                                <h3 className="font-bold text-white">The Librarian Engine V5</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mantenimiento y Organización Profunda</p>
                            </div>
                        </div>

                        <div className="bg-indigo-900/10 border border-indigo-500/30 rounded-xl p-4 mb-6 flex gap-4 items-start">
                            <Info size={24} className="text-indigo-400 shrink-0 mt-1"/>
                            <div className="text-xs text-slate-300 leading-relaxed">
                                <strong className="text-indigo-300 block mb-1">Algoritmo de Limpieza Multinivel:</strong>
                                Ahora no solo organiza; el motor analiza la <strong>mejor calidad disponible</strong> para eliminar duplicados pesados, limpia metadatos de archivos borrados y poda directorios vacíos para mantener un árbol de archivos impecable.
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={libOptions.keepBestQuality}
                                        onChange={e => setLibOptions({...libOptions, keepBestQuality: e.target.checked})}
                                        className="w-5 h-5 rounded bg-slate-900 border-slate-700 accent-indigo-500" 
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">Priorizar Mejor Calidad</span>
                                        <span className="text-[9px] text-slate-500 uppercase">Borra duplicados de menor resolución (Ej: Borra 720p si existe 1080p)</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={libOptions.cleanOrphanMeta}
                                        onChange={e => setLibOptions({...libOptions, cleanOrphanMeta: e.target.checked})}
                                        className="w-5 h-5 rounded bg-slate-900 border-slate-700 accent-indigo-500" 
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">Metadatos Huérfanos</span>
                                        <span className="text-[9px] text-slate-500 uppercase">Elimina .nfo, .jpg y .srt sin video asociado</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={libOptions.removeSamples}
                                        onChange={e => setLibOptions({...libOptions, removeSamples: e.target.checked})}
                                        className="w-5 h-5 rounded bg-slate-900 border-slate-700 accent-indigo-500" 
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">Samples de Paquete</span>
                                        <span className="text-[9px] text-slate-500 uppercase">Ignorar/Eliminar archivos menores a 25MB</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={libOptions.pruneEmptyFolders}
                                        onChange={e => setLibOptions({...libOptions, pruneEmptyFolders: e.target.checked})}
                                        className="w-5 h-5 rounded bg-slate-900 border-slate-700 accent-indigo-500" 
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">Auto-Pruning</span>
                                        <span className="text-[9px] text-slate-500 uppercase">Eliminar carpetas vacías tras movimiento</span>
                                    </div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button onClick={() => runLibrarian(true)} disabled={isOrganizing} className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin" size={20}/> : <Eye size={20}/>} Auditar Cambios
                                </button>
                                <button onClick={() => runLibrarian(false)} disabled={isOrganizing} className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20}/>} Ejecutar Limpieza Real
                                </button>
                            </div>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="font-black text-[10px] text-amber-500 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Auditoría de Cambios Jerárquicos</h4>
                                <button onClick={() => setSimPlan([])} className="text-slate-500 hover:text-white"><X size={16}/></button>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-950/50 sticky top-0 text-slate-500 uppercase font-black text-[9px]">
                                        <tr>
                                            <th className="p-4 border-b border-slate-800">Fragmento Original</th>
                                            <th className="p-4 border-b border-slate-800">Nombre Raíz Detectado</th>
                                            <th className="p-4 border-b border-slate-800">Destino Jerárquico</th>
                                            <th className="p-4 border-b border-slate-800">Acción Sugerida</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {simPlan.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="text-slate-500 font-mono text-[10px] truncate max-w-[150px]">{p.old ? p.old.replace(/.*[\\\/]/, '') : p.file}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-indigo-900/30 text-indigo-400 px-2 py-1 rounded font-bold text-[10px] uppercase border border-indigo-500/20">{p.root || '-'}</span>
                                                </td>
                                                <td className="p-4">
                                                    {p.action === 'DELETE' ? (
                                                        <span className="text-red-400 font-bold flex items-center gap-1"><Trash2 size={12}/> ELIMINACIÓN</span>
                                                    ) : (
                                                        <>
                                                            <div className="text-indigo-400 font-black text-[10px] uppercase mb-1">{p.category}</div>
                                                            <div className="text-white font-bold text-[11px] leading-tight break-all max-w-[200px]">{p.new ? p.new.replace(/.*[\\\/]/, '') : '-'}</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase text-center ${
                                                            p.action.includes('SKIP') ? 'bg-amber-900/30 text-amber-400' : 
                                                            p.action.includes('OVERWRITE') ? 'bg-blue-900/30 text-blue-400' : 
                                                            p.action === 'DELETE' ? 'bg-red-900/30 text-red-400' :
                                                            'bg-emerald-900/30 text-emerald-400'
                                                        }`}>
                                                            {p.action}
                                                        </span>
                                                        {p.reason && <span className="text-[8px] text-slate-500 uppercase text-center font-bold">{p.reason}</span>}
                                                    </div>
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
        </div>
    );
}