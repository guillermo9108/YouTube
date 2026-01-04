
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { SmartCleanerResult } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { 
    Wrench, Trash2, Database, Brush, Activity, Server, 
    HardDrive, CheckCircle, Zap, Loader2, RefreshCw, Smartphone, TrendingDown, Eye, X
} from 'lucide-react';

export default function AdminMaintenance() {
    const toast = useToast();
    const [cleaning, setCleaning] = useState(false);
    const [cleanerPreview, setCleanerPreview] = useState<SmartCleanerResult | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [stats, setStats] = useState<any>(null);
    
    const [config, setConfig] = useState({ minDays: 30, maxViews: 5 });

    const loadData = async () => {
        try {
            const [lLogs, lStats] = await Promise.all([
                db.request<string[]>('action=admin_get_logs'),
                db.request<any>('action=admin_get_local_stats')
            ]);
            setLogs(lLogs || []);
            setStats(lStats);
        } catch (e) {}
    };

    useEffect(() => { loadData(); }, []);

    const handleCleanupOrphans = async () => {
        if (!confirm("Esto eliminará físicamente archivos sin registro en la DB. ¿Continuar?")) return;
        setCleaning(true);
        try {
            const res = await db.request<any>('action=admin_cleanup_files');
            toast.success(`Limpieza OK: ${res.videos} archivos eliminados.`);
            loadData();
        } catch (e: any) { toast.error(e.message); }
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
        } catch (e: any) { toast.error(e.message); }
        finally { setCleaning(false); }
    };

    const handleExecuteCleaner = async () => {
        if (!cleanerPreview || cleanerPreview.preview.length === 0) return;
        if (!confirm(`Purga Irreversible: ¿Eliminar ${cleanerPreview.preview.length} videos ahora?`)) return;
        setCleaning(true);
        try {
            await db.request(`action=admin_smart_cleaner_execute`, {
                method: 'POST',
                body: JSON.stringify({ videoIds: cleanerPreview.preview.map(v => v.id) })
            });
            toast.success("Purga terminada");
            setCleanerPreview(null);
            loadData();
        } catch (e: any) { toast.error(e.message); }
        finally { setCleaning(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20 max-w-6xl mx-auto px-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center"><HardDrive size={20}/></div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-black">Disco Libre</div>
                        <div className="text-sm font-black text-white">{stats?.disk_free || 0} GB</div>
                    </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center"><Database size={20}/></div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-black">Índice DB</div>
                        <div className="text-sm font-black text-white">{stats?.db_videos || 0}</div>
                    </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center"><RefreshCw size={20}/></div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-black">Background</div>
                        <div className="text-sm font-black text-emerald-400">Activo</div>
                    </div>
                </div>
                <div onClick={loadData} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-slate-800 transition-all">
                    <RefreshCw size={20} className="text-indigo-400"/>
                    <div className="text-[10px] text-slate-500 uppercase font-black">Refrescar</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
                        <h3 className="font-black text-white uppercase italic flex items-center gap-2 tracking-tighter"><Brush size={20} className="text-indigo-400"/> Janitor Engine</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2">Antigüedad: {config.minDays} días</label>
                                <input type="range" min="1" max="180" value={config.minDays} onChange={e => setConfig({...config, minDays: parseInt(e.target.value)})} className="w-full accent-indigo-500" />
                            </div>
                            <div>
                                <label className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2">Vistas Máx: {config.maxViews}</label>
                                <input type="range" min="0" max="50" value={config.maxViews} onChange={e => setConfig({...config, maxViews: parseInt(e.target.value)})} className="w-full accent-amber-500" />
                            </div>
                            <button onClick={handlePreviewCleaner} disabled={cleaning} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all">
                                {cleaning ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20}/>} Analizar Basura
                            </button>
                        </div>
                    </div>

                    <button onClick={handleCleanupOrphans} disabled={cleaning} className="w-full flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-2xl transition-all group shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Trash2 size={20} /></div>
                            <div className="text-left">
                                <span className="block text-xs font-black text-white uppercase italic">Purgar Huérfanos</span>
                                <span className="block text-[9px] text-slate-500 font-bold">LIMPIEZA DE DISCO FÍSICO</span>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="lg:col-span-2">
                    {cleanerPreview ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[500px] animate-in slide-in-from-right-4">
                            <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase italic">Candidatos a Purga</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{cleanerPreview.preview.length} archivos detectados</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCleanerPreview(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={20}/></button>
                                    <button onClick={handleExecuteCleaner} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
                                        <Trash2 size={16}/> Purgar Ahora
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-black/20 custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-950/80 sticky top-0 z-10 text-[9px] font-black text-slate-500 uppercase">
                                        <tr><th className="p-4">Video</th><th className="p-4">Vistas</th><th className="p-4">Peso</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cleanerPreview.preview.map((v: any) => (
                                            <tr key={v.id} className="hover:bg-slate-800/30">
                                                <td className="p-4 text-xs font-bold text-white truncate max-w-[200px]">{v.title}</td>
                                                <td className="p-4 text-[10px] text-slate-400">{v.views}</td>
                                                <td className="p-4 text-[10px] font-mono text-indigo-400">{v.size_fmt}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden h-[500px] flex flex-col shadow-2xl">
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-slate-400"><Activity size={18} /><h4 className="text-[10px] font-black uppercase tracking-widest">Logs de Sistema</h4></div>
                            </div>
                            <div className="flex-1 bg-black/40 overflow-y-auto p-4 font-mono text-[9px] space-y-1.5 custom-scrollbar">
                                {logs.map((log, i) => <div key={i} className="text-slate-500 border-b border-white/5 pb-1 flex gap-3"><span className="opacity-20">{i}</span> {log}</div>)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
