import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/db';
import { Video } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    HardDrive, Trash2, Wand2, Loader2, Move, PlayCircle, 
    PieChart, Database, Eye, ShieldAlert, Zap, AlertTriangle, X, Info, Trash, FolderTree, CheckCircle, Shield, TrendingDown, Activity, Filter, Search,
    /* Added Check to fix the missing import error */
    Check
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
            if (res.length === 0) toast.info("No se encontraron archivos bajo este criterio.");
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSearching(false); }
    };

    const handleBulkAction = async (action: 'DELETE' | 'ADOPT') => {
        if (cleanupPreview.length === 0) return;
        const msg = action === 'DELETE' 
            ? `¿Confirmas eliminar permanentemente ${cleanupPreview.length} archivos del disco?` 
            : `¿Confirmas registrar estos archivos en la base de datos?`;
        
        if (!confirm(msg)) return;

        setIsSearching(true);
        try {
            const ids = cleanupPreview.map(v => v.id);
            await db.request(`action=admin_smart_cleaner_execute`, {
                method: 'POST',
                body: JSON.stringify({ videoIds: ids, subAction: action })
            });
            toast.success("Operación masiva completada.");
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
                toast.info(`Simulación: ${(res?.plan || []).length} cambios detectados.`);
            } else {
                toast.success(`Limpieza terminada. Archivos purgados: ${res.cleaned}`);
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
            
            {/* Header Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                <TabBtn id="HEALTH" label="Estado & Salud" icon={Activity} />
                <TabBtn id="EXPLORER" label="Analizador de ROI" icon={TrendingDown} />
                <TabBtn id="LIBRARIAN" label="Purga Inteligente" icon={Zap} />
            </div>

            {activeTab === 'HEALTH' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95">
                    {/* Disk Usage */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Capacidad Real</h4>
                            <HardDrive size={20} className="text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative w-24 h-24 shrink-0">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="4" />
                                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-500" strokeWidth="4" strokeDasharray={`${Math.round((stats?.disk_free / (stats?.disk_total || 1)) * 100)}, 100`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-black text-white text-lg leading-none">{Math.round((stats?.disk_free / (stats?.disk_total || 1)) * 100)}%</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Libre</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white tracking-tighter">{stats?.disk_free || 0} GB</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Disponibles en el NAS</div>
                            </div>
                        </div>
                    </div>

                    {/* DB Count */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center text-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4"><Database size={24}/></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Registros en DB</h4>
                        <div className="text-4xl font-black text-white">{stats?.db_videos || 0}</div>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Archivos controlados por la plataforma</p>
                    </div>

                    {/* Broken Links Check */}
                    <div className={`bg-slate-900 border rounded-3xl p-6 shadow-xl flex flex-col justify-center text-center transition-colors ${stats?.broken_links > 0 ? 'border-red-500/30' : 'border-slate-800'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${stats?.broken_links > 0 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-500'}`}><ShieldAlert size={24}/></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Vínculos Rotos</h4>
                        <div className={`text-4xl font-black ${stats?.broken_links > 0 ? 'text-red-500' : 'text-white'}`}>{stats?.broken_links || 0}</div>
                        {stats?.broken_links > 0 ? (
                            <button onClick={() => { setCleanupType('ORPHAN_DB'); setActiveTab('EXPLORER'); handleSearchCleanup('ORPHAN_DB'); }} className="mt-3 text-[10px] font-black text-red-400 uppercase tracking-widest hover:underline">Ver y Reparar &rarr;</button>
                        ) : (
                            <p className="text-[10px] text-emerald-500 mt-2 font-bold uppercase">Integridad Perfecta</p>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'EXPLORER' && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0"><Filter size={24}/></div>
                                <div>
                                    <h3 className="font-black text-white uppercase tracking-tighter text-lg">Criterios de Optimización</h3>
                                    <p className="text-xs text-slate-500">Analiza qué archivos están desperdiciando recursos del servidor.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <select value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500">
                                    <option value="LOW_ROI">Baja Rentabilidad (Size vs Vistas)</option>
                                    <option value="LOW_PERFORMANCE">Inactivos (Sin vistas +90 días)</option>
                                    <option value="ORPHAN_DB">Vínculos Rotos (DB sin archivo)</option>
                                </select>
                                <button onClick={() => handleSearchCleanup()} disabled={isSearching} className="flex-1 md:flex-none px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                                    {isSearching ? <Loader2 className="animate-spin" size={16}/> : <Activity size={16}/>} Analizar
                                </button>
                            </div>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="relative w-full md:w-64">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-500"/>
                                    <input type="text" placeholder="Filtrar resultados..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500" />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={() => setCleanupPreview([])} className="px-4 py-2 text-slate-500 hover:text-white font-bold text-[10px] uppercase">Cancelar</button>
                                    <button onClick={() => handleBulkAction('DELETE')} className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20">Purgar Seleccionados</button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-950/80 sticky top-0 z-10 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        <tr>
                                            <th className="p-4">Archivo / Categoría</th>
                                            <th className="p-4">Rendimiento (ROI)</th>
                                            <th className="p-4">Estado / Motivo</th>
                                            <th className="p-4 text-right">Peso Estimado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredCleanup.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="p-4">
                                                    <div className="text-xs font-bold text-white truncate max-w-[200px]">{v.title}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{v.category}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-300 flex items-center gap-1 font-bold"><Eye size={10} className="text-indigo-400"/> {v.views}</span>
                                                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold"><Check size={10}/> {v.likes}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-slate-950 border border-slate-800 text-[9px] font-black text-amber-500 px-2 py-1 rounded uppercase tracking-tighter">
                                                        {v.reason || 'Bajo ROI'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-mono text-xs text-slate-400 font-bold">{(v as any).size_fmt || 'N/A'}</span>
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
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner"><Zap size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Janitor Purge Engine</h3>
                                <p className="text-xs text-slate-400">Eliminación masiva de basura: samples, trailers y duplicados.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <button onClick={() => runLibrarian(true)} disabled={isOrganizing} className="p-6 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center gap-3 border border-slate-700 shadow-xl transition-all hover:-translate-y-1">
                                <Eye size={32} className="text-indigo-400" />
                                Auditar Desperdicios
                            </button>
                            <button onClick={() => runLibrarian(false)} disabled={isOrganizing} className="p-6 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center gap-3 shadow-2xl shadow-red-900/30 transition-all hover:-translate-y-1">
                                <Trash2 size={32} />
                                Ejecutar Purga Real
                            </button>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-red-500/30 rounded-3xl overflow-hidden animate-in zoom-in-95 shadow-2xl">
                            <div className="p-5 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center">
                                <div>
                                    <h4 className="font-black text-xs text-red-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16}/> Informe de Purga Proyectada</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Archivos marcados para destrucción inmediata</p>
                                </div>
                                <button onClick={() => setSimPlan([])} className="p-2 hover:bg-red-500/20 rounded-full text-slate-500 hover:text-red-400 transition-colors"><X/></button>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto bg-black/20">
                                {simPlan.map((p, i) => (
                                    <div key={i} className="p-4 border-b border-slate-800/50 flex justify-between items-center group hover:bg-red-500/5 transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-white truncate">{p.file}</div>
                                            <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">{p.reason}</div>
                                        </div>
                                        <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ml-4">BORRAR</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-950/50 text-center">
                                <p className="text-[10px] text-slate-600 font-bold uppercase">Total proyectado: {simPlan.length} archivos</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
