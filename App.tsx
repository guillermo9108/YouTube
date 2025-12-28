import React, { Suspense, useState, useEffect } from 'react';
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
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { CartProvider } from './context/CartContext';
import { ServerTaskProvider } from './context/ServerTaskContext';
import { ToastProvider } from './context/ToastContext';
import { GridProvider } from './context/GridContext';
import { db } from './services/db';
import { Loader2, WifiOff } from 'lucide-react';

// Lazy load Layout
const Layout = React.lazy(() => import('./components/Layout'));

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
  
  if (isLoading) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

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
  const [checkDone, setCheckDone] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    db.checkInstallation()
      .then((res) => {
         if (res.status === 'not_installed') {
             setNeedsSetup(true);
         }
         setCheckDone(true);
      })
      .catch(() => {
         setNeedsSetup(true);
         setCheckDone(true);
      });
  }, []);

  if (!checkDone) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Conectando...</div>;

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }
  return <>{children}</>;
};

// --- App ---

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <UploadProvider>
            <ServerTaskProvider>
                <CartProvider>
                    <GridProvider>
                        <HashRouter>
                        <OfflineBanner />
                        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>}>
                            <Routes>
                            <Route path="/setup" element={<Setup />} />
                            
                            <Route path="/login" element={
                                <SetupGuard>
                                <Login />
                                </SetupGuard>
                            } />
                            
                            {/* SetupGuard wraps the entire Layout to prevent child API calls before DB is ready */}
                            <Route element={<SetupGuard><ProtectedRoute><Layout /></ProtectedRoute></SetupGuard>}>
                                <Route path="/" element={<Home />} />
                                <Route path="/shorts" element={<Shorts />} />
                                <Route path="/watch/:id" element={<Watch />} />
                                <Route path="/channel/:userId" element={<Channel />} />
                                <Route path="/upload" element={<Upload />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/requests" element={<Requests />} />
                                <Route path="/marketplace" element={<Marketplace />} />
                                <Route path="/sell" element={<MarketplaceCreate />} />
                                <Route path="/cart" element={<Cart />} />
                                <Route path="/vip" element={<VipStore />} />
                                <Route path="/marketplace/edit/:id" element={<MarketplaceEdit />} />
                                <Route path="/marketplace/:id" element={<MarketplaceItem />} />
                                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
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
  );
}