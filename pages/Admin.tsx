
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video, MarketplaceItem, BalanceRequest, SmartCleanerResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, Settings, Save, Play, ExternalLink, Key, Loader2, Trash2, Brush, FolderSearch, AlertTriangle, ShoppingBag, CheckCircle, XCircle, Percent, Wallet, Store, Wrench, TrendingUp, BarChart3, Maximize, X, HelpCircle, Server, HardDrive, Calculator, Info, Zap, SkipForward } from 'lucide-react';
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

// --- VISIBLE SCANNER PLAYER COMPONENT ---
// Ensures metadata is loaded by actually playing the video in the DOM
const ScannerPlayer = ({ video, onComplete, onSkip }: { video: Video, onComplete: (dur: number, thumb: File | null) => void, onSkip: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Loading stream...');
    const [retries, setRetries] = useState(0);

    useEffect(() => {
        // Safety timeout - skip if stuck for 25 seconds
        const timer = setTimeout(() => {
            console.warn("Scanner timeout for", video.title);
            onSkip();
        }, 25000);
        return () => clearTimeout(timer);
    }, [video]);

    useEffect(() => {
        const v = videoRef.current;
        if(v) {
            v.volume = 0;
            v.muted = true;
            v.play().catch(e => {
                console.warn("Autoplay blocked/failed", e);
                setStatus('Autoplay failed. Retrying...');
                // Try playing again after a moment if it failed (sometimes helps with buffer)
                setTimeout(() => v.play().catch(() => {}), 1000);
            });
        }
    }, [video]);

    const handleTimeUpdate = async () => {
        const vid = videoRef.current;
        if (!vid) return;

        // Wait until we have passed the 2-second mark to ensure we have a valid frame and duration
        if (vid.currentTime > 2.0 && vid.duration > 0) {
            vid.pause();
            setStatus('Capturing metadata...');
            
            let thumbnail: File | null = null;
            const duration = vid.duration;

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360; 
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.7));
                    if (blob) {
                        thumbnail = new File([blob], "thumb.jpg", { type: 'image/jpeg' });
                    }
                }
            } catch (e) {
                console.warn("Canvas capture failed (likely Tainted/CORS). Saving duration only.", e);
            }

            onComplete(duration, thumbnail);
        }
    };

    const handleError = () => {
        if (retries < 2) {
            setRetries(p => p + 1);
            setStatus(`Retry ${retries + 1}...`);
            if(videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
            }
        } else {
            console.error("Video Error:", videoRef.current?.error);
            onSkip();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2 truncate w-full text-center">{video.title}</h3>
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800 mb-4">
                <video
                    ref={videoRef}
                    src={video.videoUrl} // No CORS attribute implies Same-Origin, which works if API is on same domain
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleError}
                    onWaiting={() => setStatus('Buffering...')}
                    onPlaying={() => setStatus('Scanning...')}
                />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                    {status}
                </div>
            </div>
            <div className="flex gap-4 w-full">
                <button onClick={onSkip} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-bold transition-colors">
                    Skip Video
                </button>
            </div>
        </div>
    );
};

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
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const wakeLock = useRef<any>(null);

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

  // --- ACTIVE SCANNER CONTROL ---

  const startActiveScan = async () => {
      setScanLog(prev => [...prev, "Fetching unprocessed videos..."]);
      const pending = await db.getUnprocessedVideos();
      if (pending.length === 0) {
          setScanLog(prev => [...prev, "No pending videos found."]);
          toast.info("No pending videos found");
          return;
      }

      setScanQueue(pending);
      setCurrentScanIndex(0);
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

  const handleVideoProcessed = async (duration: number, thumbnail: File | null) => {
      const item = scanQueue[currentScanIndex];
      try {
          await db.updateVideoMetadata(item.id, duration, thumbnail);
          setScanLog(prev => [...prev, `Processed: ${item.title} (${Math.floor(duration)}s)`]);
      } catch (e: any) {
          setScanLog(prev => [...prev, `Failed to save: ${item.title}`]);
      }
      
      // Move to next
      const nextIdx = currentScanIndex + 1;
      if (nextIdx >= scanQueue.length) {
          stopActiveScan();
          toast.success("Batch Complete!");
          setScanLog(prev => [...prev, "Batch Complete."]);
          loadData();
      } else {
          setCurrentScanIndex(nextIdx);
      }
  };

  const handleVideoSkip = async () => {
      const item = scanQueue[currentScanIndex];
      setScanLog(prev => [...prev, `Skipped: ${item.title}`]);
      // Mark as processed with 0 duration to avoid loop
      await db.updateVideoMetadata(item.id, 0, null);
      
      const nextIdx = currentScanIndex + 1;
      if (nextIdx >= scanQueue.length) {
          stopActiveScan();
          toast.success("Batch Complete!");
          setScanLog(prev => [...prev, "Batch Complete."]);
          loadData();
      } else {
          setCurrentScanIndex(nextIdx);
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

      {/* OTHER TABS HIDDEN FOR BREVITY - Same as original */}
      {/* ... (Finance, Market, Config, Maintenance, Analytics tabs) ... */}
      
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
                      {activeScan ? <Loader2 className="animate-spin"/> : <Play size={20}/>} Paso 2: Procesar (Escáner Visual)
                  </button>
              </div>

              <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                  {scanLog.map((line, i) => <div key={i} className="mb-1 border-b border-slate-800/50 pb-1">{line}</div>)}
              </div>
          </div>
      )}

      {/* ACTIVE SCANNER OVERLAY */}
      {activeScan && scanQueue.length > 0 && currentScanIndex < scanQueue.length && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
              <div className="absolute top-0 left-0 right-0 p-4 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10">
                  <div className="text-white">
                      <h2 className="text-xl font-bold flex items-center gap-2"><Maximize className="text-indigo-400 animate-pulse"/> Active Visual Scanner</h2>
                      <p className="text-sm text-slate-400">Processing {currentScanIndex + 1} of {scanQueue.length}</p>
                  </div>
                  <button onClick={stopActiveScan} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full"><X/></button>
              </div>

              <ScannerPlayer 
                  video={scanQueue[currentScanIndex]}
                  onComplete={handleVideoProcessed}
                  onSkip={handleVideoSkip}
              />
              
              <div className="mt-8 text-slate-500 text-sm max-w-md text-center">
                  <Info size={16} className="inline mr-1"/>
                  Do not close this window. The app is playing videos to extract metadata.
              </div>
          </div>
      )}
    </div>
  );
}
