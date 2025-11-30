
import React, { Suspense, PropsWithChildren, useState, useEffect } from 'react';
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
import { HashRouter, Routes, Route, Navigate } from './components/Router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { db } from './services/db';
import { Loader2 } from 'lucide-react';

// Lazy load Layout
const Layout = React.lazy(() => import('./components/Layout'));

// --- Guards ---

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: PropsWithChildren) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SetupGuard = ({ children }: PropsWithChildren) => {
  const [checkDone, setCheckDone] = useState(false);
  const [needs, setNeeds] = useState(false);

  useEffect(() => {
    db.checkInstallation().then(() => {
       setNeeds(db.needsSetup());
       setCheckDone(true);
    });
  }, []);

  if (!checkDone) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Checking system...</div>;

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
        <HashRouter>
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
                <Route path="/admin" element={<SetupGuard><AdminRoute><Admin /></AdminRoute></SetupGuard>} />
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </UploadProvider>
    </AuthProvider>
  );
}
