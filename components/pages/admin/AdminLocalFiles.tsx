
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, 
    PieChart, Database, Eye, ShieldAlert, Zap, AlertTriangle, X, Info, 
    FolderTree, CheckCircle, TrendingDown, Activity, Filter, Search,
    ArrowUpRight, BarChart3, Layers, FileVideo, Shield, RefreshCw,
    AlertCircle, Gauge, ChevronRight, Download, Server
} from 'lucide-react';

interface StorageAlert {
    level: 'CRITICAL' | 'WARNING' | 'INFO';
    text: string;
}

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
        if (!confirm(`¿Confirmas la purga permanente de ${cleanupPreview.length} archivos? Esta acción liberará espacio físico inmediatamente en sus respectivos discos.`)) return;

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
                toast.info(`${(res?.plan || []).length} archivos basura detectados en volúmenes.`);
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

    // Cálculo de alertas multi-volumen
    const alerts = useMemo(() => {
        const list: StorageAlert[] = [];
        if (stats && stats.volumes) {
            stats.volumes.forEach((v: any) => {
                const usage = (v.total - v.free) / v.total;
                if (usage > 0.95) list.push({ level: 'CRITICAL', text: `Disco '${v.name}' casi lleno (95%+). Purgar contenido ROI bajo.` });
                else if (usage > 0.85) list.push({ level: 'WARNING', text: `Disco '${v.name}' superó el 85%. Monitorear crecimiento.` });
            });
        }
        return list;
    }, [stats]);

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => { setActiveTab(id); setCleanupPreview([]); }} 
            className={`flex-1 py-5 px-2 flex flex-col items-center gap-2 transition-all border-b-2 font-black text-[10px] uppercase tracking-widest ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.03]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
            <Icon size={22} className={activeTab === id ? 'animate-pulse' : ''} />
            {label}
        </button>
    );

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-24 max-w-7xl mx-auto px-2">
            
            {/* Header Pro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Server size={120}/></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><HardDrive size={24}/></div>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Storage Station</h2>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Análisis de Volúmenes y Salud de Datos Cross-HDD</p>
                </div>
                <div className="relative z-10 flex gap-2">
                    <button onClick={loadData} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-90">
                        <RefreshCw size={24}/>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                <TabBtn id="HEALTH" label="Análisis de Discos" icon={Activity} />
                <TabBtn id="EXPLORER" label="Explorador ROI" icon={TrendingDown} />
                <TabBtn id="LIBRARIAN" label="Limpieza de Pakete" icon={Zap} />
            </div>

            {activeTab === 'HEALTH' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                    
                    {/* Alertas Críticas */}
                    {alerts.length > 0 && (
                        <div className="space-y-3">
                            {alerts.map((a, i) => (
                                <div key={i} className={`p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-left ${a.level === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' : (a.level === 'WARNING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400')}`}>
                                    <AlertCircle size={20} />
                                    <p className="text-xs font-bold uppercase tracking-wide">{a.text}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Lista de Unidades de Disco */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl space-y-8">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <HardDrive size={14}/> Unidades de Almacenamiento Detectadas
                            </h4>
                            
                            <div className="space-y-6">
                                {stats?.volumes?.map((vol: any, idx: number) => {
                                    const usedPercent = Math.round(((vol.total - vol.free) / vol.total) * 100);
                                    return (
                                        <div key={idx} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="min-w-0">
                                                    <span className="text-sm font-black text-white uppercase truncate block">Disco: {vol.name}</span>
                                                    <span className="text-[9px] font-mono text-slate-500 truncate block mt-1">{vol.path}</span>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${usedPercent > 90 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                    {usedPercent}%
                                                </div>
                                            </div>

                                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 mb-4">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ease-out ${usedPercent > 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.4)]'}`} 
                                                    style={{ width: `${usedPercent}%` }}
                                                ></div>
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <div className="flex gap-4">
                                                    <div className="text-slate-400">Total: <span className="text-white">{vol.total} GB</span></div>
                                                    <div className="text-slate-400">Libre: <span className="text-emerald-400">{vol.free} GB</span></div>
                                                </div>
                                                <div className="text-indigo-400 flex items-center gap-1.5">
                                                    <FileVideo size={12}/> {vol.video_count} Archivos
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Índice MariaDB & Heatmap */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl flex flex-col justify-center text-center group hover:border-indigo-500/30 transition-all">
                                <div className="w-20 h-20 rounded-[32px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-inner group-hover:scale-110 transition-transform"><Database size={32}/></div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Videos en Índice Global</h4>
                                <div className="text-6xl font-black text-white tracking-tighter">{stats?.db_videos || 0}</div>
                                <p className="text-[10px] text-emerald-400 mt-4 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                    <CheckCircle size={12}/> Integridad Cross-Drive OK
                                </p>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><BarChart3 size={20}/></div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Eficiencia por Categoría</h4>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {stats?.category_stats?.slice(0, 4).map((cat: any) => (
                                        <div key={cat.category} className="bg-slate-950 border border-slate-800 p-4 rounded-3xl flex flex-col items-center text-center">
                                            <div className="text-[8px] font-black text-slate-500 uppercase mb-2 truncate w-full">{cat.category.replace('_', ' ')}</div>
                                            <div className="text-lg font-black text-white mb-1">{cat.count}</div>
                                            <div className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Eye size={10}/> {cat.totalViews}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'EXPLORER' && (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingDown size={80}/></div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg"><TrendingDown size={32}/></div>
                                <div>
                                    <h3 className="font-black text-white uppercase tracking-tighter text-xl italic">Auditor Cross-Drive</h3>
                                    <p className="text-sm text-slate-500">Analiza el rendimiento económico de tus archivos en todos los discos conectados.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <select 
                                    value={cleanupType} 
                                    onChange={e => setCleanupType(e.target.value as any)} 
                                    className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                >
                                    <option value="LOW_ROI">Archivos Ineficientes (Vistas/GB)</option>
                                    <option value="ORPHAN_DB">Vínculos Rotos (Error 404)</option>
                                </select>
                                <button 
                                    onClick={() => handleSearchCleanup()} 
                                    disabled={isSearching} 
                                    className="flex-1 md:flex-none px-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {isSearching ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Analizar Almacenamiento
                                </button>
                            </div>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl animate-in fade-in duration-700">
                            <div className="p-6 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="relative w-full md:w-80">
                                    <Search size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar por título..." 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                                    />
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button onClick={() => setCleanupPreview([])} className="px-6 py-3 text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                                    <button 
                                        onClick={() => handleBulkAction('DELETE')} 
                                        className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                    >
                                        <Trash2 size={16}/> Purgar Físicamente de los Discos
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950/90 sticky top-0 z-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="p-6">Activo & Ubicación</th>
                                            <th className="p-6 text-center">Audiencia</th>
                                            <th className="p-6">Auditoría</th>
                                            <th className="p-6 text-right">Peso Est.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredCleanup.map(v => (
                                            <tr key={v.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <div className="text-sm font-black text-white truncate max-w-[300px] group-hover:text-indigo-300">{v.title}</div>
                                                    <div className="text-[9px] text-slate-600 font-mono mt-1 truncate max-w-[300px]">{v.videoUrl}</div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="inline-flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-black shadow-inner">
                                                        <Eye size={12} className="text-indigo-400"/> {v.views}
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter shadow-sm ${v.reason?.includes('No Encontrado') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                                        {v.reason || 'Sugerido'}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <span className="font-mono text-sm text-slate-300 font-black tracking-tighter">{v.size_fmt || 'N/A'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-slate-950/50 text-center border-t border-slate-800">
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">Fin del reporte: {filteredCleanup.length} archivos detectados</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-6 animate-in slide-in-from-left-8 duration-500">
                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute -right-20 -top-20 opacity-5 pointer-events-none rotate-12"><Zap size={300}/></div>
                        <div className="flex items-center gap-6 mb-12 relative z-10">
                            <div className="w-20 h-20 rounded-[32px] bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner animate-pulse border border-amber-500/20"><Zap size={40}/></div>
                            <div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Janitor Pro V8 (Multi-Volume)</h3>
                                <p className="text-sm text-slate-400 mt-2 max-w-lg">Motor de mantenimiento preventivo. Detecta archivos de sistema, samples y residuos de metadatos en todas tus rutas de Discos & Volúmenes.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <div className="bg-slate-950 p-8 rounded-[32px] border border-slate-800 flex flex-col items-center gap-6 text-center hover:border-indigo-500/30 transition-all shadow-inner group">
                                <div className="p-4 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform"><Layers size={40} className="text-indigo-400" /></div>
                                <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Auditar Volúmenes</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">Escanear todas las rutas físicas en busca de archivos .nfo, .txt y temporales que no son videos.</p>
                                </div>
                                <button 
                                    onClick={() => runLibrarian(true)} 
                                    disabled={isOrganizing} 
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                                >
                                    {isOrganizing ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Lanzar Auditoría'}
                                </button>
                            </div>

                            <div className="bg-slate-950 p-8 rounded-[32px] border border-red-900/30 flex flex-col items-center gap-6 text-center hover:border-red-500/30 transition-all shadow-inner group">
                                <div className="p-4 bg-red-500/10 rounded-2xl group-hover:scale-110 transition-transform"><ShieldAlert size={40} className="text-red-500" /></div>
                                <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Purga Profunda</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">Ejecuta el borrado físico inmediato de toda la basura detectada en los HDDs externos y locales.</p>
                                </div>
                                <button 
                                    onClick={() => runLibrarian(false)} 
                                    disabled={isOrganizing} 
                                    className="w-full bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/40 active:scale-95"
                                >
                                    {isOrganizing ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Limpiar Todo'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-red-500/30 rounded-[40px] overflow-hidden animate-in zoom-in-95 shadow-2xl">
                            <div className="p-8 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-500 text-white rounded-2xl animate-bounce shadow-lg shadow-red-900/40"><AlertTriangle size={24}/></div>
                                    <div>
                                        <h4 className="font-black text-lg text-red-400 uppercase tracking-widest">Plan de Limpieza Multidisco</h4>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Archivos redundantes detectados en volúmenes externos</p>
                                    </div>
                                </div>
                                <button onClick={() => setSimPlan([])} className="p-3 hover:bg-red-500/20 rounded-full text-slate-500 transition-colors"><X size={24}/></button>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto bg-black/40 custom-scrollbar">
                                {simPlan.map((p, i) => (
                                    <div key={i} className="p-6 border-b border-slate-800 flex justify-between items-center hover:bg-red-500/[0.03] group transition-colors">
                                        <div className="min-w-0 flex-1 flex items-center gap-4">
                                            <FileVideo size={20} className="text-slate-700 shrink-0"/>
                                            <div className="min-w-0">
                                                <div className="text-sm font-mono text-slate-300 truncate group-hover:text-white transition-colors">{p.file}</div>
                                                <div className="text-[10px] text-slate-600 font-black uppercase mt-1 flex items-center gap-2"><Info size={12}/> Ubicación: <span className="text-amber-500/80">{p.path}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 ml-6">
                                            <span className="text-xs font-black text-slate-500 font-mono">{p.size || '0 MB'}</span>
                                            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black rounded-lg uppercase tracking-widest shadow-inner">UNLINK</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 bg-slate-950/80 text-center border-t border-slate-800">
                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em]">Fin del análisis: {simPlan.length} archivos basura en volúmenes</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}</style>
        </div>
    );
}
