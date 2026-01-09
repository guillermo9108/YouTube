
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
        if (!confirm(`¿Confirmas la purga permanente de ${cleanupPreview.length} archivos?`)) return;

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

    const alerts = useMemo(() => {
        const list: StorageAlert[] = [];
        if (stats && stats.volumes) {
            stats.volumes.forEach((v: any) => {
                const usage = (v.total - v.free) / v.total;
                if (usage > 0.95) list.push({ level: 'CRITICAL', text: `Disco '${v.name}' al 95%+. Purgar urgente.` });
                else if (usage > 0.85) list.push({ level: 'WARNING', text: `Disco '${v.name}' al 85%.` });
            });
        }
        return list;
    }, [stats]);

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => { setActiveTab(id); setCleanupPreview([]); }} 
            className={`flex-1 py-4 px-1 flex flex-col items-center gap-1.5 transition-all border-b-2 font-black text-[9px] uppercase tracking-tighter ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.03]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
            <Icon size={18} className={activeTab === id ? 'animate-pulse' : ''} />
            <span className="hidden xs:inline">{label}</span>
            <span className="xs:hidden">{label.split(' ')[0]}</span>
        </button>
    );

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in pb-24 max-w-7xl mx-auto px-1 md:px-2">
            
            {/* Header Compacto para Mobile */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-slate-900 border border-slate-800 p-4 md:p-8 rounded-3xl md:rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Server size={80} className="md:w-[120px] md:h-[120px]"/></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><HardDrive size={20} className="md:w-6 md:h-6"/></div>
                        <h2 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Storage</h2>
                    </div>
                    <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-widest">Estado Cross-HDD</p>
                </div>
                <button onClick={loadData} className="absolute top-4 right-4 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 active:scale-90 transition-all md:relative md:top-0 md:right-0 md:p-4 md:rounded-2xl">
                    <RefreshCw size={18} className="md:w-6 md:h-6"/>
                </button>
            </div>

            {/* Navigation Tabs - Optimizado para pulgares */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl sticky top-[74px] z-30">
                <TabBtn id="HEALTH" label="Estado" icon={Activity} />
                <TabBtn id="EXPLORER" label="Auditoría" icon={TrendingDown} />
                <TabBtn id="LIBRARIAN" label="Janitor" icon={Zap} />
            </div>

            {activeTab === 'HEALTH' && (
                <div className="space-y-4 animate-in zoom-in-95 duration-500">
                    {alerts.length > 0 && (
                        <div className="space-y-2">
                            {alerts.map((a, i) => (
                                <div key={i} className={`p-3 rounded-xl border flex items-center gap-3 animate-in slide-in-from-left ${a.level === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                    <AlertCircle size={16} />
                                    <p className="text-[10px] font-black uppercase tracking-tight leading-none">{a.text}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-8 shadow-xl">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <HardDrive size={14}/> Unidades de Disco
                            </h4>
                            <div className="space-y-4">
                                {stats?.volumes?.map((vol: any, idx: number) => {
                                    const usedPercent = Math.round(((vol.total - vol.free) / vol.total) * 100);
                                    return (
                                        <div key={idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-white uppercase truncate block">{vol.name}</span>
                                                    <span className="text-[8px] font-mono text-slate-500 truncate block mt-0.5">{vol.path}</span>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${usedPercent > 90 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{usedPercent}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 mb-3">
                                                <div className={`h-full transition-all duration-1000 ${usedPercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${usedPercent}%` }}></div>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                                <div className="flex gap-3">
                                                    <span>{vol.free}GB <span className="opacity-40">Libres</span></span>
                                                    <span>{vol.total}GB <span className="opacity-40">Total</span></span>
                                                </div>
                                                <span className="text-indigo-400">{vol.video_count} vids</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4"><Database size={24}/></div>
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Índice MariaDB</h4>
                                <div className="text-4xl font-black text-white">{stats?.db_videos || 0}</div>
                                <p className="text-[8px] text-emerald-400 mt-2 font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><CheckCircle size={10}/> Consistencia OK</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 size={12}/> Top Categorías</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {stats?.category_stats?.slice(0, 4).map((cat: any) => (
                                        <div key={cat.category} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                                            <div className="text-[7px] text-slate-500 uppercase truncate mb-1">{cat.category.replace('_', ' ')}</div>
                                            <div className="text-sm font-black text-white">{cat.count}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'EXPLORER' && (
                <div className="space-y-4 animate-in slide-in-from-right-8 duration-500">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0"><TrendingDown size={20}/></div>
                                <div>
                                    <h3 className="font-black text-white uppercase text-sm tracking-tighter italic">Auditor de Espacio</h3>
                                    <p className="text-[10px] text-slate-500">Localiza archivos ineficientes.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <select 
                                    value={cleanupType} onChange={e => setCleanupType(e.target.value as any)} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none"
                                >
                                    <option value="LOW_ROI">Bajo ROI (Vistas/GB)</option>
                                    <option value="ORPHAN_DB">Vínculos Rotos (404)</option>
                                </select>
                                <button 
                                    onClick={() => handleSearchCleanup()} disabled={isSearching} 
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                                >
                                    {isSearching ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>} Escanear Discos
                                </button>
                            </div>
                        </div>
                    </div>

                    {cleanupPreview.length > 0 && (
                        <div className="space-y-3 animate-in fade-in">
                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3 items-center">
                                <div className="relative w-full">
                                    <Search size={14} className="absolute left-3 top-3 text-slate-500"/>
                                    <input 
                                        type="text" placeholder="Filtrar resultados..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none" 
                                    />
                                </div>
                                <button onClick={() => handleBulkAction('DELETE')} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    <Trash2 size={14}/> Purgar {filteredCleanup.length}
                                </button>
                            </div>

                            {/* Vista de tarjetas optimizada para modo vertical */}
                            <div className="grid grid-cols-1 gap-2">
                                {filteredCleanup.map(v => (
                                    <div key={v.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 group">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-white truncate leading-tight mb-1">{v.title}</div>
                                                <div className="text-[8px] font-mono text-slate-500 truncate">{v.videoUrl}</div>
                                            </div>
                                            <div className="bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[10px] font-black text-indigo-400 whitespace-nowrap">
                                                {v.size_fmt || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                                    <Eye size={12}/> {v.views}
                                                </div>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${v.reason?.includes('No Encontrado') ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-400'}`}>
                                                    {v.reason}
                                                </span>
                                            </div>
                                            <button onClick={() => {}} className="p-2 text-slate-600 hover:text-red-500 active:scale-90 transition-all">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARIAN' && (
                <div className="space-y-4 animate-in slide-in-from-left-8 duration-500">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none rotate-12"><Zap size={150} className="md:w-[300px] md:h-[300px]"/></div>
                        <div className="flex items-center gap-4 mb-8 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20"><Zap size={24}/></div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Janitor Engine</h3>
                                <p className="text-[10px] text-slate-400">Limpieza profunda de residuos.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 relative z-10">
                            <button 
                                onClick={() => runLibrarian(true)} disabled={isOrganizing} 
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white p-5 rounded-2xl border border-slate-700 flex flex-col items-center gap-2 text-center transition-all"
                            >
                                <Layers size={24} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Auditar Todo</span>
                            </button>

                            <button 
                                onClick={() => runLibrarian(false)} disabled={isOrganizing} 
                                className="w-full bg-red-600 hover:bg-red-500 text-white p-5 rounded-2xl border border-red-500 flex flex-col items-center gap-2 text-center shadow-xl active:scale-95 transition-all"
                            >
                                <ShieldAlert size={24} className="text-white" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Purga Inmediata</span>
                            </button>
                        </div>
                    </div>

                    {simPlan.length > 0 && (
                        <div className="bg-slate-900 border border-red-500/30 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-4 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center">
                                <span className="font-black text-xs text-red-400 uppercase tracking-widest">Basura Detectada</span>
                                <button onClick={() => setSimPlan([])} className="text-slate-500 p-1"><X size={18}/></button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto bg-black/20 custom-scrollbar">
                                {simPlan.map((p, i) => (
                                    <div key={i} className="p-4 border-b border-slate-800 flex flex-col gap-1">
                                        <div className="text-[11px] font-mono text-slate-300 truncate">{p.file}</div>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[8px] text-slate-500 font-bold uppercase">Ubicación: <span className="text-slate-400 truncate max-w-[150px] inline-block align-bottom">{p.path}</span></span>
                                            <span className="text-[9px] font-black text-red-500 uppercase">{p.size}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
            `}</style>
        </div>
    );
}
