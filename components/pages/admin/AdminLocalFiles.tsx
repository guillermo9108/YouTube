
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, 
    PieChart, Database, Eye, ShieldAlert, Zap, AlertTriangle, X, Info, 
    FolderTree, CheckCircle, TrendingDown, Activity, Filter, Search,
    ArrowUpRight, BarChart3, Layers, FileVideo, Shield, RefreshCw,
    AlertCircle, Gauge, ChevronRight, Download
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

    // Cálculo de alertas
    const alerts = useMemo(() => {
        const list = [];
        if (stats) {
            const usagePercent = (stats.disk_total - stats.disk_free) / stats.disk_total;
            if (usagePercent > 0.9) list.push({ level: 'CRITICAL', text: 'Espacio de disco inferior al 10%. Purga inmediata recomendada.' });
            else if (usagePercent > 0.8) list.push({ level: 'WARNING', text: 'Disco al 80%. Considere optimizar categorías pesadas.' });
            
            if (stats.folder_usage?.videos > 500000) list.push({ level: 'INFO', text: 'La carpeta de videos ha superado los 500GB.' });
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
                <div className="absolute top-0 right-0 p-8 opacity-5"><HardDrive size={120}/></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><Gauge size={24}/></div>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Data Station</h2>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Gestión de Almacenamiento y Salud de Archivos</p>
                </div>
                <div className="relative z-10 flex gap-2">
                    <button onClick={loadData} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-90">
                        <RefreshCw size={24}/>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                <TabBtn id="HEALTH" label="Estado & Alertas" icon={Activity} />
                <TabBtn id="EXPLORER" label="Explorador ROI" icon={TrendingDown} />
                <TabBtn id="LIBRARIAN" label="Janitor Engine" icon={Zap} />
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Gráfico de Anillo Espacio */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl flex flex-col items-center justify-between">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8 text-center w-full">Capacidad de Almacenamiento</h4>
                            <div className="relative w-48 h-48">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3" />
                                    <circle 
                                        cx="18" cy="18" r="16" fill="none" 
                                        className="stroke-indigo-500 transition-all duration-1000 ease-out" 
                                        strokeWidth="3" 
                                        strokeDasharray={`${Math.round(((stats?.disk_total - stats?.disk_free) / stats?.disk_total) * 100)}, 100`} 
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-white tracking-tighter">
                                        {Math.round(((stats?.disk_total - stats?.disk_free) / stats?.disk_total) * 100)}%
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">OCUPADO</span>
                                </div>
                            </div>
                            <div className="mt-8 flex gap-8">
                                <div className="text-center">
                                    <div className="text-xl font-black text-white">{stats?.disk_free || 0} <span className="text-[10px] opacity-40">GB</span></div>
                                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Disponibles</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xl font-black text-slate-400">{stats?.disk_total || 0} <span className="text-[10px] opacity-40">GB</span></div>
                                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Total</div>
                                </div>
                            </div>
                        </div>

                        {/* Índice MariaDB */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl flex flex-col justify-center text-center group hover:border-indigo-500/30 transition-all">
                            <div className="w-20 h-20 rounded-[32px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-inner group-hover:scale-110 transition-transform"><Database size={32}/></div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Entradas Registradas</h4>
                            <div className="text-6xl font-black text-white tracking-tighter">{stats?.db_videos || 0}</div>
                            <p className="text-[10px] text-emerald-400 mt-4 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                <CheckCircle size={12}/> Consistencia de Datos OK
                            </p>
                        </div>

                        {/* Breakdown Carpetas */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl relative overflow-hidden">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Mapeo de Directorios</h4>
                            <div className="space-y-6">
                                {Object.entries(stats?.folder_usage || {}).map(([dir, size]: any) => (
                                    <div key={dir} className="group">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                                <FolderTree size={12} className="text-indigo-400"/> {dir}
                                            </span>
                                            <span className="text-xs font-black text-white">{size} <span className="text-[8px] opacity-40">MB</span></span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, (size / (stats?.disk_total * 10.24)))}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Heatmap de Eficiencia */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><BarChart3 size={20}/></div>
                                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Rendimiento por Categoría</h4>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase italic">Basado en visualizaciones totales</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {stats?.category_stats?.map((cat: any) => (
                                <div key={cat.category} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl flex flex-col items-center text-center group hover:bg-indigo-600/5 transition-all">
                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-3 truncate w-full group-hover:text-indigo-300">{cat.category.replace('_', ' ')}</div>
                                    <div className="text-2xl font-black text-white mb-2">{cat.count}</div>
                                    <div className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                        <Eye size={12}/> {cat.totalViews}
                                    </div>
                                </div>
                            ))}
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
                                    <h3 className="font-black text-white uppercase tracking-tighter text-xl italic">Auditor de Rentabilidad (ROI)</h3>
                                    <p className="text-sm text-slate-500">Localiza archivos de gran tamaño con baja tracción de audiencia.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <select 
                                    value={cleanupType} 
                                    onChange={e => setCleanupType(e.target.value as any)} 
                                    className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                >
                                    <option value="LOW_ROI">Archivos Ineficientes (Vistas/GB)</option>
                                    <option value="LOW_PERFORMANCE">Abandono Crítico (0 vistas +60 días)</option>
                                    <option value="ORPHAN_DB">Vínculos Rotos (Error 404)</option>
                                </select>
                                <button 
                                    onClick={() => handleSearchCleanup()} 
                                    disabled={isSearching} 
                                    className="flex-1 md:flex-none px-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {isSearching ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Iniciar Análisis
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
                                        <Trash2 size={16}/> Purgar Permanentemente
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950/90 sticky top-0 z-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="p-6">Información del Activo</th>
                                            <th className="p-6 text-center">Audiencia</th>
                                            <th className="p-6">Estado de Auditoría</th>
                                            <th className="p-6 text-right">Peso Físico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredCleanup.map(v => (
                                            <tr key={v.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <div className="text-sm font-black text-white truncate max-w-[300px] group-hover:text-indigo-300">{v.title}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">{v.category} • ID: {v.id.substring(0,12)}</div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="inline-flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-black shadow-inner">
                                                        <Eye size={12} className="text-indigo-400"/> {v.views}
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter shadow-sm ${v.reason?.includes('Broken') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                                        {v.reason || 'Sugerido para Purga'}
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
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Janitor Engine Pro V8</h3>
                                <p className="text-sm text-slate-400 mt-2 max-w-lg">Motor de mantenimiento preventivo. Detecta archivos de sistema, samples, trailers duplicados y residuos temporales en el NAS.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <div className="bg-slate-950 p-8 rounded-[32px] border border-slate-800 flex flex-col items-center gap-6 text-center hover:border-indigo-500/30 transition-all shadow-inner group">
                                <div className="p-4 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform"><Layers size={40} className="text-indigo-400" /></div>
                                <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Simular Limpieza</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">Analiza el sistema sin realizar cambios. Genera un plan de purga detallado para revisión manual.</p>
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
                                    <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Purga Ejecutiva</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">Ejecuta el borrado físico inmediato de toda la basura detectada. Libera espacio crítico al instante.</p>
                                </div>
                                <button 
                                    onClick={() => runLibrarian(false)} 
                                    disabled={isOrganizing} 
                                    className="w-full bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/40 active:scale-95"
                                >
                                    {isOrganizing ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Purga Irreversible'}
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
                                        <h4 className="font-black text-lg text-red-400 uppercase tracking-widest">Plan de Purga Detectado</h4>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Archivos redundantes listos para destrucción física</p>
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
                                                <div className="text-[10px] text-slate-600 font-black uppercase mt-1 flex items-center gap-2"><Info size={12}/> Motivo: <span className="text-amber-500/80">{p.reason}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 ml-6">
                                            <span className="text-xs font-black text-slate-500 font-mono">{p.size || '0 MB'}</span>
                                            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black rounded-lg uppercase tracking-widest shadow-inner">DELETE</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 bg-slate-950/80 text-center border-t border-slate-800">
                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em]">Fin del análisis: {simPlan.length} anomalías estructurales</p>
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
