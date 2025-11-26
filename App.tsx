import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { User } from './types';
import { db } from './services/db';
import Login from './pages/Login';
import Home from './pages/Home';
import Layout from './components/Layout';
import Watch from './pages/Watch';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Shorts from './pages/Shorts';
import Setup from './pages/Setup';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  // Persist login state
  useEffect(() => {
    const savedId = localStorage.getItem('sp_current_user_id');
    if (savedId) {
      db.getUser(savedId).then(u => setUser(u)).catch(() => localStorage.removeItem('sp_current_user_id'));
    }
  }, []);

  const refreshUser = () => {
     if (user) {
        db.getUser(user.id).then(u => setUser(u));
     }
  };

  const login = async (username: string, password: string) => {
    const u = await db.login(username, password);
    setUser(u);
    localStorage.setItem('sp_current_user_id', u.id);
  };

  const register = async (username: string, password: string) => {
    const u = await db.register(username, password);
    setUser(u);
    localStorage.setItem('sp_current_user_id', u.id);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sp_current_user_id');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Guards ---

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { user } = useAuth();
  // Simple check, in real app might need loading state
  if (!user && !localStorage.getItem('sp_current_user_id')) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: PropsWithChildren) => {
  const { user } = useAuth();
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

  if (!checkDone) return null; // Or a spinner

  if (needs) {
    return <Navigate to="/setup" replace />;
  }
  return <>{children}</>;
};

// --- App ---

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
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
            <Route path="/upload" element={<SetupGuard><ProtectedRoute><Upload /></ProtectedRoute></SetupGuard>} />
            <Route path="/profile" element={<SetupGuard><ProtectedRoute><Profile /></ProtectedRoute></SetupGuard>} />
            <Route path="/admin" element={<SetupGuard><AdminRoute><Admin /></AdminRoute></SetupGuard>} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}