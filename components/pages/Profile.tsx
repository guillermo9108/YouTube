
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from '../Router';
import { db } from '../../services/db';
import { SaleRecord, Video, Transaction, VideoCategory } from '../../types';
import { Wallet, History, Settings2, Clock, PlayCircle, DownloadCloud, ChevronRight, Camera, Shield, User as UserIcon, Tag, Save, Truck, PlusCircle, Package, MapPin, Phone, TrendingUp, Video as VideoIcon, DollarSign, Upload, Send, ArrowRightLeft, RefreshCw, Loader2, Crown, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const toast = useToast();
  
  const [bulkPrice, setBulkPrice] = useState<number>(1);
  const [showBulk, setShowBulk] = useState(false);
  const [autoLimit, setAutoLimit] = useState<number>(1);
  const [watchLaterVideos, setWatchLaterVideos] = useState<Video[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  
  const [showRequestBalance, setShowRequestBalance] = useState(false);
  const [reqAmount, setReqAmount] = useState<number>(100);

  // Transfer State
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const [tab, setTab] = useState<'OVERVIEW' | 'SALES' | 'SECURITY' | 'PRICING' | 'SHIPPING'>('OVERVIEW');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [shipping, setShipping] = useState({ fullName: '', address: '', city: '', zipCode: '', country: '', phoneNumber: '' });
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));

  useEffect(() => {
    if (user) {
      setAutoLimit(user.autoPurchaseLimit);
      setDefaultPrices(user.defaultPrices || {});
      if (user.shippingDetails) setShipping(user.shippingDetails);
      Promise.all(user.watchLater.map((id: string) => db.getVideo(id))).then(res => setWatchLaterVideos(res.filter(v => !!v) as Video[]));
      db.getUserTransactions(user.id).then(setTransactions);
      db.getVideosByCreator(user.id).then(setMyVideos);
      db.getSystemSettings().then(s => { if (s.customCategories) setAvailableCategories([...Object.values(VideoCategory), ...s.customCategories]); });
    }
  }, [user]);

  useEffect(() => { if (user && (tab === 'SALES' || tab === 'OVERVIEW')) db.getSales(user.id).then(setSales); }, [user, tab]);

  const stats = useMemo(() => {
      const totalSpent = transactions.filter(t => (t.type === 'PURCHASE' || t.type === 'TRANSFER_SENT') && t.buyerId === user?.id).reduce((acc, t) => acc + Number(t.amount), 0);
      const totalEarned = sales.reduce((acc, s) => acc + (Number(s.amount) - Number(s.adminFee || 0)), 0);
      return { totalSpent, totalEarned };
  }, [transactions, sales, user]);

  if (!user) return null;

  const handleTransfer = async () => {
      if (!transferTarget || !transferAmount || isTransferring) return;
      const amt = parseFloat(transferAmount);
      if (amt > user.balance) { toast.error("Saldo insuficiente"); return; }
      
      setIsTransferring(true);
      try {
          const res = await db.transferBalance(user.id, user.username, transferTarget.replace('@',''), amt);
          toast.success(`Transferencia enviada. Recibido neto: ${res.netAmount} $`);
          setShowTransfer(false);
          setTransferAmount(''); setTransferTarget('');
          refreshUser();
          db.getUserTransactions(user.id).then(setTransactions);
      } catch (e: any) {
          toast.error(e.message);
      } finally { setIsTransferring(false); }
  };

  const handleBulkUpdate = async () => {
     if (confirm(`Are you sure you want to set ALL your videos to ${bulkPrice} Saldo?`)) {
       await db.updatePricesBulk(user.id, bulkPrice);
       toast.success("Precios actualizados");
       setShowBulk(false);
       refreshUser();
     }
  };

  const handleAutoLimitChange = async () => {
    await db.updateUserProfile(user.id, { autoPurchaseLimit: autoLimit });
    refreshUser();
    toast.success("Límite actualizado");
  };

  const savePricingConfig = async () => { await db.updateUserProfile(user.id, { defaultPrices }); refreshUser(); toast.success("Guardado"); };
  const saveShipping = async () => { await db.updateUserProfile(user.id, { shippingDetails: shipping }); refreshUser(); toast.success("Guardado"); };
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { try { await db.uploadAvatar(user.id, e.target.files[0]); refreshUser(); toast.success("Avatar actualizado"); } catch(e: any) { toast.error(e.message); } } };

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if(newPass !== confirmPass) { toast.error("No coinciden"); return; }
      try { await db.changePassword(user.id, oldPass, newPass); toast.success("Contraseña cambiada"); setOldPass(''); setNewPass(''); setConfirmPass(''); } catch(e: any) { toast.error(e.message); }
  };

  const requestBalance = async () => {
      if (reqAmount <= 0) return;
      try { await db.requestBalance(user.id, reqAmount); toast.success("Solicitud enviada"); setShowRequestBalance(false); } catch (e: any) { toast.error(e.message); }
  };

  const markShipped = async (txId: string) => {
      try { await db.updateOrderStatus(user.id, txId, 'SHIPPED'); setSales(prev => prev.map(s => s.id === txId ? {...s, fulfillmentStatus: 'SHIPPED'} : s)); toast.success("ENVIADO"); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Mi Perfil</h2>
        <button onClick={logout} className="text-xs font-black uppercase text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">Cerrar Sesión</button>
      </div>

      <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide shadow-xl">
          <button onClick={() => setTab('OVERVIEW')} className={`flex-1 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-all ${tab==='OVERVIEW'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>
              <UserIcon size={14}/> General
          </button>
          <button onClick={() => setTab('SALES')} className={`flex-1 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-all ${tab==='SALES'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>
              <Package size={14}/> Ventas
          </button>
          <button onClick={() => setTab('PRICING')} className={`flex-1 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-all ${tab==='PRICING'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>
              <Tag size={14}/> Precios
          </button>
          <button onClick={() => setTab('SHIPPING')} className={`flex-1 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-all ${tab==='SHIPPING'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>
              <Truck size={14}/> Envío
          </button>
          <button onClick={() => setTab('SECURITY')} className={`flex-1 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-all ${tab==='SECURITY'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>
              <Shield size={14}/> Seguridad
          </button>
      </div>

      {tab === 'OVERVIEW' && (
      <>
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(79,70,229,0.1),transparent)] group-hover:opacity-100 transition-opacity"></div>
            <div className="relative group shrink-0">
                <div className="w-28 h-28 rounded-[35px] border-4 border-indigo-500/20 overflow-hidden bg-black shadow-2xl transform transition-transform group-hover:rotate-3 group-hover:scale-105">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-indigo-400 font-black text-4xl italic">{user.username[0]}</div>}
                </div>
                <label className="absolute inset-0 bg-black/60 rounded-[35px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all backdrop-blur-sm">
                    <Camera size={24} className="text-white"/>
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange}/>
                </label>
            </div>
            
            <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-400 mb-1">
                    <Wallet size={16} />
                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Capital Disponible</span>
                </div>
                <div className="text-5xl font-black text-white tracking-tighter flex flex-col md:flex-row items-center gap-4">
                    <span>{Number(user.balance).toFixed(2)} <span className="text-xl text-slate-500 tracking-normal">$</span></span>
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-6">
                    <button onClick={() => setShowRequestBalance(true)} className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                        <PlusCircle size={14}/> Recargar
                    </button>
                    <button onClick={() => setShowTransfer(true)} className="text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-indigo-400 px-5 py-2.5 rounded-xl flex items-center gap-2 border border-slate-700 active:scale-95 transition-all">
                        <ArrowRightLeft size={14}/> Transferir
                    </button>
                    <Link to="/vip" className="text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                        <Crown size={14}/> Pase VIP
                    </Link>
                </div>
            </div>
        </div>

        {showTransfer && (
            <div className="bg-slate-900/50 p-6 rounded-[30px] border border-white/5 shadow-xl animate-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2"><Send size={16} className="text-indigo-400"/> Enviar Saldo P2P</h4>
                    <button onClick={() => setShowTransfer(false)} className="text-slate-500 hover:text-white p-1"><X size={18}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Destinatario (@usuario)</label>
                        <div className="relative">
                            <UserIcon size={14} className="absolute left-4 top-3.5 text-slate-600"/>
                            <input type="text" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Nombre de usuario..." />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Monto a Enviar</label>
                        <div className="relative">
                            <DollarSign size={14} className="absolute left-4 top-3.5 text-slate-600"/>
                            <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:border-indigo-500 outline-none font-mono" placeholder="0.00" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex justify-between items-center">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fee de Red (Aprox 5%)</div>
                    <div className="text-xs font-mono font-bold text-indigo-400">-{ (parseFloat(transferAmount) * 0.05 || 0).toFixed(2) } $</div>
                </div>
                <button onClick={handleTransfer} disabled={isTransferring || !transferTarget || !transferAmount} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-900/20 active:scale-95 text-xs uppercase tracking-widest">
                    {isTransferring ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16}/>}
                    Confirmar Envío Seguro
                </button>
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-xl">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Subidos</div>
                <div className="text-2xl font-black text-white">{myVideos.length} <span className="text-xs text-slate-600 ml-1">Vids</span></div>
            </div>
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-xl">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ganado</div>
                <div className="text-2xl font-black text-emerald-400">+{stats.totalEarned.toFixed(0)} <span className="text-xs opacity-50">$</span></div>
            </div>
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-xl col-span-2 md:col-span-1">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Inversión</div>
                <div className="text-2xl font-black text-slate-300">-{stats.totalSpent.toFixed(0)} <span className="text-xs opacity-50">$</span></div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col max-h-[500px] shadow-2xl">
                <div className="p-5 border-b border-white/5 bg-slate-950/40 flex justify-between items-center backdrop-blur-md">
                    <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] flex items-center gap-2"><VideoIcon size={16} className="text-indigo-400"/> Mis Contenidos</h3>
                    <Link to="/upload" className="text-[9px] font-black uppercase tracking-widest bg-indigo-600/20 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all">Nuevo Video</Link>
                </div>
                {myVideos.length === 0 ? <div className="p-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest opacity-30 italic">Vacío</div> : (
                    <div className="overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar">
                        {myVideos.map(v => (
                            <div key={v.id} className="flex gap-3 bg-slate-950/50 p-3 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group">
                                <div className="w-20 h-12 bg-black rounded-lg overflow-hidden shrink-0 relative"><img src={v.thumbnailUrl} className="w-full h-full object-cover opacity-80" /></div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="text-xs font-black text-white truncate uppercase tracking-tighter">{v.title}</div>
                                    <div className="flex items-center gap-3 text-[9px] text-slate-500 font-bold">
                                        <span>{v.views} vistas</span>
                                        <span className="text-emerald-400">{v.price} $</span>
                                    </div>
                                </div>
                                <Link to={`/watch/${v.id}`} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors"><ChevronRight size={16}/></Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col max-h-[500px] shadow-2xl">
                <div className="p-5 border-b border-white/5 bg-slate-950/40 font-black text-xs text-white uppercase tracking-[0.2em] flex items-center gap-2 backdrop-blur-md"><History size={16} className="text-emerald-400"/> Actividad Financiera</div>
                <div className="overflow-y-auto p-0 flex-1 custom-scrollbar">
                    {transactions.length === 0 ? <div className="p-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest opacity-30 italic">Sin movimientos</div> : (
                        <div className="divide-y divide-white/5">
                        {transactions.map((tx: Transaction) => {
                            const isIncoming = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_RECV' || tx.creatorId === user.id;
                            // Fix: Adjusted comparison logic as 'TRANSFER' is not a valid transaction type based on Transaction['type']
                            const isTransfer = tx.type === 'TRANSFER_SENT' || tx.type === 'TRANSFER_RECV';
                            const targetName = (tx as any).targetName || (tx as any).targetId;

                            return (
                                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                                    <div>
                                        <div className="font-black text-white text-[10px] uppercase tracking-widest mb-0.5">
                                            {tx.type === 'DEPOSIT' ? 'Recarga Directa' : (tx.type === 'MARKETPLACE' ? (isIncoming ? 'Venta Tienda' : 'Compra Tienda') : (isTransfer ? (isIncoming ? `Recibido de @${targetName}` : `Enviado a @${targetName}`) : (isIncoming ? 'Venta Video' : 'Compra Video')))}
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{new Date(tx.timestamp * 1000).toLocaleDateString()}</div>
                                    </div>
                                    <div className={`font-mono font-black text-xs ${isIncoming ? 'text-emerald-400' : 'text-red-500'}`}>
                                        {isIncoming ? '+' : '-'}{Number(tx.amount).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </>
      )}

      {tab === 'SALES' && (
          <div className="space-y-4 animate-in fade-in">
              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4 uppercase tracking-widest"><Package size={20} className="text-indigo-400"/> Pedidos Recibidos</h3>
              {sales.length === 0 ? <div className="text-center p-20 bg-slate-900 rounded-3xl border border-slate-800 text-slate-500 italic uppercase font-bold text-xs tracking-widest opacity-50">Sin ventas aún</div> : (
                  <div className="space-y-4">
                      {sales.map((sale: SaleRecord) => {
                          const net = Number(sale.amount) - Number(sale.adminFee || 0);
                          return (
                          <div key={sale.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl group transition-all hover:border-indigo-500/30">
                              <div className="p-5 flex gap-5 cursor-pointer" onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}>
                                  <div className="w-16 h-16 bg-black rounded-2xl shrink-0 overflow-hidden border border-white/5">{sale.itemImage && <img src={sale.itemImage} className="w-full h-full object-cover"/>}</div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start"><h4 className="font-black text-white truncate text-sm uppercase tracking-tighter">{sale.itemTitle}</h4><span className="font-mono text-emerald-400 font-black text-sm">+{net.toFixed(2)} $</span></div>
                                      <div className="flex items-center gap-2 mt-1"><div className="w-5 h-5 rounded-lg overflow-hidden bg-slate-800 border border-white/5">{sale.buyerAvatar && <img src={sale.buyerAvatar} className="w-full h-full object-cover"/>}</div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">@{sale.buyerName}</span></div>
                                      <div className="flex justify-between items-center mt-3"><span className="text-[9px] font-black text-slate-600 uppercase">{new Date(sale.timestamp * 1000).toLocaleDateString()}</span><span className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-widest ${sale.fulfillmentStatus === 'SHIPPED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{sale.fulfillmentStatus === 'SHIPPED' ? 'ENVIADO' : 'PENDIENTE'}</span></div>
                                  </div>
                              </div>
                              {expandedSale === sale.id && (
                                  <div className="border-t border-white/5 p-6 bg-slate-950/50 animate-in slide-in-from-top-2">
                                      <div className="bg-slate-900 rounded-2xl p-4 mb-6 border border-white/5 text-[10px] font-bold uppercase tracking-widest">
                                          <div className="flex justify-between text-slate-500 mb-1"><span>Precio Bruto:</span><span>{Number(sale.amount).toFixed(2)} $</span></div>
                                          <div className="flex justify-between text-red-500 mb-1"><span>Comisión:</span><span>-{Number(sale.adminFee).toFixed(2)} $</span></div>
                                          <div className="flex justify-between text-emerald-400 pt-2 border-t border-white/5 mt-2"><span>Tu Ganancia:</span><span>{net.toFixed(2)} $</span></div>
                                      </div>
                                      {sale.shippingData ? (
                                          <div className="space-y-4 text-xs">
                                              <div className="flex items-start gap-3 text-slate-300"><UserIcon size={16} className="text-indigo-400 shrink-0"/><span className="font-black text-white uppercase tracking-widest">{sale.shippingData.fullName}</span></div>
                                              <div className="flex items-start gap-3 text-slate-300"><MapPin size={16} className="text-indigo-400 shrink-0"/><div><span className="block font-medium">{sale.shippingData.address}</span><span className="block text-slate-500 mt-1 uppercase font-bold">{sale.shippingData.city}, {sale.shippingData.zipCode}</span></div></div>
                                              <div className="flex items-center gap-3 text-slate-300"><Phone size={16} className="text-indigo-400 shrink-0"/><span className="font-mono">{sale.shippingData.phoneNumber}</span></div>
                                              {sale.fulfillmentStatus !== 'SHIPPED' && <button onClick={() => markShipped(sale.id)} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"><Truck size={18}/> Marcar como Despachado</button>}
                                          </div>
                                      ) : <div className="text-slate-600 text-[10px] font-black uppercase text-center py-4 italic">Sin datos de envío</div>}
                                  </div>
                              )}
                          </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {tab === 'PRICING' && (
          <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-8">
                  <div><h3 className="font-black text-white uppercase tracking-widest italic">Lista de Precios</h3><p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Automatización para subidas de video.</p></div>
                  <button onClick={savePricingConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-900/20"><Save size={16}/> Guardar</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableCategories.map(cat => (
                      <div key={cat} className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex justify-between items-center transition-all hover:border-indigo-500/30">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-600 tracking-tighter">$</span><input type="number" min="0" className="w-16 bg-slate-900 border border-slate-800 rounded-lg text-center text-amber-400 font-black py-1.5 focus:border-indigo-500 outline-none text-sm font-mono" value={defaultPrices[cat] ?? ''} placeholder="0" onChange={(e) => setDefaultPrices({...defaultPrices, [cat]: parseInt(e.target.value) || 0})}/></div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {tab === 'SHIPPING' && (
           <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-8">
                  <div><h3 className="font-black text-white flex items-center gap-2 uppercase tracking-widest italic"><Truck size={18}/> Mi Logística</h3><p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Dirección de entrega predeterminada.</p></div>
                  <button onClick={saveShipping} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-900/20"><Save size={16}/> Guardar</button>
                </div>
                <div className="space-y-4 max-w-lg">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 tracking-widest">Nombre Completo</label><input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 tracking-widest">Calle y Número</label><input type="text" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 tracking-widest">Provincia / Ciudad</label><input type="text" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 tracking-widest">Código Postal</label><input type="text" value={shipping.zipCode} onChange={e => setShipping({...shipping, zipCode: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
                    </div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1 tracking-widest">Teléfono de Contacto</label><input type="text" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
                </div>
           </div>
      )}

      {tab === 'SECURITY' && (
          <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5 shadow-2xl animate-in zoom-in-95">
              <h3 className="font-black text-white mb-6 uppercase tracking-widest italic">Ciberseguridad</h3>
              <form onSubmit={handlePasswordChange} className="space-y-5 max-w-sm">
                  <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">Contraseña Actual</label><input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" /></div>
                  <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">Nueva Contraseña</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" /></div>
                  <div><label className="block text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">Confirmar Nueva</label><input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" /></div>
                  <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95">Actualizar Acceso</button>
              </form>
          </div>
      )}

      {showRequestBalance && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-sm p-8 rounded-[40px] border border-white/5 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Recargar Saldo</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Solicitud manual al administrador</p>
                  <div className="mb-8"><label className="text-[10px] font-black text-slate-500 uppercase ml-2">Monto solicitado</label><input type="number" value={reqAmount} onChange={e => setReqAmount(Math.max(1, parseInt(e.target.value)))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white text-2xl font-black mt-2 focus:border-emerald-500 outline-none font-mono" /></div>
                  <div className="flex gap-3"><button onClick={() => setShowRequestBalance(false)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 bg-slate-800/50 hover:bg-slate-800 transition-colors">Cancelar</button><button onClick={requestBalance} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 active:scale-95">Solicitar</button></div>
              </div>
          </div>
      )}

    </div>
  );
}