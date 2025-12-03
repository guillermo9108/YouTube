
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from '../components/Router';
import { db } from '../services/db';
import { Wallet, History, Settings2, Clock, PlayCircle, DownloadCloud, ChevronRight, Camera, Shield, User as UserIcon, Tag, Save, ShoppingBag, Truck, AlertTriangle, MessageSquare, Send, X, Package } from 'lucide-react';
import { Video, Transaction, VideoCategory, Order } from '../types';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { pathname } = useLocation(); // Use custom router hook
  
  const [bulkPrice, setBulkPrice] = useState<number>(1);
  const [showBulk, setShowBulk] = useState(false);
  const [autoLimit, setAutoLimit] = useState<number>(1);
  const [watchLaterVideos, setWatchLaterVideos] = useState<Video[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  
  // Orders
  const [orders, setOrders] = useState<{bought: Order[], sold: Order[]}>({bought: [], sold: []});
  const [claimModal, setClaimModal] = useState<{isOpen: boolean, orderId: string, type: 'BOUGHT'|'SOLD'} | null>(null);
  const [claimReason, setClaimReason] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Tabs
  const [tab, setTab] = useState<'OVERVIEW' | 'SECURITY' | 'PRICING' | 'ORDERS' | 'SHIPPING'>('OVERVIEW');
  
  // Security Tab
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  // Pricing Tab
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(VideoCategory));

  // Shipping Tab
  const [shipping, setShipping] = useState({
      fullName: '',
      phoneNumber: '',
      address: '',
      bankAccount: '',
      notes: ''
  });

  // Check URL for Tab
  useEffect(() => {
      if (pathname.includes('tab=ORDERS')) setTab('ORDERS');
      else if (pathname.includes('tab=SHIPPING')) setTab('SHIPPING');
      else if (pathname.includes('tab=PRICING')) setTab('PRICING');
  }, [pathname]);

  useEffect(() => {
    if (user) {
      setAutoLimit(user.autoPurchaseLimit);
      setDefaultPrices(user.defaultPrices || {});
      
      if (user.shippingDetails) {
          setShipping({
              fullName: user.shippingDetails.fullName || '',
              phoneNumber: user.shippingDetails.phoneNumber || '',
              address: user.shippingDetails.address || '',
              bankAccount: user.shippingDetails.bankAccount || '',
              notes: user.shippingDetails.notes || ''
          });
      }
      
      Promise.all(user.watchLater.map(id => db.getVideo(id))).then(res => {
          setWatchLaterVideos(res.filter(v => !!v) as Video[]);
      });

      db.getUserTransactions(user.id).then(setTransactions);
      db.getVideosByCreator(user.id).then(setMyVideos);
      db.getUserOrders(user.id).then(setOrders);
      
      db.getSystemSettings().then(s => {
          if (s.customCategories) {
              setAvailableCategories([...Object.values(VideoCategory), ...s.customCategories]);
          }
      });
    }
  }, [user]);

  if (!user) return null;

  const handleBulkUpdate = async () => {
     if (confirm(`¿Estás seguro de que quieres poner TODOS tus videos a ${bulkPrice} Saldo?`)) {
       await db.updatePricesBulk(user.id, bulkPrice);
       alert("Precios actualizados!");
       setShowBulk(false);
       refreshUser();
     }
  };

  const handleAutoLimitChange = async () => {
    await db.updateUserProfile(user.id, { autoPurchaseLimit: autoLimit });
    refreshUser();
    alert("Límite de autocompra actualizado.");
  };

  const savePricingConfig = async () => {
      await db.updateUserProfile(user.id, { defaultPrices });
      refreshUser();
      alert("Preferencias de precios guardadas!");
  };

  const saveShipping = async () => {
      await db.updateUserProfile(user.id, { shippingDetails: shipping });
      refreshUser();
      alert("Datos de envío guardados. Se usarán automáticamente en el carrito.");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              await db.uploadAvatar(user.id, file);
              refreshUser();
          } catch(e: any) {
              alert("Error al subir avatar: " + e.message);
          }
      }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if(newPass !== confirmPass) { setPassMsg("Las contraseñas no coinciden"); return; }
      if(!oldPass || !newPass) { setPassMsg("Todos los campos son obligatorios"); return; }
      
      try {
          await db.changePassword(user.id, oldPass, newPass);
          setPassMsg("Contraseña cambiada exitosamente!");
          setOldPass(''); setNewPass(''); setConfirmPass('');
      } catch(e: any) {
          setPassMsg(e.message);
      }
  };

  const openClaim = (orderId: string, type: 'BOUGHT'|'SOLD') => {
      setClaimModal({ isOpen: true, orderId, type });
      setClaimReason('');
  };

  const submitClaim = async () => {
      if (!claimModal || !claimReason.trim()) return;
      setClaimSubmitting(true);
      try {
          await db.submitOrderClaim(claimModal.orderId, claimReason);
          alert("Reclamo enviado a administración. Revisarán el caso pronto.");
          setClaimModal(null);
      } catch(e: any) {
          alert("Error al enviar reclamo: " + e.message);
      } finally {
          setClaimSubmitting(false);
      }
  };

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mi Perfil</h2>
        <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 underline">Cerrar Sesión</button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto scrollbar-hide">
          <button onClick={() => setTab('OVERVIEW')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${tab==='OVERVIEW'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <UserIcon size={16}/> Resumen
          </button>
          <button onClick={() => setTab('ORDERS')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${tab==='ORDERS'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <ShoppingBag size={16}/> Pedidos
          </button>
          <button onClick={() => setTab('SHIPPING')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${tab==='SHIPPING'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Truck size={16}/> Envío
          </button>
          <button onClick={() => setTab('PRICING')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${tab==='PRICING'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Tag size={16}/> Precios
          </button>
          <button onClick={() => setTab('SECURITY')} className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${tab==='SECURITY'?'bg-indigo-600 text-white':'text-slate-400'}`}>
              <Shield size={16}/> Seguridad
          </button>
      </div>

      {tab === 'OVERVIEW' && (
      <>
        {/* Profile Card & Avatar */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden flex items-center gap-6">
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
            
            <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-300 mb-1">
                <Wallet size={18} />
                <span className="font-medium uppercase tracking-wide text-xs">Saldo Actual</span>
            </div>
            <div className="text-4xl font-mono font-bold text-white tracking-tight">
                {user.balance} <span className="text-lg text-slate-400">SALDO</span>
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
                        <h3 className="font-bold text-white text-lg">Pedir Contenido</h3>
                        <p className="text-slate-400 text-sm">Solicita videos de YouTube</p>
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
                <PlayCircle size={16} className="text-indigo-400" /> Límite Autocompra
            </h3>
            <p className="text-xs text-slate-500 mb-3">Precio máximo para autocomprar al hacer scroll.</p>
            <div className="flex gap-2">
                <input 
                    type="number" 
                    min="0"
                    value={isNaN(autoLimit) ? '' : autoLimit}
                    onChange={(e) => { const v = parseInt(e.target.value); setAutoLimit(isNaN(v) ? 0 : v); }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
                <button 
                    onClick={handleAutoLimitChange}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    Guardar
                </button>
            </div>
            </div>

            {/* Bulk Action */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center cursor-pointer mb-2" onClick={() => setShowBulk(!showBulk)}>
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Settings2 size={16} className="text-indigo-400" /> Precio Masivo
                </div>
                <span className="text-indigo-400 text-xs">{showBulk ? 'Cerrar' : 'Abrir'}</span>
            </div>
            
            {showBulk ? (
                <div className="mt-2">
                <p className="text-xs text-slate-500 mb-2">Fijar precio para tus {myVideos.length} videos.</p>
                <div className="flex gap-2">
                    <input 
                    type="number" 
                    min="1"
                    value={isNaN(bulkPrice) ? '' : bulkPrice}
                    onChange={(e) => { const v = parseInt(e.target.value); setBulkPrice(isNaN(v) ? 0 : v); }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                    <button 
                    onClick={handleBulkUpdate}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium"
                    >
                    Aplicar
                    </button>
                </div>
                </div>
            ) : (
                <p className="text-xs text-slate-500">Actualiza el precio de todos tus videos.</p>
            )}
            </div>
        </div>

        {/* Watch Later */}
        <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={18} /> Ver Más Tarde
            </h3>
            {watchLaterVideos.length === 0 ? (
            <div className="bg-slate-900 rounded-xl p-6 text-center text-slate-500 text-sm border border-slate-800">
                Tu lista está vacía.
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
            <History size={18} /> Historial de Transacciones
            </h3>
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-h-60 overflow-y-auto">
            {transactions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">No hay transacciones aún.</div>
            ) : (
                <div className="divide-y divide-slate-800">
                {transactions.map(tx => {
                    const isIncoming = tx.type === 'DEPOSIT' || tx.creatorId === user.id;
                    const isSystem = tx.type === 'DEPOSIT';
                    
                    return (
                    <div key={tx.id} className="p-4 flex justify-between items-center">
                        <div>
                        <div className="font-medium text-slate-200 text-sm">
                            {isSystem ? 'Depósito Admin' : (isIncoming ? 'Video Vendido' : 'Compra Video')}
                        </div>
                        <div className="text-xs text-slate-500">
                            {new Date(tx.timestamp < 10000000000 ? tx.timestamp * 1000 : tx.timestamp).toLocaleString()}
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

      {tab === 'SHIPPING' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-4">
                  <div>
                      <h3 className="font-bold text-white">Datos de Envío</h3>
                      <p className="text-xs text-slate-400">Estos datos se rellenarán automáticamente en el carrito.</p>
                  </div>
                  <button onClick={saveShipping} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Save size={16}/> Guardar
                  </button>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                      <input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Juan Pérez" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección de Envío</label>
                      <input type="text" value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Calle 123, Ciudad" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono Móvil</label>
                          <input type="tel" value={shipping.phoneNumber} onChange={e => setShipping({...shipping, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="+505..." />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cuenta Bancaria (Opcional)</label>
                          <input type="text" value={shipping.bankAccount} onChange={e => setShipping({...shipping, bankAccount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Para reembolsos" />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas Predeterminadas</label>
                      <textarea value={shipping.notes} onChange={e => setShipping({...shipping, notes: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" placeholder="Ej: Llamar antes de entregar..." rows={2} />
                  </div>
              </div>
          </div>
      )}

      {tab === 'ORDERS' && (
          <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Package size={20}/> Compras Realizadas</h3>
                  <div className="space-y-4">
                      {orders.bought.length === 0 ? <p className="text-slate-500 text-sm italic">Aún no has comprado nada.</p> : orders.bought.map(order => (
                          <div key={order.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group">
                              <div className="flex justify-between items-start mb-3">
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <div className="text-xs font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400">#{order.id.slice(0,8)}</div>
                                          <div className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Completado</div>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                          {new Date(order.timestamp < 10000000000 ? order.timestamp * 1000 : order.timestamp).toLocaleString()}
                                      </div>
                                  </div>
                                  <div className="font-black text-emerald-400 text-lg">{order.totalAmount} $</div>
                              </div>
                              <div className="space-y-2 mb-3">
                                  {order.items.map(i => (
                                      <div key={i.itemId} className="text-sm text-slate-300 flex justify-between items-center bg-slate-900/50 p-2 rounded">
                                          <span className="font-medium">{i.quantity}x {i.title}</span>
                                          <span className="text-slate-500">{i.price}</span>
                                      </div>
                                  ))}
                              </div>
                              <div className="border-t border-slate-800 pt-3 flex justify-end">
                                  <button onClick={() => openClaim(order.id, 'BOUGHT')} className="text-xs font-bold text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                                      <AlertTriangle size={12}/> Reportar Problema
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Tag size={20}/> Ventas Realizadas</h3>
                   <div className="space-y-4">
                      {orders.sold.length === 0 ? <p className="text-slate-500 text-sm italic">Aún no has vendido nada.</p> : orders.sold.map(order => (
                          <div key={order.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="flex justify-between items-start mb-3">
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <div className="text-xs font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400">#{order.id.slice(0,8)}</div>
                                          <div className="text-[10px] font-bold text-indigo-400">Comprador: {order.shippingData.name}</div>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                          {new Date(order.timestamp < 10000000000 ? order.timestamp * 1000 : order.timestamp).toLocaleString()}
                                      </div>
                                  </div>
                                  <div className="font-black text-emerald-400 text-lg">+{order.totalAmount} $</div>
                              </div>
                              
                              <div className="bg-slate-900 p-3 rounded-lg text-xs text-slate-300 mb-3 border border-slate-800">
                                  <div className="font-bold text-slate-500 uppercase mb-1 text-[10px]">Datos de Envío</div>
                                  <div><span className="text-slate-500">Dirección:</span> {order.shippingData.address || 'N/A'}</div>
                                  <div><span className="text-slate-500">Móvil:</span> {order.shippingData.phoneNumber || 'N/A'}</div>
                                  {order.shippingData.notes && <div className="mt-1 text-amber-200/80 italic">Nota: "{order.shippingData.notes}"</div>}
                              </div>

                              <div className="space-y-1">
                                  {order.items.map(i => (
                                      <div key={i.itemId} className="text-sm text-slate-300 flex justify-between items-center">
                                          <span>{i.quantity}x {i.title}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {tab === 'PRICING' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                  <div>
                      <h3 className="font-bold text-white">Precios por Defecto</h3>
                      <p className="text-xs text-slate-400">Fija tu precio preferido por categoría para subidas futuras.</p>
                  </div>
                  <button onClick={savePricingConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Save size={16}/> Guardar
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableCategories.map(cat => (
                      <div key={cat} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300 uppercase">{cat.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Precio:</span>
                              <input 
                                type="number" 
                                min="0" 
                                className="w-16 bg-slate-900 border border-slate-700 rounded text-center text-amber-400 font-bold py-1 focus:border-indigo-500 outline-none"
                                value={isNaN(defaultPrices[cat]) ? '' : defaultPrices[cat]}
                                placeholder="Auto"
                                onChange={(e) => { const v = parseInt(e.target.value); setDefaultPrices({...defaultPrices, [cat]: isNaN(v) ? 0 : v}) }}
                              />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {tab === 'SECURITY' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="font-bold text-white mb-4">Cambiar Contraseña</h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Contraseña Actual</label>
                      <input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Nueva Contraseña</label>
                      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Confirmar Nueva Contraseña</label>
                      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  {passMsg && <div className="text-xs font-bold text-indigo-400">{passMsg}</div>}
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg">Actualizar Contraseña</button>
              </form>
          </div>
      )}

      {/* Claim Modal */}
      {claimModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setClaimModal(null)}></div>
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="text-amber-500"/> Reportar Pedido</h3>
                      <button onClick={() => setClaimModal(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                      Describe el problema con el pedido <span className="text-white font-mono">#{claimModal.orderId.slice(0,8)}</span>. 
                      La administración revisará el caso y contactará contigo.
                  </p>
                  
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 min-h-[100px] mb-4" 
                    placeholder="Ej: No recibí el producto, llegó dañado, es una estafa..."
                    value={claimReason}
                    onChange={e => setClaimReason(e.target.value)}
                  ></textarea>

                  <div className="flex justify-end gap-3">
                      <button onClick={() => setClaimModal(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-bold">Cancelar</button>
                      <button 
                        onClick={submitClaim} 
                        disabled={claimSubmitting || !claimReason.trim()}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                         <Send size={16}/> Enviar Reporte
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
