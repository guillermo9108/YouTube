

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from '../components/Router';
import { db } from '../services/db';
import { Wallet, History, Settings2, Clock, PlayCircle, DownloadCloud, ChevronRight, Camera, Shield, User as UserIcon, Tag, Save, Truck, PlusCircle } from 'lucide-react';
import { Video, Transaction, VideoCategory } from '../types';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [bulkPrice, setBulkPrice] = useState<number>(1);
  const [showBulk, setShowBulk] = useState(false);
  const [autoLimit, setAutoLimit] = useState<number>(1);
  const [watchLaterVideos, setWatchLaterVideos] = useState<Video[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  
  // Balance Request
  const [showRequestBalance, setShowRequestBalance] = useState(false);
  const [reqAmount, setReqAmount] = useState<number>(100);

  // Security Tab
  const [tab, setTab] = useState<'OVERVIEW' | 'SECURITY' | 'PRICING' | 'SHIPPING'>('OVERVIEW');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  // Shipping Tab
  const [shipping, setShipping] = useState({
      fullName: '',
      address: '',
      city: '',
      zipCode: '',
      country: '',
      phoneNumber: ''
  });

  // Pricing Tab
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));

  useEffect(() => {
    if (user) {
      setAutoLimit(user.autoPurchaseLimit);
      setDefaultPrices(user.defaultPrices || {});
      if (user.shippingDetails) setShipping(user.shippingDetails);
      
      // Async fetches
      Promise.all(user.watchLater.map(id => db.getVideo(id))).then(res => {
          setWatchLaterVideos(res.filter(v => !!v) as Video[]);
      });

      db.getUserTransactions(user.id).then(setTransactions);
      db.getVideosByCreator(user.id).then(setMyVideos);
      
      // Fetch custom categories
      db.getSystemSettings().then(s => {
          if (s.customCategories) {
              setAvailableCategories([...Object.values(VideoCategory), ...s.customCategories]);
          }
      });
    }
  }, [user]);

  if (!user) return null;

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

  const savePricingConfig = async () => {
      await db.updateUserProfile(user.id, { defaultPrices });
      refreshUser();
      alert("Default pricing preferences saved!");
  };

  const saveShipping = async () => {
      await db.updateUserProfile(user.id, { shippingDetails: shipping });
      refreshUser();
      alert("Shipping details saved!");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              await db.uploadAvatar(user.id, file);
              refreshUser();
          } catch(e: any) {
              alert("Avatar upload failed: " + e.message);
          }
      }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if(newPass !== confirmPass) { setPassMsg("Passwords do not match"); return; }
      if(!oldPass || !newPass) { setPassMsg("All fields required"); return; }
      
      try {
          await db.changePassword(user.id, oldPass, newPass);
          setPassMsg("Password changed successfully!");
          setOldPass(''); setNewPass(''); setConfirmPass('');
      } catch(e: any) {
          setPassMsg(e.message);
      }
  };

  const requestBalance = async () => {
      if (reqAmount <= 0) return;
      try {
          await db.requestBalance(user.id, reqAmount);
          alert("Request sent! An admin will review it shortly.");
          setShowRequestBalance(false);
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 underline">Logout</button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          <button onClick={() => setTab('OVERVIEW')} className={`flex-1 py-2 px-3 text-sm font-bold rounded flex items-center justify-center gap-2 whitespace-nowrap ${tab==='OVERVIEW'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <UserIcon size={16}/> Overview
          </button>
          <button onClick={() => setTab('PRICING')} className={`flex-1 py-2 px-3 text-sm font-bold rounded flex items-center justify-center gap-2 whitespace-nowrap ${tab==='PRICING'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Tag size={16}/> Pricing
          </button>
          <button onClick={() => setTab('SHIPPING')} className={`flex-1 py-2 px-3 text-sm font-bold rounded flex items-center justify-center gap-2 whitespace-nowrap ${tab==='SHIPPING'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Truck size={16}/> Shipping
          </button>
          <button onClick={() => setTab('SECURITY')} className={`flex-1 py-2 px-3 text-sm font-bold rounded flex items-center justify-center gap-2 whitespace-nowrap ${tab==='SECURITY'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Shield size={16}/> Security
          </button>
      </div>

      {tab === 'OVERVIEW' && (
      <>
        {/* Profile Card & Avatar */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
            <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-500/50 overflow-hidden bg-black/50">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover"/>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-indigo-200 font-bold text-2xl">{user.username[0]}</div>
                    )}
                </div>
                <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera size={24} className="text-white"/>
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange}/>
                </label>
            </div>
            
            <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-300 mb-1">
                    <Wallet size={18} />
                    <span className="font-medium uppercase tracking-wide text-xs">Current Balance</span>
                </div>
                <div className="text-4xl font-mono font-bold text-white tracking-tight flex flex-col md:flex-row items-center gap-4">
                    <span>{user.balance} <span className="text-lg text-slate-400">SALDO</span></span>
                    <button onClick={() => setShowRequestBalance(true)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1">
                        <PlusCircle size={14}/> Request
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">@{user.username}</p>
            </div>
        </div>

        {/* Request Content Button */}
        <Link to="/requests" className="block bg-slate-900 p-5 rounded-2xl border border-slate-800 hover:border-red-500/50 hover:bg-slate-900/80 transition-all group shadow-lg">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/20 group-hover:scale-110 transition-transform">
                        <DownloadCloud size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Request Content</h3>
                        <p className="text-slate-400 text-sm">Ask for videos from YouTube</p>
                    </div>
                </div>
                <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" />
            </div>
        </Link>

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
      </>
      )}

      {tab === 'PRICING' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                  <div>
                      <h3 className="font-bold text-white">Default Upload Prices</h3>
                      <p className="text-xs text-slate-400">Set your preferred price for each category. These will be auto-filled when you upload.</p>
                  </div>
                  <button onClick={savePricingConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Save size={16}/> Save
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableCategories.map(cat => (
                      <div key={cat} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300 uppercase">{cat.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Price:</span>
                              <input 
                                type="number" 
                                min="0" 
                                className="w-16 bg-slate-900 border border-slate-700 rounded text-center text-amber-400 font-bold py-1 focus:border-indigo-500 outline-none"
                                value={defaultPrices[cat] ?? ''}
                                placeholder="Auto"
                                onChange={(e) => setDefaultPrices({...defaultPrices, [cat]: parseInt(e.target.value) || 0})}
                              />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {tab === 'SHIPPING' && (
           <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="font-bold text-white flex items-center gap-2"><Truck size={18}/> Default Shipping Address</h3>
                      <p className="text-xs text-slate-400">These details will be pre-filled when you purchase items from the marketplace.</p>
                  </div>
                  <button onClick={saveShipping} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Save size={16}/> Save Changes
                  </button>
                </div>
                
                <div className="space-y-4 max-w-lg">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                        <input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                        <input type="text" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                            <input type="text" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zip Code</label>
                            <input type="text" value={shipping.zipCode} onChange={e => setShipping({...shipping, zipCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                        <input type="text" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                    </div>
                </div>
           </div>
      )}

      {tab === 'SECURITY' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="font-bold text-white mb-4">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Current Password</label>
                      <input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">New Password</label>
                      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Confirm New Password</label>
                      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  {passMsg && <div className="text-xs font-bold text-indigo-400">{passMsg}</div>}
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg">Update Password</button>
              </form>
          </div>
      )}

      {/* Request Balance Modal */}
      {showRequestBalance && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-sm p-6 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-white mb-2">Request Saldo</h3>
                  <p className="text-slate-400 text-sm mb-4">Need more funds? Request a balance top-up from the admin.</p>
                  
                  <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase">Amount Needed</label>
                      <input 
                        type="number" 
                        value={reqAmount} 
                        onChange={e => setReqAmount(Math.max(1, parseInt(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-lg font-bold mt-1"
                      />
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowRequestBalance(false)} className="flex-1 py-3 rounded-lg font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
                      <button onClick={requestBalance} className="flex-1 py-3 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">Send Request</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}