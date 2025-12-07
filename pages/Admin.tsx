
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video, FtpSettings, MarketplaceItem, BalanceRequest, SmartCleanerResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock, Settings, Save, Play, Pause, ExternalLink, Key, Loader2, Youtube, Trash2, Brush, Tag, FolderSearch, Terminal, AlertTriangle, Network, ShoppingBag, CheckCircle, XCircle, Percent, Monitor, DollarSign, Wallet, Store, Truck, Wrench, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { generateThumbnail } from '../utils/videoGenerator';
import { useToast } from '../context/ToastContext';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'USERS' | 'FINANCE' | 'MARKET' | 'CONFIG' | 'LIBRARY' | 'MAINTENANCE' | 'ANALYTICS'>('USERS');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Data States
  const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
  const [marketItems, setMarketItems] = useState<MarketplaceItem[]>([]);
  
  // Library State
  const [localPath, setLocalPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);
  
  // Client Processor
  const [processingClient, setProcessingClient] = useState(false);
  const [clientProgress, setClientProgress] = useState({ current: 0, total: 0 });
  const stopClientRef = useRef(false);

  // Forms
  const [addBalanceAmount, setAddBalanceAmount] = useState('');
  const [addBalanceTarget, setAddBalanceTarget] = useState('');

  // Maintenance State
  const [cleanerPreview, setCleanerPreview] = useState<SmartCleanerResult | null>(null);
  const [cleanerPercent, setCleanerPercent] = useState(10);
  const [cleanerCategory, setCleanerCategory] = useState('ALL');
  const [cleanerDays, setCleanerDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);

  // Simulator State
  const [simUsers, setSimUsers] = useState(100);
  const [simVidFreq, setSimVidFreq] = useState(2); // Videos bought per user/month
  const [simMktFreq, setSimMktFreq] = useState(0.5); // Items bought per user/month
  const [simAvgVidPrice, setSimAvgVidPrice] = useState(5);
  const [simAvgMktPrice, setSimAvgMktPrice] = useState(25);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
      // Set default sim users to actual count when loaded
      if (users.length > 0 && simUsers === 100) {
          setSimUsers(users.length);
      }
  }, [users]);

  const loadData = () => {
      if (activeTab === 'USERS') {
          db.getAllUsers().then(setUsers);
      } else if (activeTab === 'FINANCE') {
          db.getBalanceRequests().then(setBalanceRequests);
      } else if (activeTab === 'MARKET') {
          db.adminGetMarketplaceItems().then(setMarketItems);
      } else if (activeTab === 'CONFIG' || activeTab === 'LIBRARY' || activeTab === 'ANALYTICS') {
          db.getSystemSettings().then(s => {
              setSettings(s);
              if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
          });
      }
  };

  const handleAddBalance = async () => {
      if (!currentUser || !addBalanceTarget || !addBalanceAmount) return;
      try {
          await db.adminAddBalance(currentUser.id, addBalanceTarget, parseFloat(addBalanceAmount));
          toast.success("Saldo agregado correctamente");
          setAddBalanceAmount('');
          setAddBalanceTarget('');
          loadData();
      } catch (e: any) {
          toast.error("Error: " + e.message);
      }
  };

  const handleHandleRequest = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
      if (!currentUser) return;
      try {
          await db.handleBalanceRequest(currentUser.id, reqId, action);
          toast.success(`Solicitud ${action === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`);
          loadData();
      } catch (e: any) {
          toast.error("Error: " + e.message);
      }
  };

  const handleDeleteListing = async (itemId: string) => {
      if(!confirm("¿Estás seguro de eliminar este artículo?")) return;
      try {
          await db.adminDeleteListing(itemId);
          toast.success("Artículo eliminado");
          loadData();
      } catch(e: any) {
          toast.error("Error: " + e.message);
      }
  };

  const handleSaveConfig = async () => {
      if (!settings) return;
      try {
          await db.updateSystemSettings({...settings, localLibraryPath: localPath});
          toast.success("Configuración guardada");
      } catch(e: any) {
          toast.error("Error al guardar");
      }
  };

  const handleScanLibrary = async () => {
      if (!localPath.trim()) return;
      setIsScanning(true);
      setScanLog(['Starting Server Indexing...']);
      try {
          const res = await db.scanLocalLibrary(localPath);
          if (res.success) {
              setScanLog(prev => [...prev, `Found ${res.totalFound} files.`, `New imported: ${res.newToImport}`]);
              if (res.newToImport > 0) setScanLog(prev => [...prev, "Use 'Process Metadata' to analyze them."]);
          } else {
              setScanLog(prev => [...prev, `Error: ${res.errors || 'Unknown'}`]);
          }
      } catch (e: any) {
          setScanLog(prev => [...prev, `Critical Error: ${e.message}`]);
      } finally {
          setIsScanning(false);
      }
  };

  const startClientProcessor = async () => {
      setProcessingClient(true);
      stopClientRef.current = false;
      setScanLog(prev => [...prev, "Fetching unprocessed videos..."]);
      
      try {
          const pending = await db.getUnprocessedVideos();
          
          if (pending.length === 0) {
              setScanLog(prev => [...prev, "No pending videos found."]);
              setProcessingClient(false);
              return;
          }

          setClientProgress({ current: 0, total: pending.length });
          
          for (let i = 0; i < pending.length; i++) {
              if (stopClientRef.current) break;
              
              const v = pending[i];
              setScanLog(prev => [...prev, `Processing (${i+1}/${pending.length}): ${v.title}`]);
              
              try {
                  const { thumbnail, duration } = await generateThumbnail(v.videoUrl);

                  if (duration > 0 || thumbnail) {
                      // If we got partial data (e.g. video loaded but black thumb), we still update
                      // to avoid stuck loop. 'duration || 0' prevents sending NaN.
                      await db.updateVideoMetadata(v.id, duration || 0, thumbnail);
                      setScanLog(prev => [...prev, ` > Updated: ${Math.floor(duration || 0)}s`]);
                  } else {
                      // Fallback: Force update as "Processed but broken" to unblock queue
                      await db.updateVideoMetadata(v.id, 0, null);
                      setScanLog(prev => [...prev, " > Failed to load video (Skipped)"]);
                  }

              } catch (err: any) {
                  // Fallback: Force update to unblock queue
                  await db.updateVideoMetadata(v.id, 0, null);
                  setScanLog(prev => [...prev, ` > Error: ${err.message} (Skipped)`]);
              }

              setClientProgress({ current: i + 1, total: pending.length });
              // Increased delay to 1000ms to allow connection cleanup on NAS
              await new Promise(r => setTimeout(r, 1000)); 
          }
          
          setScanLog(prev => [...prev, "Batch complete."]);

      } catch (e: any) {
          setScanLog(prev => [...prev, `Fatal: ${e.message}`]);
      } finally {
          setProcessingClient(false);
      }
  };

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

  // --- SIMULATION CALCULATIONS ---
  const calculateProjection = () => {
      const vidComm = settings?.videoCommission || 20;
      const mktComm = settings?.marketCommission || 25;

      const monthlyVidRevenue = simUsers * simVidFreq * simAvgVidPrice;
      const monthlyMktRevenue = simUsers * simMktFreq * simAvgMktPrice;
      
      const adminVidProfit = monthlyVidRevenue * (vidComm / 100);
      const adminMktProfit = monthlyMktRevenue * (mktComm / 100);
      
      const creatorVidPayout = monthlyVidRevenue - adminVidProfit;
      const creatorMktPayout = monthlyMktRevenue - adminMktProfit;

      return {
          gross: monthlyVidRevenue + monthlyMktRevenue,
          adminTotal: adminVidProfit + adminMktProfit,
          creatorTotal: creatorVidPayout + creatorMktPayout,
          vidBreakdown: { gross: monthlyVidRevenue, admin: adminVidProfit },
          mktBreakdown: { gross: monthlyMktRevenue, admin: adminMktProfit }
      };
  };

  const projection = calculateProjection();

  return (
    <div className="space-y-6 pb-24 px-2 md:px-0">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl scrollbar-hide">
           {['USERS', 'FINANCE', 'MARKET', 'CONFIG', 'LIBRARY', 'MAINTENANCE', 'ANALYTICS'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                   {t === 'USERS' && <UserIcon size={16}/>}
                   {t === 'FINANCE' && <Wallet size={16}/>}
                   {t === 'MARKET' && <Store size={16}/>}
                   {t === 'CONFIG' && <Settings size={16}/>}
                   {t === 'LIBRARY' && <Database size={16}/>}
                   {t === 'MAINTENANCE' && <Wrench size={16}/>}
                   {t === 'ANALYTICS' && <TrendingUp size={16}/>}
                   {t}
               </button>
           ))}
      </div>

      {activeTab === 'USERS' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 bg-slate-950 font-bold">Usuarios del Sistema</div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                              <tr>
                                  <th className="px-4 py-3">Usuario</th>
                                  <th className="px-4 py-3">Rol</th>
                                  <th className="px-4 py-3">Saldo</th>
                                  <th className="px-4 py-3">Último Acceso</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {users.map(u => (
                                  <tr key={u.id} className="hover:bg-slate-800/50">
                                      <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{u.role.trim()}</span></td>
                                      <td className="px-4 py-3 font-mono text-emerald-400">{Number(u.balance).toFixed(2)}</td>
                                      <td className="px-4 py-3 text-slate-500">{(u.lastActive || 0) > 0 ? new Date((u.lastActive || 0) * 1000).toLocaleDateString() : 'N/A'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-fit">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><PlusCircle size={18}/> Agregar Saldo Manual</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Usuario (ID o Username)</label>
                          <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" value={addBalanceTarget} onChange={e => setAddBalanceTarget(e.target.value)}>
                              <option value="">Seleccionar...</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.balance})</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Cantidad</label>
                          <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" value={addBalanceAmount} onChange={e => setAddBalanceAmount(e.target.value)} placeholder="0.00" />
                      </div>
                      <button onClick={handleAddBalance} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg">Procesar Recarga</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'FINANCE' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                  <h3 className="font-bold text-white">Solicitudes de Saldo Pendientes</h3>
                  <button onClick={loadData} className="text-xs bg-slate-800 p-2 rounded hover:bg-slate-700"><Search size={14}/></button>
              </div>
              {balanceRequests.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No hay solicitudes pendientes.</div>
              ) : (
                  <div className="divide-y divide-slate-800">
                      {balanceRequests.map(req => (
                          <div key={req.id} className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                                      <UserIcon size={20} className="text-slate-400"/>
                                  </div>
                                  <div>
                                      <div className="font-bold text-white">{req.username}</div>
                                      <div className="text-xs text-slate-500">Solicita: <span className="text-amber-400 font-bold text-sm">{req.amount} Saldo</span></div>
                                      <div className="text-[10px] text-slate-600">{new Date(req.createdAt * 1000).toLocaleString()}</div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleHandleRequest(req.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg" title="Aprobar"><CheckCircle size={18}/></button>
                                  <button onClick={() => handleHandleRequest(req.id, 'REJECTED')} className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg" title="Rechazar"><XCircle size={18}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'MARKET' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950 font-bold">Moderación de Marketplace</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {marketItems.map(item => (
                      <div key={item.id} className="flex gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                          <div className="w-16 h-16 bg-black rounded-md overflow-hidden shrink-0">
                              {item.images && item.images[0] && <img src={item.images[0]} className="w-full h-full object-cover"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white text-sm truncate">{item.title}</h4>
                              <div className="text-xs text-slate-500">Vendedor: {item.sellerName}</div>
                              <div className="text-xs font-mono text-amber-400">{item.price} $</div>
                              <div className={`text-[10px] uppercase font-bold mt-1 ${item.status==='ACTIVO'?'text-emerald-500':'text-red-500'}`}>{item.status}</div>
                          </div>
                          <button onClick={() => handleDeleteListing(item.id)} className="text-slate-500 hover:text-red-500 self-start"><Trash2 size={16}/></button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'CONFIG' && settings && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 max-w-2xl mx-auto">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2"><Settings size={20}/> Configuración del Sistema</h3>
              
              <div className="space-y-6">
                  {/* Commissions */}
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <h4 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2"><Percent size={14}/> Comisiones de Plataforma</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Comisión Videos (%)</label>
                              <input 
                                type="number" 
                                value={settings.videoCommission} 
                                onChange={e => setSettings({...settings, videoCommission: parseInt(e.target.value)})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Comisión Tienda (%)</label>
                              <input 
                                type="number" 
                                value={settings.marketCommission} 
                                onChange={e => setSettings({...settings, marketCommission: parseInt(e.target.value)})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                              />
                          </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">Este porcentaje se descontará automáticamente de cada venta y se depositará al Admin.</p>
                  </div>

                  {/* Paths */}
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2"><FolderSearch size={14}/> Rutas del Servidor</h4>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Ruta Librería Local (NAS)</label>
                          <input 
                            type="text" 
                            value={localPath} 
                            onChange={e => setLocalPath(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs"
                            placeholder="/volume1/video"
                          />
                      </div>
                  </div>

                  {/* API Keys */}
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><Key size={14}/> API Keys Externas</h4>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Pixabay Key (Stock Video)</label>
                              <input 
                                type="text" 
                                value={settings.pixabayKey} 
                                onChange={e => setSettings({...settings, pixabayKey: e.target.value})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs"
                              />
                          </div>
                          <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={!!settings.enableYoutube} 
                                onChange={e => setSettings({...settings, enableYoutube: e.target.checked})}
                                className="w-4 h-4 accent-indigo-600"
                              />
                              <span className="text-sm text-slate-300">Habilitar Descargas YouTube (Requiere yt-dlp en servidor)</span>
                          </div>
                      </div>
                  </div>

                  <button onClick={handleSaveConfig} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                      <Save size={20}/> Guardar Configuración
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'LIBRARY' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Escaneo de Librería Local</h3>
                  <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80">
                      <strong>Método Híbrido:</strong> Servidor Indexa &rarr; Cliente Procesa Metadatos (Evita colgar el NAS).
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                      <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                  </div>

                  <button onClick={handleScanLibrary} disabled={isScanning || processingClient} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {isScanning ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Indexar Archivos
                  </button>
                  
                  <button onClick={startClientProcessor} disabled={isScanning || processingClient} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {processingClient ? <Loader2 className="animate-spin"/> : <Monitor size={20}/>} Paso 2: Procesar Metadatos (Cliente)
                  </button>
                  
                  {processingClient && (
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(clientProgress.current / (clientProgress.total || 1)) * 100}%` }}></div>
                      </div>
                  )}

                  <hr className="border-slate-800 my-4" />
                  
                  <button 
                      onClick={handleRepairDb} 
                      disabled={cleaning || isScanning || processingClient}
                      className="w-full bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/30 text-amber-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                      {cleaning ? <Loader2 className="animate-spin" size={16}/> : <Wrench size={16}/>}
                      Reparar Base de Datos (Si hay errores)
                  </button>
              </div>

              <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                  {scanLog.map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1">{line}</div>)}
              </div>
          </div>
      )}

      {activeTab === 'MAINTENANCE' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Repair - Priority */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-amber-400"><Database size={20}/> Reparación de Base de Datos</h3>
                  <p className="text-sm text-slate-400 mb-6">
                      Sincroniza la estructura de las tablas, corrige columnas faltantes y asegura la integridad del esquema. Útil tras actualizaciones.
                  </p>
                  <button 
                      onClick={handleRepairDb} 
                      disabled={cleaning}
                      className="w-full bg-amber-900/30 hover:bg-amber-900/50 border border-amber-500/50 text-amber-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                      {cleaning ? <Loader2 className="animate-spin"/> : <Wrench size={20}/>}
                      Reparar Esquema BD
                  </button>
              </div>

              {/* Orphaned File Cleaner */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-red-400"><AlertTriangle size={20}/> Limpieza Profunda (Archivos Huérfanos)</h3>
                  <p className="text-sm text-slate-400 mb-6">
                      Escanea todas las carpetas de subida (Videos, Miniaturas, Avatars, Tienda) y <strong>ELIMINA FÍSICAMENTE</strong> cualquier archivo que no esté referenciado en la base de datos.
                      <br/><br/>
                      <span className="text-amber-500 font-bold">¡Cuidado! Esto es irreversible.</span>
                  </p>
                  <button 
                      onClick={handleCleanupOrphans} 
                      disabled={cleaning}
                      className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/50 text-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                      {cleaning ? <Loader2 className="animate-spin"/> : <Trash2 size={20}/>}
                      Eliminar Archivos Huérfanos
                  </button>
              </div>

              {/* Smart Storage Cleaner */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 lg:col-span-2">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-emerald-400"><Brush size={20}/> Limpieza Inteligente</h3>
                  <p className="text-sm text-slate-400 mb-4">
                      Elimina automáticamente videos antiguos con bajo rendimiento (pocos likes/views) para liberar espacio.
                  </p>
                  
                  <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                              <select value={cleanerCategory} onChange={e => setCleanerCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm">
                                  <option value="ALL">Todas</option>
                                  {Object.values(VideoCategory).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Días de Seguridad</label>
                              <input type="number" value={cleanerDays} onChange={e => setCleanerDays(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Eliminar el {cleanerPercent}% con peor rendimiento</label>
                          <input type="range" min="1" max="50" step="1" value={cleanerPercent} onChange={e => setCleanerPercent(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>
                  </div>

                  <button 
                      onClick={handlePreviewCleaner} 
                      disabled={cleaning}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mb-4"
                  >
                      {cleaning ? <Loader2 className="animate-spin"/> : <Search size={20}/>}
                      Analizar Candidatos
                  </button>

                  {cleanerPreview && (
                      <div className="bg-black/50 p-4 rounded-xl border border-slate-700 animate-in fade-in">
                          <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-2">
                              <div className="text-xs text-slate-400">
                                  <div>Total Videos: <span className="text-white font-bold">{cleanerPreview.stats.totalVideos}</span></div>
                                  <div>A Eliminar: <span className="text-red-400 font-bold">{cleanerPreview.stats.videosToDelete}</span></div>
                              </div>
                              <div className="text-right">
                                  <div className="text-[10px] text-slate-500 uppercase">Espacio Estimado</div>
                                  <div className="text-emerald-400 font-mono font-bold">{cleanerPreview.stats.spaceReclaimed}</div>
                              </div>
                          </div>
                          
                          <div className="max-h-40 overflow-y-auto mb-4 text-xs space-y-1">
                              {cleanerPreview.preview.map(v => (
                                  <div key={v.id} className="flex justify-between text-slate-300">
                                      <span className="truncate w-3/4">{v.title}</span>
                                      <span className="text-slate-500">{new Date(v.createdAt * 1000).toLocaleDateString()}</span>
                                  </div>
                              ))}
                          </div>

                          <button 
                              onClick={handleExecuteCleaner}
                              className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                          >
                              <Trash2 size={14}/> CONFIRMAR ELIMINACIÓN
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'ANALYTICS' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
              {/* Simulator Controls */}
              <div className="lg:col-span-1 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6 h-fit">
                  <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4"><Settings size={20} className="text-indigo-400"/> Simulador de Mercado</h3>
                  
                  <div>
                      <div className="flex justify-between mb-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Usuarios Activos</label>
                          <span className="text-xs text-white font-bold">{simUsers}</span>
                      </div>
                      <input type="range" min="10" max="5000" step="10" value={simUsers} onChange={e=>setSimUsers(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2"><Play size={12}/> Video Streaming</h4>
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Compras / Usuario / Mes</label>
                              <span className="text-[10px] text-indigo-400 font-bold">{simVidFreq}</span>
                          </div>
                          <input type="range" min="0" max="30" step="1" value={simVidFreq} onChange={e=>setSimVidFreq(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Precio Promedio ($)</label>
                              <span className="text-[10px] text-indigo-400 font-bold">{simAvgVidPrice}</span>
                          </div>
                          <input type="range" min="1" max="50" step="1" value={simAvgVidPrice} onChange={e=>setSimAvgVidPrice(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2"><ShoppingBag size={12}/> Marketplace</h4>
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Ventas / Usuario / Mes</label>
                              <span className="text-[10px] text-emerald-400 font-bold">{simMktFreq}</span>
                          </div>
                          <input type="range" min="0" max="10" step="0.1" value={simMktFreq} onChange={e=>setSimMktFreq(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Precio Promedio ($)</label>
                              <span className="text-[10px] text-emerald-400 font-bold">{simAvgMktPrice}</span>
                          </div>
                          <input type="range" min="5" max="500" step="5" value={simAvgMktPrice} onChange={e=>setSimAvgMktPrice(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>
                  </div>
              </div>

              {/* Results */}
              <div className="lg:col-span-2 space-y-6">
                  {/* Cards */}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 p-6 rounded-xl border border-indigo-500/30">
                          <div className="flex items-center gap-3 mb-2 text-indigo-300">
                              <Wallet size={20}/>
                              <span className="text-xs font-bold uppercase tracking-wider">Ingreso Neto Admin (Mensual)</span>
                          </div>
                          <div className="text-3xl font-mono font-bold text-white">
                              {projection.adminTotal.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
                          </div>
                          <div className="text-xs text-slate-400 mt-2">
                              Videos: <span className="text-indigo-400">{projection.vidBreakdown.admin.toFixed(2)}</span> • Market: <span className="text-emerald-400">{projection.mktBreakdown.admin.toFixed(2)}</span>
                          </div>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-900/50 to-slate-900 p-6 rounded-xl border border-emerald-500/30">
                          <div className="flex items-center gap-3 mb-2 text-emerald-300">
                              <BarChart3 size={20}/>
                              <span className="text-xs font-bold uppercase tracking-wider">Volumen Bruto (GMV)</span>
                          </div>
                          <div className="text-3xl font-mono font-bold text-white">
                              {projection.gross.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
                          </div>
                          <div className="text-xs text-slate-400 mt-2">
                              Pagado a Creadores: {projection.creatorTotal.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
                          </div>
                      </div>
                  </div>

                  {/* Profit Graph (SVG) */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                      <h4 className="font-bold text-white mb-6 flex items-center gap-2"><TrendingUp size={20}/> Proyección Anual</h4>
                      <div className="w-full h-64 flex items-end justify-between gap-1">
                          {Array.from({length: 12}).map((_, i) => {
                              // Simulate slight growth per month
                              const growthFactor = 1 + (i * 0.05); 
                              const val = projection.adminTotal * growthFactor;
                              const heightPercent = Math.min(100, (val / (projection.adminTotal * 2)) * 100);
                              
                              return (
                                  <div key={i} className="flex-1 flex flex-col justify-end group relative">
                                      <div 
                                        className="w-full bg-indigo-600 rounded-t-sm opacity-80 group-hover:opacity-100 transition-all"
                                        style={{ height: `${heightPercent}%` }}
                                      ></div>
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10 font-mono">
                                          {val.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
                                      </div>
                                      <div className="h-px bg-slate-800 w-full mt-1"></div>
                                      <span className="text-[9px] text-slate-500 text-center mt-1">M{i+1}</span>
                                  </div>
                              );
                          })}
                      </div>
                      <div className="flex justify-center gap-6 mt-4 text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
                              <span>Ganancia Neta Proyectada</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
