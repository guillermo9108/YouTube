import React, { Suspense, useState, useEffect } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Shorts from './pages/Shorts';
import Setup from './pages/Setup';
import Requests from './pages/Requests';
import Channel from './pages/Channel';
import Marketplace from './pages/Marketplace';
import MarketplaceItem from './pages/MarketplaceItem';
import MarketplaceCreate from './pages/MarketplaceCreate';
import Cart from './pages/Cart';
import { HashRouter, Routes, Route, Navigate } from './components/Router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { CartProvider } from './context/CartContext';
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
            <WifiOff size={14} /> You are offline. Showing cached content.
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
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SetupGuard = ({ children }: { children?: React.ReactNode }) => {
  const [checkDone, setCheckDone] = useState(false);
  const [needs, setNeeds] = useState(false);

  useEffect(() => {
    db.checkInstallation().then(() => {
       setNeeds(db.needsSetup());
       setCheckDone(true);
    });
  }, []);

  if (!checkDone) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting...</div>;

  if (needs) {
    return <Navigate to="/setup" replace />;
  }
  return <>{children}</>;
};

// --- App ---

export default function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <CartProvider>
            <HashRouter>
            <OfflineBanner />
            <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
                <Routes>
                <Route path="/setup" element={<Setup />} />
                
                <Route path="/login" element={
                    <SetupGuard>
                    <Login />
                    </SetupGuard>
                } />
                
                <Route element={<Layout />}>
                    <Route path="/" element={<SetupGuard><ProtectedRoute><Home /></ProtectedRoute></SetupGuard>} />
                    <Route path="/shorts" element={<SetupGuard><ProtectedRoute><Shorts /></ProtectedRoute></SetupGuard>} />
                    <Route path="/watch/:id" element={<SetupGuard><ProtectedRoute><Watch /></ProtectedRoute></SetupGuard>} />
                    <Route path="/channel/:userId" element={<SetupGuard><ProtectedRoute><Channel /></ProtectedRoute></SetupGuard>} />
                    <Route path="/upload" element={<SetupGuard><ProtectedRoute><Upload /></ProtectedRoute></SetupGuard>} />
                    <Route path="/profile" element={<SetupGuard><ProtectedRoute><Profile /></ProtectedRoute></SetupGuard>} />
                    <Route path="/requests" element={<SetupGuard><ProtectedRoute><Requests /></ProtectedRoute></SetupGuard>} />
                    
                    {/* Marketplace Routes */}
                    <Route path="/marketplace" element={<SetupGuard><ProtectedRoute><Marketplace /></ProtectedRoute></SetupGuard>} />
                    <Route path="/marketplace/:id" element={<SetupGuard><ProtectedRoute><MarketplaceItem /></ProtectedRoute></SetupGuard>} />
                    <Route path="/sell" element={<SetupGuard><ProtectedRoute><MarketplaceCreate /></ProtectedRoute></SetupGuard>} />
                    <Route path="/cart" element={<SetupGuard><ProtectedRoute><Cart /></ProtectedRoute></SetupGuard>} />
                    
                    <Route path="/admin" element={<SetupGuard><AdminRoute><Admin /></AdminRoute></SetupGuard>} />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Suspense>
            </HashRouter>
        </CartProvider>
      </UploadProvider>
    </AuthProvider>
  );
}