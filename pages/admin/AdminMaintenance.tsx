
import React, { useState } from 'react';
import { db } from '../../services/db';
import { VideoCategory, SmartCleanerResult } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Wrench, Trash2, Database, Brush, Activity, Server, HardDrive, CheckCircle, Percent, Clock } from 'lucide-react';

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
    const [cleanerPercent, setCleanerPercent] = useState(10);
    const [cleanerCategory, setCleanerCategory] = useState('ALL');
    const [cleanerDays, setCleanerDays] = useState(30);

    const handleCleanupOrphans = async () => {
        if (!confirm("Esta acción eliminará FÍSICAMENTE los archivos (videos, fotos, avatares) que no estén registrados en la base de datos. ¿Continuar?")) return;
        setCleaning(true);
        try {
            const res = await db.adminCleanupSystemFiles();
            toast.success(`Eliminados: ${res.videos} videos, ${res.thumbnails} miniaturas, ${res.avatars} avatares, ${res.market} fotos tienda.`);
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    const handleRepairDb = async () => {
        setCleaning(true);
        try {
            await db.adminRepairDb();
            toast.success("Base de datos reparada y sincronizada.");
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    const handlePreviewCleaner = async () => {
        setCleaning(true);
        try {
            const res = await db.getSmartCleanerPreview(cleanerCategory, cleanerPercent, cleanerDays);
            setCleanerPreview(res);
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    const handleExecuteCleaner = async () => {
        if (!cleanerPreview || cleanerPreview.preview.length === 0) return;
        if (!confirm(`PELIGRO: Vas a eliminar permanentemente ${cleanerPreview.preview.length} videos. ¿Estás absolutamente seguro?`)) return;
        
        setCleaning(true);
        try {
            const ids = cleanerPreview.preview.map(v => v.id);
            const res = await db.executeSmartCleaner(ids);
            toast.success(`Eliminados ${res.deleted} videos. Espacio recuperado.`);
            setCleanerPreview(null);
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* System Health Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SystemHealthCard icon={Activity} label="Estado API" status="Online" color="bg-emerald-500" />
                <SystemHealthCard icon={Database} label="Base de Datos" status="Conectado" color="bg-blue-500" />
                <SystemHealthCard icon={HardDrive} label="Almacenamiento" status="Escritura OK" color="bg-purple-500" />
                <SystemHealthCard icon={Server} label="Cola Tareas" status="Activa" color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Wrench size={18}/> Herramientas Críticas</h3>
                    <div className="space-y-4">
                        <button onClick={handleCleanupOrphans} disabled={cleaning} className="w-full p-4 bg-slate-950 border border-slate-800 hover:border-red-500/50 rounded-xl text-left group transition-all relative overflow-hidden">
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Trash2 size={24}/></div>
                                <div>
                                    <span className="font-bold text-slate-200 block text-sm">Limpieza de Archivos Huérfanos</span>
                                    <span className="text-xs text-slate-500">Elimina basura del disco duro (archivos sin DB).</span>
                                </div>
                            </div>
                        </button>

                        <button onClick={handleRepairDb} disabled={cleaning} className="w-full p-4 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left group transition-all relative overflow-hidden">
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Database size={24}/></div>
                                <div>
                                    <span className="font-bold text-slate-200 block text-sm">Reparación de Base de Datos</span>
                                    <span className="text-xs text-slate-500">Sincroniza tablas y corrige índices corruptos.</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Brush size={18}/> Smart Cleaner</h3>
                    <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-2 rounded border border-slate-800">
                        Esta herramienta analiza tus videos y sugiere eliminar los que tienen <strong>bajo rendimiento</strong> (pocas vistas/likes) para ahorrar espacio.
                    </p>
                    
                    <div className="space-y-4 flex-1">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Categoría</label>
                            <select value={cleanerCategory} onChange={e=>setCleanerCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-indigo-500">
                                <option value="ALL">Todas las Categorías</option>
                                {Object.values(VideoCategory).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1 flex items-center gap-1"><Percent size={10}/> Agresividad (Eliminar %)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="50" 
                                    value={cleanerPercent} 
                                    onChange={e => setCleanerPercent(parseInt(e.target.value))} 
                                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-indigo-500"
                                    placeholder="%"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1 flex items-center gap-1"><Clock size={10}/> Antigüedad (Días)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={cleanerDays} 
                                    onChange={e => setCleanerDays(parseInt(e.target.value))} 
                                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-indigo-500"
                                    placeholder="Días"
                                />
                            </div>
                        </div>
                        
                        {!cleanerPreview ? (
                            <button onClick={handlePreviewCleaner} disabled={cleaning} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors mt-auto">Analizar Candidatos</button>
                        ) : (
                            <div className="bg-slate-950 p-4 rounded-lg border border-red-500/30 animate-in fade-in">
                                <div className="text-xs text-slate-400 mb-2 flex justify-between items-center">
                                    <span>Se eliminarán <strong>{cleanerPreview.preview.length}</strong> videos.</span>
                                    <span className="text-emerald-400 font-bold bg-emerald-900/20 px-2 py-0.5 rounded">Ahorro: {cleanerPreview.stats.spaceReclaimed}</span>
                                </div>
                                <div className="max-h-32 overflow-y-auto mb-3 border border-slate-800 rounded bg-black/20">
                                    {cleanerPreview.preview.map(v => (
                                        <div key={v.id} className="text-[10px] text-slate-500 p-2 border-b border-slate-800/50 truncate flex justify-between">
                                            <span>{v.title}</span>
                                            <span className="text-slate-600">{v.views} views</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCleanerPreview(null)} className="flex-1 bg-slate-800 text-slate-300 text-xs font-bold py-2 rounded hover:text-white">Cancelar</button>
                                    <button onClick={handleExecuteCleaner} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded shadow-lg shadow-red-900/20">Confirmar Eliminación</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
