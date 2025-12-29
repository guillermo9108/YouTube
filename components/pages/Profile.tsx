
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Transaction } from '../../types';
import { Wallet, Send, ArrowDownLeft, ArrowUpRight, History, Shield, LogOut, ChevronRight, User as UserIcon, RefreshCw, Smartphone, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const toast = useToast();
  
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [transferData, setTransferData] = useState({ target: '', amount: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
        db.request<Transaction[]>(`action=get_user_transactions&userId=${user.id}`).then(setTxHistory);
    }
  }, [user]);

  const handleTransfer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !transferData.target || !transferData.amount) return;
      
      setLoading(true);
      try {
          await db.transferBalance(user.id, transferData.target, parseFloat(transferData.amount));
          toast.success("Transferencia enviada correctamente");
          setTransferData({ target: '', amount: '' });
          refreshUser();
          // Recargar historial
          db.request<Transaction[]>(`action=get_user_transactions&userId=${user.id}`).then(setTxHistory);
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setLoading(false);
      }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 pb-24 max-w-4xl mx-auto px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Neo-Banking Wallet Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet size={120}/></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                  <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Saldo Total Disponible</p>
                  <h2 className="text-5xl font-black text-white tracking-tighter">
                      {Number(user.balance).toFixed(2)} <span className="text-xl font-medium opacity-60">$</span>
                  </h2>
                  <div className="mt-4 flex items-center gap-2 justify-center md:justify-start">
                    <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5">
                        <UserIcon size={10}/> @{user.username}
                    </span>
                    {user.vipExpiry && user.vipExpiry > Date.now()/1000 && (
                        <span className="bg-amber-400 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase">PASE VIP ACTIVO</span>
                    )}
                  </div>
              </div>
              <button onClick={refreshUser} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-90">
                  <RefreshCw size={24}/>
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Transfer Module */}
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Send size={20} className="text-indigo-400"/> Enviar Saldo (P2P)
              </h3>
              <form onSubmit={handleTransfer} className="space-y-5">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destinatario</label>
                      <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-500 font-bold">@</span>
                          <input 
                              type="text" 
                              placeholder="nombre_usuario"
                              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-8 pr-4 py-4 text-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                              value={transferData.target}
                              onChange={e => setTransferData({...transferData, target: e.target.value})}
                          />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cantidad a Enviar</label>
                      <input 
                          type="number" 
                          placeholder="0.00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white text-2xl font-black focus:border-indigo-500 outline-none transition-all shadow-inner"
                          value={transferData.amount}
                          onChange={e => setTransferData({...transferData, amount: e.target.value})}
                      />
                  </div>
                  <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/20">
                      <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500">Comisión de Red (5%):</span>
                          <span className="text-red-400">-{transferData.amount ? (parseFloat(transferData.amount)*0.05).toFixed(2) : '0.00'} $</span>
                      </div>
                      <div className="flex justify-between text-sm font-black mt-1">
                          <span className="text-slate-300">Total que llegará:</span>
                          <span className="text-emerald-400">{transferData.amount ? (parseFloat(transferData.amount)*0.95).toFixed(2) : '0.00'} $</span>
                      </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading || !transferData.amount}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      {loading ? <Loader2 className="animate-spin" /> : 'Realizar Envío Seguro'}
                  </button>
              </form>
          </div>

          {/* History Module */}
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-xl flex flex-col h-[500px]">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <History size={20} className="text-indigo-400"/> Movimientos
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
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
                                  <div>
                                      <p className="text-xs font-black text-white uppercase truncate max-w-[120px]">
                                          {tx.type === 'TRANSFER_SENT' ? `A @${tx.recipientName}` : (tx.type === 'TRANSFER_RECV' ? `DE @${tx.senderName}` : tx.type)}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-medium">{new Date(tx.timestamp * 1000).toLocaleDateString()}</p>
                                  </div>
                              </div>
                              <div className={`text-sm font-black ${isRecv ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isRecv ? '+' : '-'}{Number(tx.amount).toFixed(2)}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-800/50">
          <button onClick={logout} className="flex-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 font-bold py-4 rounded-2xl border border-red-900/30 flex items-center justify-center gap-2 transition-all">
              <LogOut size={20}/> Cerrar Sesión
          </button>
          <div className="flex-1 bg-slate-900 p-4 rounded-2xl flex items-center justify-between border border-slate-800">
                <div className="flex items-center gap-3">
                    <Smartphone size={20} className="text-slate-500"/>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID Dispositivo</p>
                        <p className="text-[10px] font-mono text-slate-400">{localStorage.getItem('sp_device_id')?.substring(0,20)}...</p>
                    </div>
                </div>
                <Shield size={20} className="text-emerald-500"/>
          </div>
      </div>
    </div>
  );
}
