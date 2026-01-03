import React, { Component, Suspense, useState, useEffect, ErrorInfo, ReactNode } from 'react';
// Page Imports
import Login from './components/pages/Login';
import Home from './components/pages/Home';
import Watch from './components/pages/Watch';
import Upload from './components/pages/Upload';
import Profile from './components/pages/Profile';
import Admin from './components/pages/admin/Admin';
import Shorts from './components/pages/Shorts';
import Setup from './components/pages/Setup';
import Requests from './components/pages/Requests';
import Channel from './components/pages/Channel';
import Marketplace from './components/pages/Marketplace';
import MarketplaceItem from './components/pages/MarketplaceItem';
import MarketplaceCreate from './components/pages/MarketplaceCreate';
import MarketplaceEdit from './components/pages/MarketplaceEdit';
import Cart from './components/pages/Cart';
import VipStore from './components/pages/VipStore';

// Components & Context
import { HashRouter, Routes, Route, Navigate } from './components/Router';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { CartProvider } from './context/CartContext';
import { ServerTaskProvider } from './context/ServerTaskContext';
import { ToastProvider } from './context/ToastContext';
import { GridProvider } from './context/GridContext';
import { db } from './services/db';
import { Loader2, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

// --- Error Boundary ---
interface GlobalErrorBoundaryProps {
  children?: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Fix: Use the imported Component class directly to ensure proper typing of this.props and this.state
class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  public state: GlobalErrorBoundaryState = { hasError: false, error: null };

  constructor(props: GlobalErrorBoundaryProps) { 
    super(props); 
  }
  
  static getDerivedStateFromError(error: any): GlobalErrorBoundaryState { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: any, errorInfo: ErrorInfo) { 
    console.error("PWA Crash:", error, errorInfo); 
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <AlertTriangle className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase mb-2">Error Crítico de Renderizado</h1>
          <p className="text-slate-400 text-sm max-w-md mb-8 font-mono bg-black/40 p-4 rounded-xl border border-white/5">
            {this.state.error?.message || "Error desconocido en el módulo React"}
          </p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2">
            <RefreshCw size={18}/> Reiniciar Aplicación
          </button>
        </div>
      );
    }
    // Fix: Correctly returning children from props with guaranteed typing from Component base class
    return this.props.children;
  }
}

const OfflineBanner = () => {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    if (online) return null;
    return (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-red-600/90 text-white text-center py-2 z-[100] text-xs font-bold flex items-center justify-center gap-2 backdrop-blur-sm">
            <WifiOff size={14} /> Estás desconectado. Mostrando contenido caché.
        </div>
    );
};

// --- Guards ---
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role?.trim().toUpperCase() !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SetupGuard = ({ children }: { children?: React.ReactNode }) => {
  const [status, setStatus] = useState<'LOADING' | 'READY' | 'SETUP' | 'ERROR'>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check using index.php which should handle check_installation
    db.checkInstallation()
      .then((res) => {
         if (res && res.installed) {
            setStatus('READY');
         } else {
            setStatus('SETUP');
         }
      })
      .catch((err) => {
         if (err.message === 'SYSTEM_NOT_INSTALLED' || err.message === 'API_MISSING') {
            // If the API file is completely missing (404), we treat it as "needs setup" 
            // so the user can reach the Setup page and potentially use Demo Mode.
            setStatus('SETUP');
         } else {
            setErrorMessage(err.message || "Error conectando con el servidor PHP.");
            setStatus('ERROR');
         }
      });
  }, []);

  if (status === 'LOADING') return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Conectando con Servidor...</div>;
  if (status === 'ERROR') return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="text-amber-500 mb-4" size={48} />
        <h2 className="text-white font-bold text-xl">Fallo de Comunicación</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">{errorMessage}</p>
        <div className="mt-8 flex flex-col gap-3">
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Reintentar Conexión</button>
            <button onClick={() => window.location.hash = '#/setup'} className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest underline">Forzar Instalador</button>
        </div>
    </div>
  );
  if (status === 'SETUP') return <Navigate to="/setup" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <UploadProvider>
              <ServerTaskProvider>
                  <CartProvider>
                      <GridProvider>
                          <HashRouter>
                          <OfflineBanner />
                          <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando módulos...</div>}>
                              <Routes>
                              <Route path="/setup" element={<Setup />} />
                              <Route path="/login" element={<SetupGuard><Login /></SetupGuard>} />
                              <Route element={<Layout />}>
                                  <Route path="/" element={<SetupGuard><ProtectedRoute><Home /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/shorts" element={<SetupGuard><ProtectedRoute><Shorts /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/watch/:id" element={<SetupGuard><ProtectedRoute><Watch /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/channel/:userId" element={<SetupGuard><ProtectedRoute><Channel /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/upload" element={<SetupGuard><ProtectedRoute><Upload /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/profile" element={<SetupGuard><ProtectedRoute><Profile /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/requests" element={<SetupGuard><ProtectedRoute><Requests /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/marketplace" element={<SetupGuard><ProtectedRoute><Marketplace /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/sell" element={<SetupGuard><ProtectedRoute><MarketplaceCreate /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/cart" element={<SetupGuard><ProtectedRoute><Cart /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/vip" element={<SetupGuard><ProtectedRoute><VipStore /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/marketplace/edit/:id" element={<SetupGuard><ProtectedRoute><MarketplaceEdit /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/marketplace/:id" element={<SetupGuard><ProtectedRoute><MarketplaceItem /></ProtectedRoute></SetupGuard>} />
                                  <Route path="/admin" element={<SetupGuard><AdminRoute><Admin /></AdminRoute></SetupGuard>} />
                              </Route>
                              <Route path="*" element={<Navigate to="/" />} />
                              </Routes>
                          </Suspense>
                          </HashRouter>
                      </GridProvider>
                  </CartProvider>
              </ServerTaskProvider>
          </UploadProvider>
        </AuthProvider>
      </ToastProvider>
    </GlobalErrorBoundary>
  );
}
