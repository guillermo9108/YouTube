
import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { useToast } from '../../context/ToastContext';
import { Network, Save, RefreshCw, Download, Folder, FileVideo, HardDrive, FilePlus } from 'lucide-react';

interface FtpFile {
    name: string;
    type: 'dir' | 'file';
    size: string;
    path: string;
}

export default function AdminFtp() {
    const toast = useToast();
    const [config, setConfig] = useState({
        host: '',
        port: 21,
        user: '',
        pass: '',
        rootPath: '/'
    });
    
    const [files, setFiles] = useState<FtpFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState('/');

    useEffect(() => {
        db.getSystemSettings().then(s => {
            if (s.ftpSettings) {
                setConfig({
                    host: s.ftpSettings.host || '',
                    port: s.ftpSettings.port || 21,
                    user: s.ftpSettings.user || '',
                    pass: s.ftpSettings.pass || '',
                    rootPath: s.ftpSettings.rootPath || '/'
                });
                setCurrentPath(s.ftpSettings.rootPath || '/');
            }
        });
    }, []);

    const handleSaveConfig = async () => {
        try {
            const currentSettings = await db.getSystemSettings();
            await db.updateSystemSettings({
                ...currentSettings,
                ftpSettings: config
            });
            toast.success("Configuración FTP guardada");
        } catch (e: any) {
            toast.error("Error al guardar: " + e.message);
        }
    };

    const listFiles = async (path: string = currentPath) => {
        setLoading(true);
        try {
            // Save temporary settings first to ensure backend uses latest
            await handleSaveConfig();
            
            const res = await db.listFtpFiles(path);
            setFiles(res);
            setCurrentPath(path);
        } catch (e: any) {
            toast.error("Error FTP: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (file: FtpFile) => {
        if (importing) return;
        setImporting(file.name);
        
        try {
            // Now this is instant (Index only)
            await db.importFtpFile(file.path);
            toast.success(`${file.name} añadido al índice. Ve a 'Librería' para escanear.`);
        } catch (e: any) {
            toast.error("Error al indexar: " + e.message);
        } finally {
            setImporting(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* Config Panel */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Network size={18}/> Conexión FTP</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Host</label>
                        <input type="text" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Puerto</label>
                            <input type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta Inicial</label>
                            <input type="text" value={config.rootPath} onChange={e => setConfig({...config, rootPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario</label>
                        <input type="text" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                        <input type="password" value={config.pass} onChange={e => setConfig({...config, pass: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"/>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleSaveConfig} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <Save size={16}/> Guardar
                        </button>
                        <button onClick={() => listFiles(config.rootPath)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-colors">
                            {loading ? <RefreshCw className="animate-spin" size={16}/> : <HardDrive size={16}/>} Conectar
                        </button>
                    </div>
                </div>
            </div>

            {/* File Browser */}
            <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[600px]">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div className="font-mono text-xs text-slate-400 break-all flex items-center gap-2">
                        <Folder size={14} className="text-amber-500"/> {currentPath}
                    </div>
                    <button onClick={() => listFiles(currentPath)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><RefreshCw size={14}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {files.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                            <Network size={48} className="mb-4"/>
                            <p>No hay archivos o no conectado.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {/* Parent Directory */}
                            {currentPath !== '/' && (
                                <div 
                                    onClick={() => listFiles(currentPath.split('/').slice(0,-1).join('/') || '/')}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 cursor-pointer text-slate-400"
                                >
                                    <Folder size={18} className="text-slate-500"/>
                                    <span className="text-sm">..</span>
                                </div>
                            )}

                            {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 group">
                                    <div 
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                        onClick={() => file.type === 'dir' ? listFiles(file.path) : null}
                                    >
                                        {file.type === 'dir' ? <Folder size={18} className="text-amber-500 shrink-0"/> : <FileVideo size={18} className="text-indigo-400 shrink-0"/>}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-slate-200 truncate font-medium">{file.name}</div>
                                            {file.type === 'file' && <div className="text-[10px] text-slate-500">{file.size}</div>}
                                        </div>
                                    </div>
                                    
                                    {file.type === 'file' && (
                                        <button 
                                            onClick={() => handleImport(file)}
                                            disabled={!!importing}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${importing === file.name ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-white hover:bg-indigo-600'}`}
                                        >
                                            {importing === file.name ? <RefreshCw size={12} className="animate-spin"/> : <FilePlus size={12}/>}
                                            {importing === file.name ? 'Indexando...' : 'Indexar'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
