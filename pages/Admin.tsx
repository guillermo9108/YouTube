
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video, FtpSettings, MarketplaceItem, BalanceRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock, Settings, Save, Play, Pause, ExternalLink, Key, Loader2, Youtube, Trash2, Brush, Tag, FolderSearch, Terminal, AlertTriangle, Network, ShoppingBag, CheckCircle, XCircle, Percent, Monitor, DollarSign, Wallet, Store, Truck } from 'lucide-react';
import { generateThumbnail } from '../utils/videoGenerator';
import { useToast } from '../context/ToastContext';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'USERS' | 'FINANCE' | 'MARKET' | 'CONFIG' | 'LIBRARY'>('USERS');
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = () => {
      if (activeTab === 'USERS') {
          db.getAllUsers().then(setUsers);
      } else if (activeTab === 'FINANCE') {
          db.getBalanceRequests().then(setBalanceRequests);
      } else if (activeTab === 'MARKET') {
          db.adminGetMarketplaceItems().then(setMarketItems);
      } else if (activeTab === 'CONFIG' || activeTab === 'LIBRARY') {
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

                  if (duration > 0) {
                      await db.updateVideoMetadata(v.id, duration, thumbnail);
                      setScanLog(prev => [...prev, ` > Updated: ${Math.floor(duration)}s`]);
                  } else {
                      setScanLog(prev => [...prev, " > Failed to load video"]);
                  }

              } catch (err: any) {
                  setScanLog(prev => [...prev, ` > Error: ${err.message}`]);
              }

              setClientProgress({ current: i + 1, total: pending.length });
              await new Promise(r => setTimeout(r, 200)); 
          }
          
          setScanLog(prev => [...prev, "Batch complete."]);

      } catch (e: any) {
          setScanLog(prev => [...prev, `Fatal: ${e.message}`]);
      } finally {
          setProcessingClient(false);
      }
  };

  return (
    <div className="space-y-6 pb-24 px-2 md:px-0">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl scrollbar-hide">
           {['USERS', 'FINANCE', 'MARKET', 'CONFIG', 'LIBRARY'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                   {t === 'USERS' && <UserIcon size={16}/>}
                   {t === 'FINANCE' && <Wallet size={16}/>}
                   {t === 'MARKET' && <Store size={16}/>}
                   {t === 'CONFIG' && <Settings size={16}/>}
                   {t === 'LIBRARY' && <Database size={16}/>}
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
                                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{u.role}</span></td>
                                      <td className="px-4 py-3 font-mono text-emerald-400">{u.balance.toFixed(2)}</td>
                                      <td className="px-4 py-3 text-slate-500">{new Date(u.lastActive * 1000).toLocaleDateString()}</td>
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
              </div>

              <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                  {scanLog.map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1">{line}</div>)}
              </div>
          </div>
      )}
    </div>
  );
}
