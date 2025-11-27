import React, { createContext, useContext, useEffect, useState, PropsWithChildren, Suspense } from 'react';
import { User } from './types';
import { db } from './services/db';
import Login from './pages/Login';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Shorts from './pages/Shorts';
import Setup from './pages/Setup';

// Lazy load Layout to avoid circular dependency with Link/Outlet exports
const Layout = React.lazy(() => import('./components/Layout'));

// --- Custom Router Implementation ---

const RouterContext = createContext<{ pathname: string }>({ pathname: '/' });
const OutletContext = createContext<React.ReactNode>(null);

export function useLocation() {
  return useContext(RouterContext);
}

export function useNavigate() {
  return (to: string, options?: { replace?: boolean }) => {
    window.location.hash = to;
  };
}

export function useParams() {
  const { pathname } = useLocation();
  const match = pathname.match(/\/watch\/([^/?]+)/);
  return match ? { id: match[1] } : {};
}

export const Link: React.FC<{ to: string, children?: React.ReactNode, className?: string }> = ({ to, children, className }) => {
  return (
    <a href={`#${to}`} className={className}>
      {children}
    </a>
  );
};

export function Outlet() {
  return useContext(OutletContext);
}

export function Navigate({ to }: { to: string, replace?: boolean }) {
  useEffect(() => {
    window.location.hash = to;
  }, [to]);
  return null;
}

function HashRouter({ children }: { children?: React.ReactNode }) {
  const [pathname, setPathname] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handler = () => {
      let p = window.location.hash.slice(1);
      if (!p) p = '/';
      setPathname(p);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname }}>
      {children}
    </RouterContext.Provider>
  );
}

function Routes({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const routes = React.Children.toArray(children) as React.ReactElement[];

  for (const route of routes) {
    const { path, element, children: nested } = route.props;

    // Handle Nested Routes (Layout)
    if (!path && nested) {
      const childRoutes = React.Children.toArray(nested) as React.ReactElement[];
      for (const child of childRoutes) {
        const cp = child.props.path;
        let isMatch = false;

        if (cp === '*') isMatch = true;
        else if (cp === pathname) isMatch = true;
        else if (cp && cp.includes(':')) {
           // Basic prefix match for params
           const prefix = cp.split(':')[0];
           if (pathname.startsWith(prefix)) isMatch = true;
        }

        if (isMatch) {
          return (
            <OutletContext.Provider value={child.props.element}>
              {element}
            </OutletContext.Provider>
          );
        }
      }
    } else {
      // Handle Top Level Routes
      let isMatch = false;
      if (path === '*') isMatch = true;
      else if (path === pathname) isMatch = true;
      else if (path && path.includes(':')) {
           const prefix = path.split(':')[0];
           if (pathname.startsWith(prefix)) isMatch = true;
      }

      if (isMatch) return element;
    }
  }
  return null;
}

function Route(props: { path?: string, element: React.ReactNode, children?: React.ReactNode }) {
  return null;
}

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

const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
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
              <Route path="/upload" element={<SetupGuard><ProtectedRoute><Upload /></ProtectedRoute></SetupGuard>} />
              <Route path="/profile" element={<SetupGuard><ProtectedRoute><Profile /></ProtectedRoute></SetupGuard>} />
              <Route path="/admin" element={<SetupGuard><AdminRoute><Admin /></AdminRoute></SetupGuard>} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}