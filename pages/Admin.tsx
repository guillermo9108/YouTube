
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
    if (confirm(`Add ${amount} Saldo to ${username}?`)) {
      try {
        await db.adminAddBalance(currentUser.id, targetId, amount);
        loadData();
        alert(`Successfully added ${amount} Saldo.`);
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleRepairDb = async () => {
    if (confirm("This will attempt to create any missing tables. Continue?")) {
      setRepairing(true);
      try {
         await db.adminRepairDb();
         alert("Database schema updated successfully.");
      } catch (e: any) {
         alert("Repair failed: " + e.message);
      } finally {
         setRepairing(false);
      }
    }
  };

  const handleCleanup = async () => {
      if(confirm("This will delete videos from database that have missing files. Continue?")) {
          try {
              const res = await db.adminCleanupVideos();
              alert(`Cleanup complete. Removed ${res.deleted} broken video entries.`);
          } catch(e: any) {
              alert("Cleanup error: " + e.message);
          }
      }
  };

  const triggerDownload = async () => {
     if(confirm("Force queue processing now? Server will attempt to download pending videos.")) {
       setProcessingQueue(true);
       setProcessResult('');
       try {
         const res = await db.triggerQueueProcessing();
         setProcessResult(res.message);
         loadData();
         setTimeout(() => setProcessingQueue(false), 3000);
       } catch (e: any) {
         alert("Trigger failed: " + e.message);
         setProcessingQueue(false);
       }
     }
  };

  const saveSettings = async () => {
      if (!settings) return;
      try {
          // If in Library tab, save path too
          if (activeTab === 'LIBRARY') {
              const updated = { ...settings, localLibraryPath: localPath };
              await db.updateSystemSettings(updated);
              setSettings(updated);
          } else {
              await db.updateSystemSettings(settings);
          }
          alert("Settings saved!");
      } catch (e) { alert("Failed to save"); }
  };

  const handleScanLibrary = async () => {
      if (!localPath.trim()) return;
      setScanning(true);
      setScanLog(['Starting scan...']);
      
      // Save path first
      if (settings) {
          const updated = { ...settings, localLibraryPath: localPath };
          await db.updateSystemSettings(updated);
      }

      try {
          const res = await db.scanLocalLibrary(localPath);
          setScanLog(res.log);
          alert(`Scan complete. Imported ${res.imported} new videos.`);
      } catch (e: any) {
          setScanLog(prev => [...prev, `ERROR: ${e.message}`]);
          alert("Scan error: " + e.message);
      } finally {
          setScanning(false);
      }
  };

  const addCustomCategory = () => {
      if (!settings || !newCatName.trim()) return;
      const cleanName = newCatName.trim().toUpperCase().replace(/ /g, '_');
      
      const current = settings.customCategories || [];
      if (current.includes(cleanName) || Object.values(VideoCategory).includes(cleanName as any)) {
          alert("Category already exists");
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
      if (!confirm(`Delete category ${cat}? This won't delete videos, but they will show as standard text.`)) return;
      
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
      if (!confirm(`WARNING: This will permanently delete ${cleanerStats.videosToDelete} videos. This cannot be undone.\n\nType 'DELETE' to confirm.`)) return;
      
      try {
          const ids = cleanerPreview.map(v => v.id);
          const res = await db.executeSmartCleaner(ids);
          alert(`Deleted ${res.deleted} videos successfully.`);
          setCleanerPreview([]);
          setCleanerStats({ totalVideos: 0, videosToDelete: 0, spaceReclaimed: '0 MB' });
      } catch (e: any) {
          alert("Error executing cleaner: " + e.message);
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
                        <div className="text-emerald-400 font-bold mb-4 text-xl">Completed!</div>
                        <p className="text-slate-300 mb-6">{processResult}</p>
                     </>
                 ) : (
                     <>
                        <Loader2 size={48} className="text-indigo-500 animate-spin mx-auto mb-6" />
                        <h3 className="text-xl font-bold text-white mb-2">Server Processing</h3>
                        <p className="text-slate-400 mb-4 text-sm">Downloading videos from Pexels/Pixabay...</p>
                        <p className="text-xs text-slate-500">This may take a minute. Do not close.</p>
                     </>
                 )}
             </div>
         </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Admin Dashboard</h2>
          <p className="text-slate-400 text-sm">System Management</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
           <button onClick={() => setActiveTab('USERS')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Users</button>
           <button onClick={() => setActiveTab('CONFIG')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CONFIG' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Config</button>
           <button onClick={() => setActiveTab('CATEGORIES')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CATEGORIES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Cat & Prices</button>
           <button onClick={() => setActiveTab('LIBRARY')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'LIBRARY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Library Import</button>
           <button onClick={() => setActiveTab('CLEANER')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'CLEANER' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}>Cleaner</button>
        </div>
      </div>

      {activeTab === 'LIBRARY' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2"><FolderSearch size={18}/> Local Library Scan</h3>
                  <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200/80 leading-relaxed">
                      This tool recursively scans a folder on your NAS/Server for video files. It will:
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                          <li>Index videos without moving them (saves space/time).</li>
                          <li>Intelligently detect <strong>Series</strong> (S01E01), <strong>Novelas</strong> (Capitulo 5), and <strong>Movies</strong>.</li>
                          <li>Auto-import local cover images (jpg/png) if they match the video name.</li>
                          <li>Enable streaming for files outside the web root.</li>
                      </ul>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Server Directory Path</label>
                      <input 
                        type="text" 
                        value={localPath}
                        onChange={e => setLocalPath(e.target.value)}
                        placeholder="/volume1/video/movies"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white font-mono text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Example: <code>/var/www/html/videos</code> or <code>/volume1/video</code></p>
                  </div>

                  <button 
                    onClick={handleScanLibrary}
                    disabled={scanning || !localPath}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                      {scanning ? <Loader2 className="animate-spin" size={20}/> : <FolderSearch size={20}/>}
                      {scanning ? 'Scanning & Importing...' : 'Start Scan'}
                  </button>
              </div>

              <div className="bg-black p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-[500px] overflow-y-auto shadow-inner">
                  <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-800 pb-2">
                      <Terminal size={14}/> Scan Logs
                  </div>
                  {scanLog.length === 0 ? (
                      <div className="text-slate-600 italic">Waiting to scan...</div>
                  ) : (
                      scanLog.map((line, i) => (
                          <div key={i} className={`mb-1 ${line.startsWith('ERROR') ? 'text-red-400' : (line.startsWith('Success') ? 'text-emerald-400' : 'text-slate-300')}`}>
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
                      <h3 className="font-bold text-white flex items-center gap-2"><Tag size={18}/> Global Base Prices</h3>
                      <button onClick={saveSettings} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                          <Save size={14}/> Save
                      </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">These prices will be suggested to users when they upload a video in these categories. Users can still override them.</p>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {allCategories.map(cat => {
                          const isCustom = settings.customCategories?.includes(cat);
                          return (
                            <div key={cat} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300 uppercase">{cat.replace('_', ' ')}</span>
                                    {isCustom && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">CUSTOM</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Default:</span>
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
                  <h3 className="font-bold text-white flex items-center gap-2 mb-4"><PlusCircle size={18}/> Add Custom Category</h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 uppercase font-bold text-sm"
                        placeholder="NEW_CATEGORY_NAME"
                      />
                      <button onClick={addCustomCategory} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Add</button>
                  </div>
                  <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-lg">
                      <h4 className="text-xs font-bold text-indigo-300 mb-1">How it works</h4>
                      <p className="text-xs text-indigo-200/70 leading-relaxed">
                          Adding a category here makes it available in the upload dropdown for all users. You can also set a base price for it on the left panel.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CLEANER' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                  <h3 className="font-bold text-white flex items-center gap-2"><Brush size={18} /> Cleaner Configuration</h3>
                  <p className="text-xs text-slate-400">
                      The Smart Cleaner algorithm calculates a score for each video based on Views, Likes, Dislikes, and Age.
                      Videos with the lowest scores (least popular/oldest) will be selected for deletion.
                  </p>
                  
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Category</label>
                      <select value={cleanerCategory} onChange={e => setCleanerCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                          <option value="ALL">All Categories</option>
                          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delete Percentage: {cleanerPercent}%</label>
                      <input 
                        type="range" 
                        min="5" 
                        max="50" 
                        value={cleanerPercent} 
                        onChange={e => setCleanerPercent(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Selects the bottom {cleanerPercent}% of videos by quality score.</p>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Minimum Age: {cleanerSafeDays} Days</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="30" 
                        value={cleanerSafeDays} 
                        onChange={e => setCleanerSafeDays(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Videos newer than {cleanerSafeDays} days will NOT be deleted (Safe Harbor). Set to 0 to clean immediate junk.</p>
                  </div>

                  <button onClick={previewCleaner} disabled={loadingCleaner} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                      {loadingCleaner ? <Loader2 className="animate-spin"/> : <Search size={18}/>} Preview Candidates
                  </button>
              </div>

              <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col h-[600px]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white">Candidates for Deletion</h3>
                      {cleanerStats.videosToDelete > 0 && (
                          <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded font-mono">
                              {cleanerStats.videosToDelete} Videos (~{cleanerStats.spaceReclaimed})
                          </span>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/50">
                      {cleanerPreview.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                              Run preview to see videos here.
                          </div>
                      ) : (
                          <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-slate-400 sticky top-0">
                                  <tr>
                                      <th className="p-3">Video</th>
                                      <th className="p-3">Views</th>
                                      <th className="p-3">Likes</th>
                                      <th className="p-3">Dislikes</th>
                                      <th className="p-3">Age (Days)</th>
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
                          <Trash2 size={18}/> Confirm & Delete Permanently
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CONFIG' && settings && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
                <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} /> Auto-Download Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input type="time" value={settings.downloadStartTime} onChange={e => setSettings({...settings, downloadStartTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                        <input type="time" value={settings.downloadEndTime} onChange={e => setSettings({...settings, downloadEndTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch Size (Videos per Run)</label>
                    <input type="number" min="1" max="50" value={settings.batchSize} onChange={e => setSettings({...settings, batchSize: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Duration (Sec)</label>
                        <input type="number" value={settings.maxDuration} onChange={e => setSettings({...settings, maxDuration: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Height (px)</label>
                        <input type="number" placeholder="1080" value={settings.maxResolution} onChange={e => setSettings({...settings, maxResolution: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"/>
                    </div>
                </div>

                <button onClick={saveSettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    <Save size={18} /> Save Settings
                </button>
             </div>

             <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                         <h3 className="font-bold text-white flex items-center gap-2"><Key size={18} /> Server API Keys</h3>
                         <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Stored Safely in DB</span>
                    </div>
                    <p className="text-xs text-slate-500">Provide keys to allow the server and users to search/download stock content.</p>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pexels Key</label>
                            <a href="https://www.pexels.com/api/new/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Get Key</a>
                        </div>
                        <input type="text" value={settings.pexelsKey} onChange={e => setSettings({...settings, pexelsKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Your Pexels API Key"/>
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Pixabay Key</label>
                            <a href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline"><ExternalLink size={10}/> Get Key</a>
                        </div>
                        <input type="text" value={settings.pixabayKey} onChange={e => setSettings({...settings, pixabayKey: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Your Pixabay API Key"/>
                    </div>
                </div>
                
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Shield size={18} /> Maintenance</h3>
                     <button onClick={handleCleanup} className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-red-600/20">
                        <Trash2 size={18}/> Scan & Repair Broken Videos
                    </button>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} /> YouTube Integration (Advanced)</h3>
                    <p className="text-xs text-slate-500">Requires <code>yt-dlp</code> binary on the server.</p>

                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.enableYoutube} onChange={e => setSettings({...settings, enableYoutube: e.target.checked})} className="sr-only peer"/>
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-300">Enable YouTube</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">yt-dlp Binary Path</label>
                        <input type="text" value={settings.ytDlpPath} onChange={e => setSettings({...settings, ytDlpPath: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="./yt-dlp"/>
                        <p className="text-[10px] text-slate-500 mt-1">Default: <code>./yt-dlp</code> (Relative to api/ folder)</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18} /> Queue Controls</h3>
                    <div className="flex gap-2">
                        <button 
                           onClick={() => { setSettings({...settings, isQueuePaused: !settings.isQueuePaused}); saveSettings(); }}
                           className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${settings.isQueuePaused ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                        >
                            {settings.isQueuePaused ? <><Play size={18}/> Resume Queue</> : <><Pause size={18}/> Pause Queue</>}
                        </button>
                        <button onClick={triggerDownload} className="flex-1 bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                            <DownloadCloud size={18}/> Force Run
                        </button>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 bg-slate-950 p-2 rounded">
                        <span>Status: <strong>{settings.isQueuePaused ? 'PAUSED' : 'ACTIVE'}</strong></span>
                        <span>{requests.filter(r => r.status === 'PENDING').length} Pending</span>
                    </div>
                </div>
             </div>
         </div>
      )}

      {activeTab === 'USERS' && (
        <>
            <div className="flex justify-end">
                <button onClick={handleRepairDb} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2">
                    <Database size={14} /> Repair DB
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex-1 relative">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                </div>
                <div className="w-full md:w-48 flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Credit Amount:</span>
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
                    <th className="p-4">User</th>
                    <th className="p-4 text-right">Balance</th>
                    <th className="p-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loadingUsers ? (
                         <tr><td colSpan={3} className="p-10 text-center text-slate-500"><Loader2 className="animate-spin mx-auto"/> Loading users...</td></tr>
                    ) : (
                        filteredUsers.length === 0 ? (
                            <tr><td colSpan={3} className="p-10 text-center text-slate-500">No users found.</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                            <tr key={u.id}>
                                <td className="p-4 font-bold text-slate-200 flex items-center gap-2"><UserIcon size={16}/> {u.username} <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-500">{u.role}</span></td>
                                <td className="p-4 text-right font-mono text-indigo-300">{u.balance}</td>
                                <td className="p-4 flex justify-center">
                                    <button onClick={() => handleAddCredit(u.id, u.username)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                                        <PlusCircle size={16} /> Add {amount}
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
                             <PlusCircle size={16} /> Add {amount} Credits
                         </button>
                     </div>
                ))}
            </div>
        </>
      )}

    </div>
  );
}