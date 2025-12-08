
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video, MarketplaceItem, BalanceRequest, SmartCleanerResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, Settings, Save, Play, ExternalLink, Key, Loader2, Trash2, Brush, FolderSearch, AlertTriangle, ShoppingBag, CheckCircle, XCircle, Percent, Wallet, Store, Wrench, TrendingUp, BarChart3, Maximize, X, HelpCircle, Server, HardDrive, Calculator, Info, Zap } from 'lucide-react';
import { useToast } from '../context/ToastContext';

// Helper Component for Tooltips
const InfoTooltip = ({ text, example }: { text: string, example?: string }) => (
    <div className="group relative inline-flex items-center ml-1.5 align-middle cursor-help">
        <HelpCircle size={12} className="text-slate-500 hover:text-indigo-400 transition-colors" />
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
            <p className="font-medium mb-1 text-white">{text}</p>
            {example && (
                <div className="bg-slate-900 rounded p-1.5 font-mono text-[10px] text-indigo-300 border border-slate-800">
                    Ej: <span className="select-all">{example}</span>
                </div>
            )}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-700"></div>
        </div>
    </div>
);

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
  
  // ACTIVE SCANNER STATE
  const [activeScan, setActiveScan] = useState(false);
  const [scanQueue, setScanQueue] = useState<Video[]>([]);
  const [scanIndex, setScanIndex] = useState(0);
  const [scanStatus, setScanStatus] = useState('Initializing...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const wakeLock = useRef<any>(null);
  const processingRef = useRef(false);

  // Forms
  const [addBalanceAmount, setAddBalanceAmount] = useState('');
  const [addBalanceTarget, setAddBalanceTarget] = useState('');

  // Maintenance State
  const [cleanerPreview, setCleanerPreview] = useState<SmartCleanerResult | null>(null);
  const [cleanerPercent, setCleanerPercent] = useState(10);
  const [cleanerCategory, setCleanerCategory] = useState('ALL');
  const [cleanerDays, setCleanerDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);

  // Advanced Simulator State
  const [simGrowthRate, setSimGrowthRate] = useState(10);
  const [simConversionRate, setSimConversionRate] = useState(25);
  const [simAvgDeposit, setSimAvgDeposit] = useState(50);
  const [simStorageCostPerUser, setSimStorageCostPerUser] = useState(0.5);
  const [simFixedCost, setSimFixedCost] = useState(200);
  const [simVelocity, setSimVelocity] = useState(50);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Clean up wake lock on unmount
  useEffect(() => {
      return () => {
          if (wakeLock.current) wakeLock.current.release();
      };
  }, []);

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
              if (res.newToImport > 0) setScanLog(prev => [...prev, "Use 'Active Processor' to analyze them."]);
          } else {
              setScanLog(prev => [...prev, `Error: ${res.errors || 'Unknown'}`]);
          }
      } catch (e: any) {
          setScanLog(prev => [...prev, `Critical Error: ${e.message}`]);
      } finally {
          setIsScanning(false);
      }
  };

  // --- ACTIVE SCANNER LOGIC (Simpler, Same-Origin Friendly) ---

  const startActiveScan = async () => {
      setScanLog(prev => [...prev, "Fetching unprocessed videos..."]);
      const pending = await db.getUnprocessedVideos();
      if (pending.length === 0) {
          setScanLog(prev => [...prev, "No pending videos found."]);
          toast.info("No pending videos found");
          return;
      }

      setScanQueue(pending);
      setScanIndex(0);
      processingRef.current = false;
      setActiveScan(true);
      
      try {
          if ('wakeLock' in navigator) {
              wakeLock.current = await (navigator as any).wakeLock.request('screen');
              toast.success("Scanner Active - Keep screen on");
          }
      } catch(e) { console.warn("Wake Lock failed", e); }
  };

  const stopActiveScan = () => {
      setActiveScan(false);
      setScanQueue([]);
      if (wakeLock.current) {
          wakeLock.current.release();
          wakeLock.current = null;
      }
  };

  const captureAndAdvance = async () => {
      if (processingRef.current) return;
      processingRef.current = true; // Lock

      const video = videoRef.current;
      const item = scanQueue[scanIndex];
      
      if (!video || !item) {
          moveToNext(500);
          return;
      }

      video.pause();
      setScanStatus('Generating Thumb...');

      try {
          let thumbnail: File | null = null;
          
          // Canvas capture (Works without CORS if same-origin)
          try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(video, 0, 0);
                  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.6));
                  if (blob) thumbnail = new File([blob], "thumb.jpg", { type: "image/jpeg" });
              }
          } catch(e) {
              console.warn("Canvas capture failed", e);
              // Likely CORS issue or format issue. We proceed without thumbnail to save the video.
          }

          const duration = video.duration || 0;
          
          if (!isNaN(duration) && duration > 0) {
              await db.updateVideoMetadata(item.id, duration, thumbnail);
              setScanLog(prev => [...prev, `Processed: ${item.title} (${Math.floor(duration)}s)`]);
          } else {
              // Mark as bad but processed
              await db.updateVideoMetadata(item.id, 0, null);
              setScanLog(prev => [...prev, `Marked Bad (No Metadata): ${item.title}`]);
          }

      } catch (e: any) {
          setScanLog(prev => [...prev, `Error processing ${item.title}: ${e.message}`]);
      }

      moveToNext(500);
  };

  const moveToNext = (delay: number) => {
      setTimeout(() => {
          if (scanIndex < scanQueue.length - 1) {
              processingRef.current = false;
              setScanIndex(prev => prev + 1);
          } else {
              toast.success("Scan Complete!");
              setScanLog(prev => [...prev, "Batch Complete."]);
              stopActiveScan();
              loadData(); 
          }
      }, delay);
  };

  const handleVideoError = () => {
      if (processingRef.current) return;
      const item = scanQueue[scanIndex];
      console.error(`Video ${item?.title} failed to load.`);
      setScanLog(prev => [...prev, `Failed to load: ${item?.title}`]);
      
      // Force skip if video is corrupt
      processingRef.current = true;
      if(item) {
          db.updateVideoMetadata(item.id, 0, null).finally(() => moveToNext(500));
      } else {
          moveToNext(500);
      }
  };

  // Determine if we need CORS. For local Synology (api/...), it's same-origin so we DON'T want attribute.
  const currentVideoUrl = scanQueue[scanIndex]?.videoUrl || '';
  const isSameOrigin = currentVideoUrl.startsWith('api/') || currentVideoUrl.startsWith('/') || currentVideoUrl.includes(window.location.host);
  // Only add crossOrigin="anonymous" if it's truly external (e.g. S3, YouTube proxy). Local files break if forced.
  const crossOriginAttr = isSameOrigin ? undefined : "anonymous";

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

  // --- ADVANCED PROJECTION ALGORITHM ---
  const calculateProjection = () => {
      const months = 12;
      const data = [];
      
      let currentUsers = users.length > 0 ? users.length : 20; 
      
      const vidComm = (settings?.videoCommission || 20) / 100;
      const marketComm = (settings?.marketCommission || 25) / 100;
      const avgComm = (vidComm + marketComm) / 2;

      let cumulativeCashProfit = 0;

      for (let i = 0; i < months; i++) {
          // 1. User Growth (Compound)
          currentUsers = currentUsers * (1 + (simGrowthRate / 100));
          
          // 2. Variable Costs (Storage/Bandwidth scales with users)
          const variableCost = currentUsers * simStorageCostPerUser;
          const totalCost = simFixedCost + variableCost;

          // 3. Cash Inflow (Deposits)
          const payingUsers = currentUsers * (simConversionRate / 100);
          const monthlyRevenue = payingUsers * simAvgDeposit;

          // 4. Internal Economy (The "Engine")
          // How much Saldo is moving?
          const totalUserBalanceEstimate = currentUsers * 50; // Assume avg float
          const transactionVolume = totalUserBalanceEstimate * (simVelocity / 100);
          
          // 5. Admin "Burn" (Revenue in Saldo) - liability reduction
          const saldoReclaimed = transactionVolume * avgComm;

          // 6. Net Profit (Cash)
          const monthlyProfit = monthlyRevenue - totalCost;
          cumulativeCashProfit += monthlyProfit;

          data.push({
              month: i + 1,
              users: Math.round(currentUsers),
              revenue: Math.round(monthlyRevenue),
              cost: Math.round(totalCost),
              profit: Math.round(monthlyProfit),
              reclaimed: Math.round(saldoReclaimed)
          });
      }

      return { data, totalProfit: cumulativeCashProfit };
  };

  const projection = calculateProjection();
  const finalMonth = projection.data[11];

  // Helper for SVG Chart
  const getPoints = (key: 'revenue' | 'cost') => {
      // Find max value across both metrics for scale
      const maxVal = Math.max(...projection.data.map(d => Math.max(d.revenue, d.cost) * 1.1));
      if (maxVal === 0) return "0,100 100,100";
      return projection.data.map((d, i) => {
          const x = (i / 11) * 100;
          const y = 100 - ((d[key] / maxVal) * 100);
          return `${x},${y}`;
      }).join(' ');
  };

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
                                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role?.trim().toUpperCase() === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{u.role ? u.role.trim() : 'USER'}</span></td>
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
                              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({Number(u.balance).toFixed(2)})</option>)}
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
                      <h4 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2">
                          <Percent size={14}/> Comisiones de Plataforma
                          <InfoTooltip text="Porcentaje que el administrador retiene de cada transacción. El resto va al usuario creador." example="20% significa que de $10, el admin recibe $2" />
                      </h4>
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
                  </div>

                  {/* Paths */}
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                          <FolderSearch size={14}/> Rutas del Servidor
                          <InfoTooltip text="Ubicación física en el disco duro del servidor donde están tus videos. Debe tener permisos de lectura." example="/volume1/public/videos" />
                      </h4>
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
                      <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                          <Key size={14}/> API Keys Externas
                          <InfoTooltip text="Claves para servicios de terceros. Pixabay permite buscar videos de stock gratuitos para importar." example="4323423-abcdef123456" />
                      </h4>
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
                              <span className="text-sm text-slate-300">Habilitar Descargas YouTube (Requiere yt-dlp)</span>
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
                      <strong>Método Híbrido:</strong> Servidor Indexa &rarr; Cliente (Tu móvil) Procesa.
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ruta del Servidor</label>
                      <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                  </div>

                  <button onClick={handleScanLibrary} disabled={isScanning || activeScan} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {isScanning ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Paso 1: Indexar Archivos
                  </button>
                  
                  <button onClick={startActiveScan} disabled={isScanning || activeScan} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {activeScan ? <Loader2 className="animate-spin"/> : <Play size={20}/>} Paso 2: Procesar (Modo Reproductor)
                  </button>
                  
                  <hr className="border-slate-800 my-4" />
                  
                  <button 
                      onClick={handleRepairDb} 
                      disabled={cleaning || isScanning || activeScan}
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
              
              {/* CONFIGURATION PANEL */}
              <div className="lg:col-span-4 bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-6 h-fit sticky top-20">
                  <div className="border-b border-slate-800 pb-4">
                      <h3 className="font-bold text-white flex items-center gap-2"><Calculator size={20} className="text-indigo-400"/> Proyección Financiera</h3>
                      <p className="text-xs text-slate-500 mt-1">Simulación basada en crecimiento compuesto.</p>
                  </div>
                  
                  {/* Growth Factors */}
                  <div className="space-y-4">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2">
                          <TrendingUp size={12}/> Crecimiento & Ingresos
                      </h4>
                      
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Crecimiento Mensual Usuarios</label>
                              <span className="text-[10px] text-white font-bold">{simGrowthRate}%</span>
                          </div>
                          <input type="range" min="0" max="50" value={simGrowthRate} onChange={e=>setSimGrowthRate(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>

                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400 flex items-center">
                                  Tasa de Conversión (Pagos)
                                  <InfoTooltip text="% de usuarios que realizan depósitos de saldo real." example="25% = 1 de cada 4 paga" />
                              </label>
                              <span className="text-[10px] text-white font-bold">{simConversionRate}%</span>
                          </div>
                          <input type="range" min="1" max="100" value={simConversionRate} onChange={e=>setSimConversionRate(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>

                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-[10px] text-slate-400">Depósito Promedio ($)</label>
                              <span className="text-[10px] text-white font-bold">${simAvgDeposit}</span>
                          </div>
                          <input type="range" min="10" max="500" step="10" value={simAvgDeposit} onChange={e=>setSimAvgDeposit(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      </div>
                  </div>

                  {/* Cost Factors */}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h4 className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
                          <Zap size={12}/> Estructura de Costos
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Costo Fijo (Base)</label>
                              <input type="number" value={simFixedCost} onChange={e=>setSimFixedCost(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                          </div>
                          <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                  Costo Var. (Usuario)
                                  <InfoTooltip text="Costo incremental por usuario (Almacenamiento, CDN, BD)." />
                              </label>
                              <input type="number" step="0.1" value={simStorageCostPerUser} onChange={e=>setSimStorageCostPerUser(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                          </div>
                      </div>
                  </div>

                  {/* Economy Velocity */}
                  <div className="pt-4 border-t border-slate-800">
                      <div className="flex justify-between mb-1">
                          <label className="text-[10px] text-slate-400 flex items-center text-indigo-300">
                              Velocidad de la Economía
                              <InfoTooltip text="Qué tan rápido gastan el saldo los usuarios. Mayor velocidad = Más comisiones recuperadas." />
                          </label>
                          <span className="text-[10px] text-indigo-400 font-bold">{simVelocity}% / mes</span>
                      </div>
                      <input type="range" min="10" max="100" value={simVelocity} onChange={e=>setSimVelocity(Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  </div>
              </div>

              {/* VISUALIZATION PANEL */}
              <div className="lg:col-span-8 space-y-6">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ingreso Mensual (Mes 12)</div>
                          <div className="text-2xl font-mono font-bold text-emerald-400">${finalMonth.revenue.toLocaleString()}</div>
                          <div className="text-[10px] text-emerald-600 flex items-center gap-1"><TrendingUp size={10}/> Proyectado</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Usuarios Activos (Mes 12)</div>
                          <div className="text-2xl font-mono font-bold text-white">{finalMonth.users.toLocaleString()}</div>
                          <div className="text-[10px] text-blue-400">Base Creciente</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                          <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Margen Neto</div>
                          <div className="text-2xl font-mono font-bold text-indigo-400">{Math.round((finalMonth.profit / Math.max(1, finalMonth.revenue)) * 100)}%</div>
                          <div className="text-[10px] text-indigo-600">Rentabilidad</div>
                      </div>
                  </div>

                  {/* MAIN CHART */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-80 relative flex flex-col">
                      <h4 className="text-white font-bold text-sm mb-6">Proyección a 1 Año (Ingresos vs Costos)</h4>
                      
                      <div className="flex-1 w-full relative">
                          {/* SVG Chart */}
                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                              {/* Grid Lines */}
                              <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                              <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                              <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" />

                              {/* Revenue Area (Green) */}
                              <polygon 
                                points={`0,100 ${getPoints('revenue')} 100,100`} 
                                fill="url(#gradRevenue)" 
                                opacity="0.5"
                              />
                              <polyline 
                                points={getPoints('revenue')} 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="2" 
                                vectorEffect="non-scaling-stroke"
                              />

                              {/* Cost Line (Red) */}
                              <polyline 
                                points={getPoints('cost')} 
                                fill="none" 
                                stroke="#ef4444" 
                                strokeWidth="2" 
                                strokeDasharray="4"
                                vectorEffect="non-scaling-stroke"
                              />

                              {/* Defs for Gradient */}
                              <defs>
                                <linearGradient id="gradRevenue" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                          </svg>

                          {/* Hover Tooltip Overlay (Simplified) */}
                          <div className="absolute inset-0 flex justify-between items-end px-2 opacity-0 hover:opacity-100 transition-opacity">
                              {projection.data.map((d, i) => (
                                  <div key={i} className="relative group h-full flex flex-col justify-end pb-2 cursor-pointer w-full items-center">
                                      <div className="w-px h-full bg-white/10 absolute top-0"></div>
                                      <div className="bg-slate-800 border border-slate-700 p-2 rounded text-[9px] text-white absolute bottom-10 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                          <div className="font-bold mb-1">Mes {d.month}</div>
                                          <div className="text-emerald-400">Ing: ${d.revenue}</div>
                                          <div className="text-red-400">Gas: ${d.cost}</div>
                                          <div className="text-indigo-400 border-t border-slate-600 mt-1 pt-1">Neto: ${d.profit}</div>
                                      </div>
                                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* X-Axis Labels */}
                      <div className="flex justify-between mt-2 text-[9px] text-slate-500 uppercase font-bold px-2">
                          <span>Mes 1</span>
                          <span>Mes 6</span>
                          <span>Mes 12</span>
                      </div>
                  </div>

                  {/* Analysis Text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl text-sm text-indigo-200">
                          <strong className="block mb-2 flex items-center gap-2"><Shield size={14}/> Impacto de Comisiones</strong>
                          <p className="opacity-80 text-xs leading-relaxed">
                              Con una velocidad económica del <strong>{simVelocity}%</strong>, el sistema "quema" (recupera) aproximadamente <strong>{finalMonth.reclaimed.toLocaleString()}</strong> en Saldo mensualmente. Esto reduce tu pasivo total y valida la moneda digital.
                          </p>
                      </div>
                      <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-200">
                          <strong className="block mb-2 flex items-center gap-2"><Wallet size={14}/> Punto de Equilibrio</strong>
                          <p className="opacity-80 text-xs leading-relaxed">
                              Con estos parámetros, generas una ganancia total acumulada de <strong>${projection.totalProfit.toLocaleString()}</strong> en el primer año. Asegúrate de reinvertir el 30% en marketing para mantener la tasa de crecimiento del {simGrowthRate}%.
                          </p>
                      </div>
                  </div>

              </div>
          </div>
      )}

      {/* ACTIVE PROCESSOR OVERLAY */}
      {activeScan && scanQueue.length > 0 && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in">
              {/* Header Info */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 to-transparent z-10 flex justify-between items-start">
                  <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><Maximize className="text-emerald-400 animate-pulse"/> Active Scanner</h2>
                      <p className="text-slate-300 text-sm">Processing {scanIndex + 1} of {scanQueue.length}</p>
                  </div>
                  <button onClick={stopActiveScan} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm"><X/></button>
              </div>

              {/* Active Player */}
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {scanQueue[scanIndex] && (
                      <video 
                        ref={videoRef}
                        src={scanQueue[scanIndex].videoUrl}
                        className="max-w-full max-h-full"
                        controls={true}
                        autoPlay
                        muted
                        playsInline
                        // CRITICAL: Only set crossOrigin if it is NOT same-origin (local)
                        crossOrigin={crossOriginAttr}
                        
                        onLoadedMetadata={(e) => {
                            // Fast-forward to ensure we have a frame
                            e.currentTarget.currentTime = 1.0;
                        }}
                        onSeeked={() => {
                            // Capture immediately after seek
                            captureAndAdvance();
                        }}
                        onTimeUpdate={(e) => {
                            // Fallback if seek event missed but time progressed
                            if (e.currentTarget.currentTime > 0.5) {
                                captureAndAdvance();
                            }
                        }}
                        onError={handleVideoError}
                      />
                  )}
                  {/* Status Overlay */}
                  <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
                      <div className="inline-block bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
                          <p className="text-white font-mono text-sm font-bold mb-2">
                              {scanQueue[scanIndex]?.title}
                          </p>
                          <div className="flex items-center justify-center gap-2">
                              <Loader2 className="animate-spin text-emerald-500" />
                              <span className="text-emerald-400 font-bold uppercase tracking-wider text-xs">
                                  {scanStatus}
                              </span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
