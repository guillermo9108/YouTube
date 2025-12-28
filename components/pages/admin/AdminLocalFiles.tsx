import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, PlayCircle, 
    PieChart, Database, Eye, ShieldAlert, Zap, AlertTriangle, X, Info, 
    FolderTree, CheckCircle, TrendingDown, Activity, Filter, Search,
    ArrowUpRight, BarChart3, Layers, FileVideo, Shield, RefreshCw
} from 'lucide-react';

export default function AdminLocalFiles() {
    const toast = useToast();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'HEALTH' | 'EXPLORER' | 'LIBRARIAN'>('HEALTH');
    
    // Explorer State
    const [cleanupType, setCleanupType] = useState<'ORPHAN_DB' | 'LOW_ROI' | 'LOW_PERFORMANCE'>('LOW_ROI');
    const [cleanupPreview, setCleanupPreview] = useState<Video[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Librarian State
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [simPlan, setSimPlan] = useState<any[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const statRes = await db.request<any>('action=admin_get_local_stats');
            setStats(statRes);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleSearchCleanup = async (typeOverride?: any) => {
        setIsSearching(true);
        const type = typeOverride || cleanupType;
        try {
            const res = await db.request<Video[]>(`action=admin_file_cleanup_preview&type=${type}`);
            setCleanupPreview(res || []);
            if (res.length === 0) toast.info("No se encontraron archivos críticos.");
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const handleBulkAction = async (action: 'DELETE' | 'ADOPT') => {
        if (cleanupPreview.length === 0) return;
        if (!confirm(`¿Confirmas la purga permanente de ${cleanupPreview.length} archivos? Esta acción liberará espacio físico inmediatamente.`)) return;

        setIsSearching(true);
        try {
            const ids = cleanupPreview.map(v => v.id);
            await db.request(`action=admin_smart_cleaner_execute`, {
                method: 'POST',
                body: JSON.stringify({ videoIds: ids, subAction: action })
            });
            toast.success("Purga masiva completada.");
            setCleanupPreview([]);
            loadData();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const runLibrarian = async (simulate: boolean) => {
        setIsOrganizing(true);
        if (simulate) setSimPlan([]);
        try {
            const res = await db.request<any>(`action=admin_organize_paquete`, {
                method: 'POST',
                body: JSON.stringify({ simulate })
            });
            if (simulate) {
                setSimPlan(res?.plan || []);
                toast.info(`${(res?.plan || []).length} archivos basura detectados.`);
            } else {
                toast.success(`Purga terminada. Archivos eliminados: ${res.cleaned}`);
                loadData();
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setIsOrganizing(false); }
    };

    const filteredCleanup = useMemo(() => {
        return cleanupPreview.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [cleanupPreview, searchTerm]);

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button onClick={() => { setActiveTab(id); setCleanupPreview([]); }} className={`flex-1 py-4 px-2 flex flex-col items-center gap-1 transition-all border-b-2 font-black text-[10px] uppercase tracking-widest ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <Icon size={18} /> {label}
        </button>
    );

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 max-w-6xl mx-auto px-2">
            
            <div className="flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                <TabBtn id="HEALTH" label="Estado & Capacidad" icon={Activity} />
                <TabBtn id="EXPLORER" label="Rentabilidad GB" icon={TrendingDown} />
                <TabBtn id="LIBRARIAN" label="Janitor Pro" icon={Zap} />
            </div>

            {activeTab === 'HEALTH' && (
                <div className="space-y-6 animate-in zoom-in-95">
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Almacenamiento Total</h4>
                                <HardDrive size={20} className="text-indigo-500" />
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative w-24 h-24 shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="4" />
                                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500 transition-all duration-1000" strokeWidth="4" strokeDasharray={`${Math.round((stats?.disk_free / (stats?.disk_total || 1)) * 100)}, 100`} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="font-black text-white text-lg leading-none">{Math.round((stats?.disk_free / (stats?.disk_total || 1)) * 100)}%</span>
                                        <span className="text-[8px] text-slate-500 font-bold uppercase">Libre</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white tracking-tighter">{stats?.disk_free || 0} GB</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Libres de {stats?.disk_total} GB</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center text-center">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4"><Database size={24}/></div>
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Índice MariaDB</h4>
                            <div className="text-4xl font-black text-white">{stats?.db_videos || 0}</div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">Archivos en catálogo activo</p>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3"><Info size={16} className="text-slate-700"/></div>
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Uso de Carpeta Uploads</h4>
                            <div className="space-y-3">
                                {Object.entries(stats?.folder_usage || {}).map(([dir, size]: any) => (
                                    <div key={dir}>
                                        <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                                            <span className="text-slate-400">{dir}</span>
                                            <span className="text-white">{size} MB</span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (size / (stats?.disk_total * 10.24)))}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Efficiency Heatmap */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart3 size={18} className="text-indigo-400"/>
                            <h4 className="text-xs font-black text-white uppercase tracking-widest">Rentabilidad por Categoría</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {stats?.category_stats?.map((cat: any) => (
                                <div key={cat.category} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center">
                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-2 truncate w-full">{cat.category.replace('_', ' ')}</div>
                                    <div className="text-xl font-black text-white mb-1">{cat.count}</div>
                                    <div className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                                        <Eye size={10}/> {cat.totalViews}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'EXPLORER' && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0"><TrendingDown size={24}/></div>
                                <div>
                                    <h3 className="font-black text-white uppercase tracking-tighter text-lg">Analizador de Rentabilidad</h3>
                                    <p className="text-xs text-slate-500">Detecta archivos pesados que no generan visualizaciones.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500">
                                    <option value="LOW_ROI">Archivos Ineficientes (Vistas/GB)</option>
                                    <option value="LOW_PERFORMANCE">Abandono Crítico (0 vistas +60 días)</option>
                                    <option value="ORPHAN_DB">Vínculos Rotos (Error 404)</option>
                                </select>
                                <button onClick={() => handleSearchCleanup()} disabled={isSearching} className="flex-1 md:flex-none px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                                    {/* Fix: Added RefreshCw import from lucide-react to resolve the missing name error */}
                                    {isSearching ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} Analizar
                                </button>
                            </div>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="relative w-full md:w-64">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-500"/>
                                    <input type="text" placeholder="Filtrar por nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500" />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={() => setCleanupPreview([])} className="px-4 py-2 text-slate-500 hover:text-white font-bold text-[10px] uppercase">Cerrar</button>
                                    <button onClick={() => handleBulkAction('DELETE')} className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"><Trash2 size={14}/> Purgar Seleccionados</button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950/80 sticky top-0 z-10 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        <tr>
                                            <th className="p-4">Video / Formato</th>
                                            <th className="p-4 text-center">Vistas</th>
                                            <th className="p-4">Análisis de Desperdicio</th>
                                            <th className="p-4 text-right">Peso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredCleanup.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-4">
                                                    <div className="text-xs font-bold text-white truncate max-w-[200px]">{v.title}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{v.category} • ID: {v.id.substring(0,8)}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-300 font-bold">
                                                        <Eye size={10} className="text-indigo-400"/> {v.views}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter ${v.reason?.includes('Broken') ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                        {v.reason || 'Baja Rentabilidad'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-mono text-xs text-slate-400 font-bold">{v.size_fmt || 'N/A'}</span>
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

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-4 animate-in slide-in-from-left-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none rotate-12"><Zap size={200}/></div>
                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner animate-pulse"><Zap size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Janitor Purge Engine V8</h3>
                                <p className="text-xs text-slate-400">Motor de limpieza profunda para eliminar basura oculta del NAS.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center gap-4 text-center">
                                <Layers size={32} className="text-indigo-400" />
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase mb-1">Auditoría Basura</h4>
                                    <p className="text-[10px] text-slate-500 font-medium">Detecta samples, trailers y archivos temporales vacíos.</p>
                                </div>
                                <button onClick={() => runLibrarian(true)} disabled={isOrganizing} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                    {isOrganizing ? <Loader2 className="animate-spin mx-auto" size={16}/> : 'Iniciar Auditoría'}
                                </button>
                            </div>

                            <div className="bg-slate-950 p-6 rounded-2xl border border-red-900/30 flex flex-col items-center gap-4 text-center">
                                <ShieldAlert size={32} className="text-red-500" />
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase mb-1">Purga Ejecutiva</h4>
                                    <p className="text-[10px] text-slate-500 font-medium">Borra físicamente los archivos basura detectados.</p>
                                </div>
                                <button onClick={() => runLibrarian(false)} disabled={isOrganizing} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-900/20">
                                    {isOrganizing ? <Loader2 className="animate-spin mx-auto" size={16}/> : 'Ejecutar Purga Real'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-red-500/30 rounded-3xl overflow-hidden animate-in zoom-in-95 shadow-2xl">
                            <div className="p-5 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={20} className="text-red-400 animate-bounce"/>
                                    <div>
                                        <h4 className="font-black text-xs text-red-400 uppercase tracking-widest">Archivos Candidatos a Destrucción</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">Basura detectada por el Janitor Engine</p>
                                    </div>
                                </div>
                                <button onClick={() => setSimPlan([])} className="p-2 hover:bg-red-500/20 rounded-full text-slate-500 transition-colors"><X/></button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto bg-black/20 custom-scrollbar">
                                {simPlan.map((p, i) => (
                                    <div key={i} className="p-4 border-b border-slate-800/50 flex justify-between items-center hover:bg-red-500/5 group transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-mono text-slate-300 truncate">{p.file}</div>
                                            <div className="text-[9px] text-slate-500 font-black uppercase mt-1 flex items-center gap-1"><Info size={10}/> {p.reason}</div>
                                        </div>
                                        <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ml-4">FLAG: DELETE</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-950/50 text-center border-t border-slate-800">
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">Fin del informe: {simPlan.length} archivos detectados</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}