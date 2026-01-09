
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { useToast } from '../../../context/ToastContext';
import { 
    Download, Upload, Package, Folder, FileArchive, 
    AlertCircle, CheckCircle2, Loader2, Save, HardDrive, ShieldAlert,
    RefreshCw, Info, FileJson
} from 'lucide-react';
import { Video } from '../../../types';

export default function AdminPortability() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    
    const [exportPath, setExportPath] = useState('/volumeUSB1/PAKETE/');
    const [restoreZipPath, setRestoreZipPath] = useState('/volumeUSB1/PAKETE/backup.zip');
    const [restoreVideoPath, setRestoreVideoPath] = useState('/volume1/videos/PAKETE/');

    const [stats, setStats] = useState({ totalVideos: 0, totalSize: '0 MB' });

    useEffect(() => {
        db.getAllVideos().then(vids => {
            setStats({ totalVideos: vids.length, totalSize: 'Analizado' });
        });
    }, []);

    const loadJSZip = async () => {
        // @ts-ignore - Bypass URL import for TypeScript
        const module = await import('https://esm.sh/jszip@3.10.1');
        return module.default;
    };

    const handleExport = async () => {
        if (!confirm(`¿Iniciar exportación de ${stats.totalVideos} registros a ${exportPath}?`)) return;
        
        setLoading(true);
        setProgress(5);
        setProgressLabel('Preparando motor de compresión...');

        try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();
            const videos = await db.getAllVideos();
            
            // 1. Crear JSON con rutas relativas reales
            const backupData = {
                version: "1.1",
                timestamp: Date.now(),
                videos: videos.map(v => {
                    // Importante: Usamos rawPath si existe, si no extraemos de videoUrl
                    // rawPath fue inyectado por el backend actualizado para admins.
                    const realPath = (v as any).rawPath || v.videoUrl;
                    
                    // Extraer nombre de archivo de forma robusta (soporta / y \)
                    const fileName = realPath.split(/[\\/]/).pop();

                    return {
                        ...v,
                        fileName: fileName,
                        originalPath: realPath
                    };
                })
            };
            zip.file("database.json", JSON.stringify(backupData, null, 2));

            // 2. Añadir miniaturas
            setProgress(20);
            setProgressLabel('Recolectando miniaturas...');
            const thumbFolder = zip.folder("thumbnails");
            
            let count = 0;
            for (const v of videos) {
                if (v.thumbnailUrl && v.thumbnailUrl.includes('thumbnails/')) {
                    try {
                        const resp = await fetch(v.thumbnailUrl);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            // El nombre de la miniatura suele ser el ID del video .jpg
                            const thumbName = v.thumbnailUrl.split('/').pop() || `${v.id}.jpg`;
                            thumbFolder.file(thumbName, blob);
                        }
                    } catch (e) { console.warn("Fallo al incluir thumb:", v.title); }
                }
                count++;
                if (count % 5 === 0) setProgress(20 + Math.floor((count / videos.length) * 50));
            }

            // 3. Generar ZIP
            setProgress(80);
            setProgressLabel('Comprimiendo paquete...');
            const content = await zip.generateAsync({ type: "blob" }, (metadata: any) => {
                setProgress(80 + Math.floor(metadata.percent * 0.15));
            });

            // 4. Enviar al Backend
            setProgress(95);
            setProgressLabel('Guardando archivo en destino...');
            const fd = new FormData();
            fd.append('backup', content, 'backup.zip');
            fd.append('path', exportPath);

            const res = await db.request<any>('action=port_save_backup', {
                method: 'POST',
                body: fd
            });

            toast.success("Paquete guardado en: " + res.full_path);
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    const handleRestore = async () => {
        if (!restoreZipPath.trim() || !restoreVideoPath.trim()) {
            toast.warning("Rutas incompletas");
            return;
        }

        if (!confirm("Se importarán los registros. Las rutas de video se re-mapearán a la carpeta local indicada. ¿Continuar?")) return;

        setLoading(true);
        setProgressLabel('Sincronizando catálogo con el nuevo almacenamiento...');
        try {
            const res = await db.request<any>('action=port_restore_backup', {
                method: 'POST',
                body: JSON.stringify({
                    zipPath: restoreZipPath,
                    videoLibraryPath: restoreVideoPath
                })
            });
            toast.success(`Restauración finalizada. ${res.imported} videos mapeados.`);
            db.setHomeDirty();
        } catch (e: any) {
            toast.error("Error en restauración: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20 px-2">
            
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 opacity-20 rotate-12"><Package size={200}/></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Gestor de Portabilidad Pro</h2>
                    <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest max-w-xl">
                        Mueve tu catálogo completo entre servidores NAS manteniendo títulos, precios y miniaturas.
                    </p>
                </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-2xl flex gap-4 items-start">
                <ShieldAlert className="text-amber-500 shrink-0" size={24}/>
                <div className="text-[11px] text-amber-200/80 leading-relaxed uppercase font-bold">
                    <p className="text-amber-500 font-black mb-1">Nota sobre Re-mapeo</p>
                    Al restaurar, el sistema buscará el nombre original del archivo (ej: video1.mp4) dentro de la "Nueva Ruta" que especifiques abajo. Asegúrate de haber copiado físicamente tus videos a esa carpeta antes de restaurar.
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* EXPORTAR */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><Download size={24}/></div>
                        <h3 className="font-black text-white uppercase text-lg tracking-tighter">Exportar Catálogo</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ruta Destino Backup (Ej: USB)</label>
                            <div className="relative mt-1">
                                <Folder size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={exportPath} onChange={e => setExportPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <FileJson size={14} className="text-amber-500"/>
                                    <span className="text-xs font-bold">{stats.totalVideos} Videos a Exportar</span>
                                </div>
                                <div className="text-[9px] text-slate-600 font-black uppercase">Metadatos OK</div>
                            </div>
                        </div>

                        <button 
                            onClick={handleExport} disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                            Generar Paquete .ZIP
                        </button>
                    </div>
                </div>

                {/* RESTAURAR */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Upload size={24}/></div>
                        <h3 className="font-black text-white uppercase text-lg tracking-tighter">Restaurar en Servidor</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Archivo ZIP de Origen</label>
                            <div className="relative mt-1">
                                <FileArchive size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={restoreZipPath} onChange={e => setRestoreZipPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Ruta de los Archivos (.mp4)</label>
                            <div className="relative mt-1">
                                <HardDrive size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={restoreVideoPath} onChange={e => setRestoreVideoPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                    placeholder="/volume1/videos/..."
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleRestore} disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>}
                            Ejecutar Migración
                        </button>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="fixed inset-x-0 bottom-24 flex justify-center px-4 animate-in slide-in-from-bottom-10">
                    <div className="w-full max-w-md bg-slate-900 border border-indigo-500/50 p-6 rounded-[32px] shadow-2xl backdrop-blur-xl">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{progressLabel}</span>
                            <span className="text-xs font-black text-indigo-400">{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
