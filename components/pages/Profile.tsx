
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Transaction } from '../../types';
import { Wallet, Send, ArrowDownLeft, ArrowUpRight, History, Shield, LogOut, ChevronRight, User as UserIcon, RefreshCw, Smartphone, Loader2, Settings, Save, Zap, Heart, Truck, Camera, Lock, Eye, EyeOff, UserCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const toast = useToast();
  
  const [activeSubTab, setActiveSubTab] = useState<'WALLET' | 'SETTINGS' | 'HISTORY'>('WALLET');
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [transferData, setTransferData] = useState({ target: '', amount: '' });
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // User Settings State
  const [settings, setSettings] = useState({
      autoPurchaseLimit: user?.autoPurchaseLimit || 1.00,
      newPassword: '',
      confirmPassword: '',
      avatar: null as File | null
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user) {
        db.request<Transaction[]>(`action=get_user_transactions&userId=${user.id}`).then(setTxHistory);
        setSettings(prev => ({
            ...prev,
            autoPurchaseLimit: user.autoPurchaseLimit
        }));
        setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  // Manejador de búsqueda de usuarios (Debounced)
  const searchTimeout = useRef<any>(null);
  const handleTargetChange = (val: string) => {
      setTransferData({...transferData, target: val});
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      
      if (val.length < 2) {
          setUserSuggestions([]);
          return;
      }

      searchTimeout.current = setTimeout(async () => {
          if (!user) return;
          const hits = await db.searchUsers(user.id, val);
          setUserSuggestions(hits);
      }, 300);
  };

  const handleTransfer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !transferData.target || !transferData.amount) return;
      setLoading(true);
      try {
          await db.transferBalance(user.id, transferData.target, parseFloat(transferData.amount));
          toast.success("Transferencia enviada correctamente");
          setTransferData({ target: '', amount: '' });
          setUserSuggestions([]);
          refreshUser();
          db.request<Transaction[]>(`action=get_user_transactions&userId=${user.id}`).then(setTxHistory);
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
  };

  const handleSaveSettings = async () => {
      if (!user) return;
      
      if (settings.newPassword && settings.newPassword !== settings.confirmPassword) {
          toast.error("Las contraseñas no coinciden");
          return;
      }

      setLoading(true);
      try {
          await db.updateUserProfile(user.id, {
              autoPurchaseLimit: settings.autoPurchaseLimit,
              newPassword: settings.newPassword,
              avatar: settings.avatar,
              shippingDetails: user.shippingDetails // Mantener los actuales
          });
          toast.success("Perfil actualizado correctamente");
          setSettings(p => ({...p, newPassword: '', confirmPassword: '', avatar: null}));
          refreshUser();
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
  };

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setSettings({...settings, avatar: file});
          setAvatarPreview(URL.createObjectURL(file));
      }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Neo-Banking Wallet Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet size={120}/></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left flex flex-col md:flex-row items-center gap-6">
                  <div className="relative group">
                      <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-slate-800 shadow-2xl">
                          {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/20">{user.username[0]}</div>}
                      </div>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Saldo Disponible</p>
                    <h2 className="text-5xl font-black text-white tracking-tighter">
                        {Number(user.balance).toFixed(2)} <span className="text-xl font-medium opacity-60">$</span>
                    </h2>
                    <div className="mt-4 flex items-center gap-2 justify-center md:justify-start">
                        <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5">
                            <UserIcon size={10}/> @{user.username}
                        </span>
                        {user.vipExpiry && user.vipExpiry > Date.now()/1000 && (
                            <span className="bg-amber-400 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg shadow-amber-500/20">VIP</span>
                        )}
                    </div>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={refreshUser} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white backdrop-blur-md transition-all active:scale-90">
                      <RefreshCw size={24}/>
                  </button>
                  <button onClick={() => setActiveSubTab('SETTINGS')} className={`p-4 rounded-2xl backdrop-blur-md transition-all active:scale-90 ${activeSubTab === 'SETTINGS' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      <Settings size={24}/>
                  </button>
              </div>
          </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button onClick={() => setActiveSubTab('WALLET')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'WALLET' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Transferir</button>
          <button onClick={() => setActiveSubTab('HISTORY')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'HISTORY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Historial</button>
          <button onClick={() => setActiveSubTab('SETTINGS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'SETTINGS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Ajustes</button>
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
          {activeSubTab === 'WALLET' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Send size={20} className="text-indigo-400"/> Transferencia Segura
                </h3>
                <form onSubmit={handleTransfer} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destinatario</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-500 font-bold">@</span>
                                <input 
                                    type="text" placeholder="nombre_usuario"
                                    autoComplete="off"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-8 pr-4 py-4 text-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                                    value={transferData.target}
                                    onChange={e => handleTargetChange(e.target.value)}
                                />
                            </div>
                            
                            {/* Sugerencias de Usuarios */}
                            {userSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top">
                                    {userSuggestions.map(s => (
                                        <button 
                                            key={s.username} type="button"
                                            onClick={() => { setTransferData({...transferData, target: s.username}); setUserSuggestions([]); }}
                                            className="w-full p-3 flex items-center gap-3 hover:bg-indigo-600 transition-colors border-b border-white/5 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 shrink-0">
                                                {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/20">{s.username[0]}</div>}
                                            </div>
                                            <span className="text-sm font-bold text-white">@{s.username}</span>
                                            <UserCheck size={14} className="ml-auto opacity-30"/>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto $</label>
                            <input 
                                type="number" placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white text-2xl font-black focus:border-indigo-500 outline-none transition-all shadow-inner"
                                value={transferData.amount}
                                onChange={e => setTransferData({...transferData, amount: e.target.value})}
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading || !transferData.amount || !transferData.target} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" /> : <Shield size={18}/>}
                        Confirmar Envío
                    </button>
                </form>
              </div>
          )}

          {activeSubTab === 'HISTORY' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl flex flex-col h-[500px]">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <History size={20} className="text-indigo-400"/> Actividad Reciente
                </h3>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {txHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                            <History size={48} className="mb-4" />
                            <p className="text-sm font-bold uppercase tracking-tighter">Sin movimientos</p>
                        </div>
                    ) : txHistory.map(tx => {
                        const isRecv = tx.type === 'TRANSFER_RECV' || tx.type === 'DEPOSIT' || tx.creatorId === user.id;
                        return (
                            <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${isRecv ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {isRecv ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white uppercase truncate">
                                            {tx.type === 'TRANSFER_SENT' ? `A @${tx.recipientName}` : (tx.type === 'TRANSFER_RECV' ? `DE @${tx.senderName}` : tx.type)}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-medium">{new Date(tx.timestamp * 1000).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className={`text-sm font-black whitespace-nowrap ${isRecv ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isRecv ? '+' : '-'}{Number(tx.amount).toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
          )}

          {activeSubTab === 'SETTINGS' && (
              <div className="space-y-6">
                  {/* Perfil & Avatar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
                      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Camera size={20} className="text-indigo-400"/> Identidad Visual</h3>
                      <div className="flex flex-col items-center gap-6">
                         <div className="relative group">
                            <div className="w-32 h-32 rounded-full border-4 border-indigo-500/30 overflow-hidden bg-slate-950 shadow-2xl relative">
                                {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : null}
                                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                                    <Camera size={32} className="text-white mb-1"/>
                                    <span className="text-[10px] font-black text-white uppercase">Cambiar</span>
                                    <input type="file" accept="image/*" onChange={onAvatarFileChange} className="hidden" />
                                </label>
                            </div>
                         </div>
                         <p className="text-center text-xs text-slate-500 italic max-w-xs">Tu avatar es tu carta de presentación en el Marketplace y la Comunidad.</p>
                      </div>
                  </div>

                  {/* Seguridad */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
                      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Lock size={20} className="text-red-400"/> Seguridad de la Cuenta</h3>
                      <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <input 
                                    type={showPass ? 'text' : 'password'} placeholder="Nueva Contraseña"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                    value={settings.newPassword}
                                    onChange={e => setSettings({...settings, newPassword: e.target.value})}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-3.5 text-slate-600">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                            </div>
                            <input 
                                type={showPass ? 'text' : 'password'} placeholder="Confirmar Nueva Contraseña"
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                value={settings.confirmPassword}
                                onChange={e => setSettings({...settings, confirmPassword: e.target.value})}
                            />
                          </div>
                          {settings.newPassword && settings.newPassword.length < 6 && <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Mínimo 6 caracteres sugeridos</p>}
                      </div>
                  </div>
                  
                  {/* Auto-Purchase Config */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl space-y-8">
                      <div className="flex justify-between items-center">
                          <div>
                              <h4 className="text-sm font-black text-white uppercase flex items-center gap-2"><Zap size={14} className="text-amber-400"/> Auto-Desbloqueo</h4>
                              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Presupuesto por episodio de serie</p>
                          </div>
                          <span className="text-xl font-black text-indigo-400">{settings.autoPurchaseLimit} $</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="0.5" 
                        value={settings.autoPurchaseLimit} 
                        onChange={e => setSettings({...settings, autoPurchaseLimit: parseFloat(e.target.value)})}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                      />
                  </div>

                  <button 
                    onClick={handleSaveSettings} 
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-[24px] shadow-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                      {loading ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
                      Sincronizar y Guardar Cambios
                  </button>
              </div>
          )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-800/50">
          <button onClick={logout} className="flex-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 font-bold py-4 rounded-2xl border border-red-900/30 flex items-center justify-center gap-2 transition-all">
              <LogOut size={20}/> Cerrar Sesión Segura
          </button>
          <div className="flex-1 bg-slate-900 p-4 rounded-2xl flex items-center justify-between border border-slate-800">
                <div className="flex items-center gap-3">
                    <Smartphone size={20} className="text-slate-500"/>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dispositivo</p>
                        <p className="text-[10px] font-mono text-slate-400">{user.lastDeviceId || 'Desconocido'}</p>
                    </div>
                </div>
                <Shield size={20} className="text-emerald-500"/>
          </div>
      </div>
    </div>
  );
}
