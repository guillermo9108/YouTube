import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../services/db';
import { Wallet, History, Settings2, Clock, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Video } from '../types';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [bulkPrice, setBulkPrice] = useState<number>(1);
  const [showBulk, setShowBulk] = useState(false);
  const [autoLimit, setAutoLimit] = useState<number>(1);
  const [watchLaterVideos, setWatchLaterVideos] = useState<Video[]>([]);

  useEffect(() => {
    if (user) {
      setAutoLimit(user.autoPurchaseLimit);
      const videos = user.watchLater.map(id => db.getVideo(id)).filter(v => v !== undefined) as Video[];
      setWatchLaterVideos(videos);
    }
  }, [user]);

  if (!user) return null;

  const transactions = db.getUserTransactions(user.id);
  const myVideos = db.getVideosByCreator(user.id);

  const handleBulkUpdate = async () => {
     if (confirm(`Are you sure you want to set ALL your videos to ${bulkPrice} Saldo?`)) {
       await db.updatePricesBulk(user.id, bulkPrice);
       alert("Prices updated!");
       setShowBulk(false);
       refreshUser();
     }
  };

  const handleAutoLimitChange = async () => {
    await db.updateUserProfile(user.id, { autoPurchaseLimit: autoLimit });
    refreshUser();
    alert("Auto-purchase limit updated.");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 underline">Logout</button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-indigo-300 mb-1">
            <Wallet size={18} />
            <span className="font-medium uppercase tracking-wide text-xs">Current Balance</span>
          </div>
          <div className="text-4xl font-mono font-bold text-white tracking-tight">
            {user.balance} <span className="text-lg text-slate-400">SALDO</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">ID: <span className="font-mono text-slate-500">{user.id}</span></p>
        </div>
      </div>

      {/* Settings Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auto Purchase Limit */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
           <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
             <PlayCircle size={16} className="text-indigo-400" /> Auto-Purchase Limit
           </h3>
           <p className="text-xs text-slate-500 mb-3">Max price to auto-buy during continuous playback.</p>
           <div className="flex gap-2">
              <input 
                type="number" 
                min="0"
                value={autoLimit}
                onChange={(e) => setAutoLimit(parseInt(e.target.value))}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
              <button 
                onClick={handleAutoLimitChange}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Save
              </button>
           </div>
        </div>

        {/* Bulk Action */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center cursor-pointer mb-2" onClick={() => setShowBulk(!showBulk)}>
             <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
               <Settings2 size={16} className="text-indigo-400" /> Bulk Pricing
             </div>
             <span className="text-indigo-400 text-xs">{showBulk ? 'Close' : 'Open'}</span>
          </div>
          
          {showBulk ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-2">Set price for all {myVideos.length} videos.</p>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  min="1"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(parseInt(e.target.value))}
                  className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
                <button 
                  onClick={handleBulkUpdate}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Update all your video prices at once.</p>
          )}
        </div>
      </div>

      {/* Watch Later */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={18} /> Watch Later
        </h3>
        {watchLaterVideos.length === 0 ? (
           <div className="bg-slate-900 rounded-xl p-6 text-center text-slate-500 text-sm border border-slate-800">
             Your list is empty.
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-3">
             {watchLaterVideos.map(v => (
               <Link key={v.id} to={`/watch/${v.id}`} className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 hover:border-indigo-500 transition-colors">
                  <img src={v.thumbnailUrl} alt={v.title} className="w-16 h-10 object-cover rounded bg-slate-800" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-200 truncate">{v.title}</h4>
                    <p className="text-xs text-slate-500">{v.creatorName}</p>
                  </div>
                  <div className="text-xs font-bold text-amber-400">{v.price} $</div>
               </Link>
             ))}
           </div>
        )}
      </div>

      {/* Transactions */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <History size={18} /> Transaction History
        </h3>
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-h-60 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map(tx => {
                const isIncoming = tx.type === 'DEPOSIT' || tx.creatorId === user.id;
                const isSystem = tx.type === 'DEPOSIT';
                
                return (
                  <div key={tx.id} className="p-4 flex justify-between items-center">
                    <div>
                       <div className="font-medium text-slate-200 text-sm">
                         {isSystem ? 'Admin Deposit' : (isIncoming ? 'Video Sold' : 'Video Purchase')}
                       </div>
                       <div className="text-xs text-slate-500">
                         {new Date(tx.timestamp).toLocaleString()}
                       </div>
                    </div>
                    <div className={`font-mono font-bold text-sm ${isIncoming ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIncoming ? '+' : '-'}{tx.amount}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}