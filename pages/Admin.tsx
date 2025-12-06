
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, ContentRequest, SystemSettings, VideoCategory, Video, FtpSettings, MarketplaceItem, BalanceRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, PlusCircle, User as UserIcon, Shield, Database, DownloadCloud, Clock, Settings, Save, Play, Pause, ExternalLink, Key, Loader2, Youtube, Trash2, Brush, Tag, FolderSearch, Terminal, AlertTriangle, Network, ShoppingBag, CheckCircle, XCircle, Percent, Monitor } from 'lucide-react';
import { generateThumbnail } from '../utils/videoGenerator';

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<'USERS' | 'CONFIG' | 'CLEANER' | 'CATEGORIES' | 'LIBRARY' | 'MARKET' | 'FINANCE'>('USERS');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Library State
  const [localPath, setLocalPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);
  
  // Client Processor
  const [processingClient, setProcessingClient] = useState(false);
  const [clientProgress, setClientProgress] = useState({ current: 0, total: 0 });
  const stopClientRef = useRef(false);

  useEffect(() => {
    db.getSystemSettings().then(s => {
        setSettings(s);
        if (s.localLibraryPath) setLocalPath(s.localLibraryPath);
    });
    db.getAllUsers().then(setUsers);
  }, []);

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
                  // Use Shared Utility
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
              await new Promise(r => setTimeout(r, 200)); // Delay to prevent browser freeze
          }
          
          setScanLog(prev => [...prev, "Batch complete."]);

      } catch (e: any) {
          setScanLog(prev => [...prev, `Fatal: ${e.message}`]);
      } finally {
          setProcessingClient(false);
      }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex gap-2 overflow-x-auto bg-slate-900 p-2 rounded-xl">
           {['USERS', 'CONFIG', 'LIBRARY', 'MARKET'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === t ? 'bg-indigo-600' : 'text-slate-400'}`}>{t}</button>
           ))}
      </div>

      {activeTab === 'LIBRARY' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Local Library Scan</h3>
                  <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80">
                      <strong>Method:</strong> Server Indexes Files &rarr; Client Extracts Metadata (No FFmpeg on Server)
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Server Path</label>
                      <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm" placeholder="/volume1/video" />
                  </div>

                  <button onClick={handleScanLibrary} disabled={isScanning || processingClient} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {isScanning ? <Loader2 className="animate-spin"/> : <FolderSearch size={20}/>} Step 1: Index Files
                  </button>
                  
                  <button onClick={startClientProcessor} disabled={isScanning || processingClient} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {processingClient ? <Loader2 className="animate-spin"/> : <Monitor size={20}/>} Step 2: Process Metadata
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
      
      {/* Other tabs omitted for brevity as requested only scan changes, but keeping structure valid */}
      {activeTab === 'USERS' && <div className="text-center text-slate-500">User Management (Standard)</div>}
    </div>
  );
}
