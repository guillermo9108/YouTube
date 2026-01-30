
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/db';
import { useToast } from '../../../context/ToastContext';
import { 
    Download, Upload, Package, Folder, FileArchive, 
    AlertCircle, CheckCircle2, Loader2, Save, HardDrive, ShieldAlert,
    RefreshCw, Info, FileJson
} from 'lucide-react';
import { Video, SystemSettings } from '../../../types';

export default function AdminPortability() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    
    const [exportPath, setExportPath] = useState('/volumeUSB1/PAKETE/');
    const [restoreZipPath, setRestoreZipPath] = useState('/volumeUSB1/PAKETE/backup.zip');
    const [restoreVideoPath, setRestoreVideoPath] = useState('/volume1/videos/PAKETE/');

    const [stats, setStats] = useState({ totalVideos: 0, analyzed: false });

    useEffect(() => {
        db.getAllVideos().then(vids => {
            setStats({ totalVideos: vids.length, analyzed: true });
        });
    }, []);

    const loadJSZip = async () => {
        // @ts-ignore - Bypass URL import for TypeScript
        const module = await import('https://esm.sh/jszip@3.10.1');
        return module.default;
    };

    const handleExport = async () => {
        if (!confirm(`¿Iniciar exportación de ${stats.totalVideos} registros? Se preservará la estructura de sub-carpetas.`)) return;
        
        setLoading(true);
        setProgress(5);
        setProgressLabel('Iniciando motor de portabilidad...');

        try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();
            const [videos, settings] = await Promise.all([
                db.getAllVideos(),
                db.getSystemSettings()
            ]);

            const rootPath = settings.localLibraryPath || '';
            
            // 1. Crear JSON con rutas relativas y configuración de categorías
            const backupData = {
                version: "1.2",
                timestamp: Date.now(),
                system_metadata: {
                    categories: settings.categories || []
                },
                videos: videos.map(v => {
                    const realPath = (v as any).rawPath || v.videoUrl;
                    
                    // Calculamos la ruta relativa respecto a la raíz de la librería
                    // Ej: /mnt/media/Pelis/Movie.mp4 -> Pelis/Movie.mp4
                    let relativePath = realPath;
                    if (rootPath && realPath.startsWith(rootPath)) {
                        relativePath = realPath.substring(rootPath.length).replace(/^[\\/]+/, '');
                    } else {
                        // Fallback: solo el nombre si no coincide con la raíz
                        relativePath = realPath.split(/[\\/]/).pop();
                    }

                    return {
                        ...v,
                        relativePath: relativePath,
                        fileName: realPath.split(/[\\/]/).pop()
                    };
                })
            };
            zip.file("database.json", JSON.stringify(backupData, null, 2));

            // 2. Añadir miniaturas
            setProgress(20);
            setProgressLabel('Empaquetando miniaturas...');
            const thumbFolder = zip.folder("thumbnails");
            
            let count = 0;
            for (const v of videos) {
                if (v.thumbnailUrl && v.thumbnailUrl.includes('thumbnails/')) {
                    try {
                        const resp = await fetch(v.thumbnailUrl);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            const thumbName = v.thumbnailUrl.split('/').pop() || `${v.id}.jpg`;
                            thumbFolder.file(thumbName, blob);
                        }
                    } catch (e) { console.warn("Fallo al incluir thumb:", v.title); }
                }
                count++;
                if (count % 10 === 0) setProgress(20 + Math.floor((count / videos.length) * 50));
            }

            // 3. Generar ZIP
            setProgress(75);
            setProgressLabel('Comprimiendo paquete (ZIP)...');
            const content = await zip.generateAsync({ type: "blob" }, (metadata: any) => {
                setProgress(75 + Math.floor(metadata.percent * 0.20));
            });

            // 4. Enviar al Backend
            setProgress(95);
            setProgressLabel('Guardando en destino final...');
            const fd = new FormData();
            fd.append('backup', content, 'backup.zip');
            fd.append('path', exportPath);

            const res = await db.request<any>('action=port_save_backup', {
                method: 'POST',
                body: fd
            });

            toast.success("Backup jerárquico guardado en: " + res.full_path);
        } catch (e: any) {
            toast.error("Error en exportación: " + e.message);
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

        if (!confirm("Se restaurarán videos y se crearán categorías faltantes. Las sub-carpetas serán respetadas. ¿Continuar?")) return;

        setLoading(true);
        setProgressLabel('Restaurando categorías y mapeando sub-carpetas...');
        try {
            const res = await db.request<any>('action=port_restore_backup', {
                method: 'POST',
                body: JSON.stringify({
                    zipPath: restoreZipPath,
                    videoLibraryPath: restoreVideoPath
                })
            });
            toast.success(`Éxito: ${res.imported} videos mapeados y ${res.categories_synced || 0} categorías sincronizadas.`);
            db.setHomeDirty();
        } catch (e: any) {
            toast.error("Fallo en restauración: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-20 px-2">
            
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 opacity-20 rotate-12"><Package size={200}/></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Portabilidad Jerárquica</h2>
                    <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest max-w-xl">
                        Mueve tu catálogo manteniendo la estructura de sub-carpetas y la configuración de categorías.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* EXPORTAR */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><Download size={24}/></div>
                        <h3 className="font-black text-white uppercase text-lg tracking-tighter">Generar Backup</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Carpeta de Destino (.zip)</label>
                            <div className="relative mt-1">
                                <Folder size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={exportPath} onChange={e => setExportPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-white">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Videos en catálogo</span>
                                <span className="text-xs font-bold">{stats.totalVideos}</span>
                            </div>
                            <div className="flex items-center justify-between text-indigo-400">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Incluye Categorías</span>
                                <CheckCircle2 size={14}/>
                            </div>
                        </div>

                        <button 
                            onClick={handleExport} disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                            Exportar Todo
                        </button>
                    </div>
                </div>

                {/* RESTAURAR */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Upload size={24}/></div>
                        <h3 className="font-black text-white uppercase text-lg tracking-tighter">Restaurar Paquete</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ruta del archivo Backup (.zip)</label>
                            <div className="relative mt-1">
                                <FileArchive size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={restoreZipPath} onChange={e => setRestoreZipPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Carpeta de Librería</label>
                            <div className="relative mt-1">
                                <HardDrive size={16} className="absolute left-4 top-3.5 text-slate-500"/>
                                <input 
                                    type="text" value={restoreVideoPath} onChange={e => setRestoreVideoPath(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                    placeholder="/volume1/videos/..."
                                />
                            </div>
                            <p className="text-[9px] text-amber-500 font-bold uppercase mt-2 px-1">Se respetarán las subcarpetas relativas</p>
                        </div>

                        <button 
                            onClick={handleRestore} disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>}
                            Ejecutar Restauración
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
