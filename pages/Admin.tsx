



import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock, Settings, Save, Play, Pause, ExternalLink, Key, Loader2, Youtube, Trash2, Brush, Tag, FolderSearch, Terminal } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<number>(10);
  
  // Maintenance State
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [processResult, setProcessResult] = useState('');
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'CONFIG' | 'CLEANER' | 'CATEGORIES' | 'LIBRARY'>('USERS');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Cleaner State
  const [cleanerCategory, setCleanerCategory] = useState('ALL');
  const [cleanerPercent, setCleanerPercent] = useState(20);
  const [cleanerSafeDays, setCleanerSafeDays] = useState(7); // Default 7 days safe harbor
  const [cleanerPreview, setCleanerPreview] = useState<Video[]>([]);
  const [cleanerStats, setCleanerStats] = useState({ totalVideos: 0, videosToDelete: 0, spaceReclaimed: '0 MB' });
  const [loadingCleaner, setLoadingCleaner] = useState(false);

  // Library State
  const [localPath, setLocalPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);

  // Category State
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    loadData();
    db.getSystemSettings().then(s => {
        setSettings(s);
        if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
    });
  }, []);

  const loadData = async () => {
    setLoadingUsers(true);
    try {
        const u = await db.getAllUsers();
        setUsers(u || []);
        const r = await db.getRequests();
        setRequests(r || []);
    } catch(e) {
        console.error("Admin Load Error", e);
    } finally {
        setLoadingUsers(false);
    }
  };

  const handleAddCredit = async (targetId: string, username: string) => {
    if (!currentUser) return;
    if (confirm(`¿Añadir ${amount} Saldo a ${username}?`)) {
      try {
        await db.adminAddBalance(currentUser.id, targetId, amount);
        loadData();
        alert(`Se añadieron ${amount} Saldo.`);
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleRepairDb = async () => {
    if (confirm("Esto intentará crear las tablas faltantes. ¿Continuar?")) {
      setRepairing(true);
      try {
         await db.adminRepairDb();
         alert("Esquema de base de datos actualizado.");
      } catch (e: any) {
         alert("Error en reparación: " + e.message);
      } finally {
         setRepairing(false);
      }
    }
  };

  const handleCleanup = async () => {
      if(confirm("Esto eliminará videos de la base de datos que no tengan archivos. ¿Continuar?")) {
          try {
              const res = await db.adminCleanupVideos();
              alert(`Limpieza completa. Eliminados ${res.deleted} videos rotos.`);
          } catch(e: any) {
              alert("Error de limpieza: " + e.message);
          }
      }
  };

  const triggerDownload = async () => {
     if(confirm("¿Forzar procesamiento de cola? El servidor intentará descargar los videos pendientes.")) {
       setProcessingQueue(true);
       setProcessResult('');
       try {
         const res = await db.triggerQueueProcessing();
         setProcessResult(res.message);
         loadData();
         setTimeout(() => setProcessingQueue(false), 3000);
       } catch (e: any) {
         alert("Error al activar: " + e.message);
         setProcessingQueue(false);
       }
     }
  };

  const saveSettings = async () => {
      if (!settings) return;
      try {
          // If in Library tab, save path too
          if (activeTab === 'LIBRARY') {
              const updated = { ...settings, localLibraryPath: localPath.trim() };
              await db.updateSystemSettings(updated);
              setSettings(updated);
          } else {
              await db.updateSystemSettings(settings);
          }
          alert("Configuración guardada!");
      } catch (e) { alert("Error al guardar"); }
  };

  const handleScanLibrary = async () => {
      if (!localPath.trim()) return;
      setScanning(true);
      setScanLog(['Iniciando escaneo en tiempo real...']);
      
      const cleanPath = localPath.trim();
      setLocalPath(cleanPath);

      // Save path first
      if (settings) {
          const updated = { ...settings, localLibraryPath: cleanPath };
          db.updateSystemSettings(updated);
      }

      try {
          // Use new streaming method
          await db.scanLocalLibraryStream(cleanPath, (msg, type) => {
               setScanLog(prev => {
                   // Keep log size manageable (last 100 lines)
                   const newLog = [...prev, type === 'log' ? msg : `[${type.toUpperCase()}] ${msg}`];
                   if (newLog.length > 100) return newLog.slice(newLog.length - 100);
                   return newLog;
               });
          });
      } catch (e: any) {
          setScanLog(prev => [...prev, `ERROR: ${e.message}`]);
      } finally {
          setScanning(false);
      }
  };

  const addCustomCategory = () => {
      if (!settings || !newCatName.trim()) return;
      const cleanName = newCatName.trim().toUpperCase().replace(/ /g, '_');
      
      const current = settings.customCategories || [];
      if (current.includes(cleanName) || Object.values(VideoCategory).includes(cleanName as any)) {
          alert("La categoría ya existe");
          return;
      }

      const updated = {
          ...settings,
          customCategories: [...current, cleanName]
      };
      setSettings(updated);
      setNewCatName('');
  };

  const removeCustomCategory = (cat: string) => {
      if (!settings || !settings.customCategories) return;
      if (!confirm(`¿Eliminar categoría ${cat}? Esto no borrará los videos, pero se mostrarán como texto estándar.`)) return;
      
      const updated = {
          ...settings,
          customCategories: settings.customCategories.filter(c => c !== cat)
      };
      setSettings(updated);
  };

  const previewCleaner = async () => {
      setLoadingCleaner(true);
      try {
          const res = await db.getSmartCleanerPreview(cleanerCategory, cleanerPercent, cleanerSafeDays);
          setCleanerPreview(res.preview);
          setCleanerStats(res.stats);
      } finally { setLoadingCleaner(false); }
  };

  const executeCleaner = async () => {
      if (!confirm(`ADVERTENCIA: Esto eliminará permanentemente ${cleanerStats.videosToDelete} videos. No se puede deshacer.\n\nEscribe 'DELETE' para confirmar (en tu mente, solo pulsa OK).`)) return;
      
      try {
          const ids = cleanerPreview.map(v => v.id);
          const res = await db.executeSmartCleaner(ids);
          alert(`Eliminados ${res.deleted} videos exitosamente.`);
          setCleanerPreview([]);
          setCleanerStats({ totalVideos: 0, videosToDelete: 0, spaceReclaimed: '0 MB' });
      } catch (e: any) {
          alert("Error ejecutando limpiador: " + e.message);
      }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  // Categories list union
  const allCategories = settings ? [...Object.values(VideoCategory), ...(settings.customCategories || [])] : Object.values(VideoCategory);

  return (
    <div className="space-y-6 pb-24 relative">
      
      {/* Processing Modal */}
      {processingQueue && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full">
                 {processResult ? (
                     <>
                        <div className="text-emerald-400 font-bold mb-4 text-xl">¡Completado!</div>
                        <p className="text-slate-300 mb-6">{processResult}</p>
                     </>
                 ) : (
                     <>
                        <Loader2 size={48} className="text-indigo-500 animate-spin mx-auto mb-6" />
                        <h3 className="text-xl font-bold text-white mb-2">Procesando en Servidor</h3>
                        <p className="text-slate-400 mb-4 text-sm">Descargando videos...</p>
                        <p className="text-xs text-slate-500">Esto puede tomar un minuto. No cierres.</p>
                     </>
                 )}
             </div>
         </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Panel de Administración</h2>
          <p className="text-slate-400 text-sm">Gestión del Sistema</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
           <button onClick={() => setActiveTab('USERS')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Usuarios</button>
           <button onClick={() => setActiveTab('CONFIG')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CONFIG' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Config</button>
           <button onClick={() => setActiveTab('CATEGORIES')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Cat. y Precios</button>
           <button onClick={() => setActiveTab('LIBRARY')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'LIBRARY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Importar Librería</button>
           <button onClick={() => setActiveTab('CLEANER')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CLEANER' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}>Limpiador</button>
        </div>
      </div>

      {activeTab === 'LIBRARY' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escaneo de Librería Local</h3>
                  <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80 leading-relaxed">
                      Esta herramienta escanea recursivamente una carpeta en tu NAS/Servidor en busca de archivos de video. Hará lo siguiente:
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                          <li>Indexar videos sin moverlos (ahorra espacio/tiempo).</li>
                          <li>Detectar inteligentemente <strong>Series</strong> (S01E01), <strong>Novelas</strong> (Capitulo 5), y <strong>Películas</strong>.</li>
                          <li>Auto-importar portadas locales (jpg/png) si coinciden con el nombre del video.</li>
                          <li>Habilitar streaming para archivos fuera de la raíz web.</li>
                      </ul>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Directorio del Servidor</label>
                      <input 
                        type="text" 
                        value={localPath}
                        onChange={e => setLocalPath(e.target.value)}
                        placeholder="/volume1/video/movies"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Ejemplo: <code>/var/www/html/videos</code> o <code>/volume1/video</code></p>
                  </div>

                  <button 
                    onClick={handleScanLibrary}
                    disabled={scanning || !localPath}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                      {scanning ? <Loader2 className="animate-spin" size={20}/> : <FolderSearch size={20}/>}
                      {scanning ? 'Escaneando e Importando...' : 'Iniciar Escaneo'}
                  </button>
              </div>

              <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                  <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-800 pb-2">
                      <Terminal size={14}/> Logs de Escaneo
                  </div>
                  {scanLog.length === 0 ? (
                      <div className="text-slate-600 italic">Esperando para escanear...</div>
                  ) : (
                      scanLog.map((line, i) => (
                          <div key={i} className={`mb-1 ${line.includes('ERROR') ? 'text-red-400' : (line.includes('Imported') ? 'text-emerald-400' : 'text-slate-300')}`}>
                              <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                              {line}
                          </div>
                      ))
                  )}
                  {scanning && <div className="animate-pulse">_</div>}
              </div>
          </div>
      )}

      {activeTab === 'CATEGORIES' && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Price Config */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white flex items-center gap-2"><Tag size={18}/> Precios Base Globales</h3>
                      <button onClick={saveSettings} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                          <Save size={14}/> Guardar
                      </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">Estos precios se sugerirán a los usuarios cuando suban un video en estas categorías. Los usuarios pueden cambiarlos.</p>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {allCategories.map(cat => {
                          const isCustom = settings.customCategories?.includes(cat);
                          return (
                            <div key={cat} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300 uppercase">{cat.replace('_', ' ')}</span>
                                    {isCustom && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">PERSONALIZADO</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Defecto:</span>
                                        <input 
                                            type="number" 
                                            min="0"
                                            className="w-16 bg-slate-900 border border-slate-700 rounded text-center text-amber-400 font-bold py-1 focus:border-indigo-500 outline-none text-sm"
                                            value={settings.categoryPrices?.[cat] ?? 1}
                                            onChange={(e) => {
                                                const prices = { ...settings.categoryPrices, [cat]: parseInt(e.target.value) || 0 };
                                                setSettings({ ...settings, categoryPrices: prices });
                                            }}
                                        />
                                    </div>
                                    {isCustom && (
                                        <button onClick={() => removeCustomCategory(cat)} className="text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>
                                    )}
                                </div>
                            </div>
                          );
                      })}
                  </div>
              </div>

              {/* Add New Category */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit">
                  <h3 className="font-bold text-white flex items-center gap-2 mb-4"><PlusCircle size={18}/> Añadir Categoría Personalizada</h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 uppercase font-bold text-sm"
                        placeholder="NUEVA_CATEGORIA"
                      />
                      <button onClick={addCustomCategory} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Añadir</button>
                  </div>
                  <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-lg">
                      <h4 className="text-xs font-bold text-indigo-300 mb-1">Cómo funciona</h4>
                      <p className="text-xs text-indigo-200/70 leading-relaxed">
                          Añadir una categoría aquí la hace disponible en el menú desplegable de subida para todos los usuarios.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CLEANER' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                  <h3 className="font-bold text-white flex items-center gap-2"><Brush size={18} /> Configuración del Limpiador</h3>
                  <p className="text-xs text-slate-400">
                      El algoritmo calcula una puntuación para cada video basada en Vistas, Likes, Dislikes y Antigüedad.
                      Los videos con menor puntuación serán seleccionados para eliminación.
                  </p>
                  
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoría Objetivo</label>
                      <select value={cleanerCategory} onChange={e => setCleanerCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                          <option value="ALL">Todas las Categorías</option>
                          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Porcentaje a Eliminar: {cleanerPercent}%</label>
                      <input 
                        type="range" 
                        min="5" 
                        max="50" 
                        value={cleanerPercent} 
                        onChange={e => setCleanerPercent(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Selecciona el {cleanerPercent}% inferior de videos.</p>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Antigüedad Mínima: {cleanerSafeDays} Días</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="30" 
                        value={cleanerSafeDays} 
                        onChange={e => setCleanerSafeDays(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Videos más nuevos de {cleanerSafeDays} días NO serán eliminados.</p>
                  </div>

                  <button onClick={previewCleaner} disabled={loadingCleaner} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {loadingCleaner ? <Loader2 className="animate-spin"/> : <Search size={18}/>} Previsualizar Candidatos
                  </button>
              </div>

              <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col h-[600px]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white">Candidatos para Eliminación</h3>
                      {cleanerStats.videosToDelete > 0 && (
                          <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded font-mono">
                              {cleanerStats.videosToDelete} Videos (~{cleanerStats.spaceReclaimed})
                          </span>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/50">
                      {cleanerPreview.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                              Ejecuta la previsualización para ver videos aquí.
                          </div>
                      ) : (
                          <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-slate-400 sticky top-0">
                                  <tr>
                                      <th className="p-3">Video</th>
                                      <th className="p-3">Vistas</th>
                                      <th className="p-3">Likes</th>
                                      <th className="p-3">Dislikes</th>
                                      <th className="p-3">Edad (Días)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                  {cleanerPreview.map(v => (
                                      <tr key={v.id} className="hover:bg-slate-900/50">
                                          <td className="p-3 text-slate-300 truncate max-w-[200px]">{v.title}</td>
                                          <td className="p-3 text-slate-400">{v.views}</td>
                                          <td className="p-3 text-emerald-400">{v.likes}</td>
                                          <td className="p-3 text-red-400">{v.dislikes}</td>
                                          <td className="p-3 text-slate-400">{Math.floor((Date.now() - v.createdAt) / 86400000)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800">
                      <button 
                        onClick={executeCleaner}
                        disabled={cleanerPreview.length === 0}
                        className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                      >
                          <Trash2 size={18}/> Confirmar y Eliminar Permanentemente
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CONFIG' && settings && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} /> Configuración de Auto-Descarga</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Inicio</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings({...settings, downloadStartTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Fin</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings({...settings, downloadEndTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tamaño del Lote (Videos por ejecución)</label>
                    <input type="number" min="1" max="50" value={settings.batchSize} onChange={e => setSettings({...settings, batchSize: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duración Máx (Seg)</label>
                        <input type="number" value={settings.maxDuration} onChange={e => setSettings({...settings, maxDuration: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Altura Máx (px)</label>
                        <input type="number" placeholder="1080" value={settings.maxResolution} onChange={e => setSettings({...settings, maxResolution: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <button onClick={saveSettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    <Save size={18} /> Guardar Configuración
                </button>
             </div>

             <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                         <h3 className="font-bold text-white flex items-center gap-2"><Key size={18} /> API Keys del Servidor</h3>
                         <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Almacenado Seguro</span>
                    </div>
                    <p className="text-xs text-slate-500">Proporciona claves para permitir la búsqueda/descarga de contenido.</p>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pexels Key</label>
                            <a href="https://www.pexels.com/api/new/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Obtener Key</a>
                        </div>
                        <input type="text" value={settings.pexelsKey} onChange={e => setSettings({...settings, pexelsKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Tu API Key"/>
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pixabay Key</label>
                            <a href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Obtener Key</a>
                        </div>
                        <input type="text" value={settings.pixabayKey} onChange={e => setSettings({...settings, pixabayKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Tu API Key"/>
                    </div>
                </div>
                
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Shield size={18} /> Mantenimiento</h3>
                     <button onClick={handleCleanup} className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-red-600/20">
                        <Trash2 size={18}/> Escanear y Reparar Videos Rotos
                    </button>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} /> Integración YouTube (Avanzado)</h3>
                    <p className="text-xs text-slate-500">Requiere <code>yt-dlp</code> binario en el servidor.</p>

                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.enableYoutube} onChange={e => setSettings({...settings, enableYoutube: e.target.checked})} className="sr-only peer"/>
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-300">Habilitar YouTube</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta binario yt-dlp</label>
                        <input type="text" value={settings.ytDlpPath} onChange={e => setSettings({...settings, ytDlpPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="./yt-dlp"/>
                        <p className="text-[10px] text-slate-500 mt-1">Defecto: <code>./yt-dlp</code> (Relativo a carpeta api/)</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18} /> Controles de Cola</h3>
                    <div className="flex gap-2">
                        <button 
                           onClick={() => { setSettings({...settings, isQueuePaused: !settings.isQueuePaused}); saveSettings(); }}
                           className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${settings.isQueuePaused ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                        >
                            {settings.isQueuePaused ? <><Play size={18}/> Reanudar Cola</> : <><Pause size={18}/> Pausar Cola</>}
                        </button>
                        <button onClick={triggerDownload} className="flex-1 bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                            <DownloadCloud size={18}/> Forzar Ejecución
                        </button>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 bg-slate-950 p-2 rounded">
                        <span>Estado: <strong>{settings.isQueuePaused ? 'PAUSADO' : 'ACTIVO'}</strong></span>
                        <span>{requests.filter(r => r.status === 'PENDING').length} Pendientes</span>
                    </div>
                </div>
             </div>
         </div>
      )}

      {activeTab === 'USERS' && (
        <>
            <div className="flex justify-end">
                <button onClick={handleRepairDb} disabled={repairing} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait">
                    {repairing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} 
                    {repairing ? 'Reparando...' : 'Reparar DB'}
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex-1 relative">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar usuarios..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                </div>
                <div className="w-full md:w-48 flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Cantidad Saldo:</span>
                    <input 
                    type="number"
                    value={amount}
                    onChange={e => setAmount(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-center font-bold text-lg"
                    />
                </div>
            </div>

            <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                    <tr>
                    <th className="p-4">Usuario</th>
                    <th className="p-4 text-right">Saldo</th>
                    <th className="p-4 text-center">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loadingUsers ? (
                         <tr><td colSpan={3} className="p-10 text-center text-slate-500"><Loader2 className="animate-spin mx-auto"/> Cargando usuarios...</td></tr>
                    ) : (
                        filteredUsers.length === 0 ? (
                            <tr><td colSpan={3} className="p-10 text-center text-slate-500">No se encontraron usuarios.</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                            <tr key={u.id}>
                                <td className="p-4 font-bold text-slate-200 flex items-center gap-2"><UserIcon size={16}/> {u.username} <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-500">{u.role}</span></td>
                                <td className="p-4 text-right font-mono text-indigo-300">{u.balance}</td>
                                <td className="p-4 flex justify-center">
                                    <button onClick={() => handleAddCredit(u.id, u.username)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                                        <PlusCircle size={16} /> Añadir {amount}
                                    </button>
                                </td>
                            </tr>
                            ))
                        )
                    )}
                </tbody>
                </table>
            </div>
            
            {/* Mobile List View */}
            <div className="md:hidden space-y-4">
                {loadingUsers && <div className="text-center p-4"><Loader2 className="animate-spin mx-auto text-indigo-500"/></div>}
                {!loadingUsers && filteredUsers.map(u => (
                     <div key={u.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                         <div className="flex justify-between items-center mb-3">
                             <span className="font-bold text-white">{u.username}</span>
                             <span className="font-mono text-indigo-400">{u.balance} Saldo</span>
                         </div>
                         <button onClick={() => handleAddCredit(u.id, u.username)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                             <PlusCircle size={16} /> Añadir {amount} Saldo
                         </button>
                     </div>
                ))}
            </div>
        </>
      )}

    </div>
  );
}