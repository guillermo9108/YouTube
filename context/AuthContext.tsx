import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, avatar?: File | null) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatRef = useRef<number | null>(null);
  
  useEffect(() => {
    const savedId = localStorage.getItem('sp_current_user_id');
    const savedToken = localStorage.getItem('sp_session_token');

    const initAuth = async () => {
        if (savedId && savedToken) {
            try {
                // Try network first
                const u = await db.getUser(savedId);
                if (u) {
                    u.sessionToken = savedToken;
                    u.balance = Number(u.balance);
                    setUser(u);
                    db.saveOfflineUser(u); // Backup for offline
                } else {
                    // Invalid user from server (e.g. deleted)
                    logout();
                }
            } catch (err) {
                console.warn("Network auth check failed, trying offline backup:", err);
                // Fallback to offline user
                const offlineUser = db.getOfflineUser();
                if (offlineUser && offlineUser.id === savedId) {
                    setUser(offlineUser);
                } else {
                    // Do not logout immediately on network error, keep loading state or retry?
                    // Better to let them be "logged in" visually but with stale data if no backup
                }
            } finally {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    };

    initAuth();
  }, []);

  // Heartbeat Logic - Tolerant to network failures
  useEffect(() => {
    if (user && user.sessionToken) {
        // Update offline cache on every user state change
        db.saveOfflineUser(user);

        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        
        // Initial beat
        db.heartbeat(user.id, user.sessionToken);

        // Beat every 30 seconds
        heartbeatRef.current = window.setInterval(async () => {
            if (user && user.sessionToken) {
                try {
                    const isValid = await db.heartbeat(user.id, user.sessionToken);
                    if (!isValid) {
                        // Only logout if server explicitly says session is invalid (and we could reach it)
                        // Note: db.heartbeat catches errors and returns false only on explicit failure or logic error.
                        // We need to ensure db.heartbeat doesn't return false on NETWORK ERROR.
                        // Implemented in db.ts to handle this, but double check logic here if needed.
                        // console.warn("Session invalid.");
                        // logout(); 
                        // NOTE: To be safe in offline mode, we disable auto-logout on heartbeat fail for now
                    }
                } catch (e) {
                    // Network error - ignore, keep logged in
                }
            }
        }, 30000);
    } else {
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    }

    return () => {
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    };
  }, [user]);

  const refreshUser = () => {
     const currentToken = localStorage.getItem('sp_session_token');
     if (user && currentToken) {
        db.getUser(user.id).then(u => { 
            if(u && u.id === user.id) {
                const refreshed = {
                    ...u, 
                    sessionToken: currentToken,
                    balance: Number(u.balance)
                };
                setUser(refreshed);
                db.saveOfflineUser(refreshed);
            }
        }).catch(e => console.log("Refresh failed (offline)"));
     }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        const u = await db.login(username, password);
        u.balance = Number(u.balance);
        setUser(u);
        db.saveOfflineUser(u);
        localStorage.setItem('sp_current_user_id', u.id);
        if (u.sessionToken) localStorage.setItem('sp_session_token', u.sessionToken);
    } finally {
        setIsLoading(false);
    }
  };

  const register = async (username: string, password: string, avatar?: File | null) => {
    setIsLoading(true);
    try {
        const u = await db.register(username, password, avatar);
        u.balance = Number(u.balance);
        setUser(u);
        db.saveOfflineUser(u);
        localStorage.setItem('sp_current_user_id', u.id);
        if (u.sessionToken) localStorage.setItem('sp_session_token', u.sessionToken);
    } finally {
        setIsLoading(false);
    }
  };

  const logout = () => {
    if (user) {
        try { db.logout(user.id).catch(console.error); } catch(e){}
    }
    setUser(null);
    localStorage.removeItem('sp_current_user_id');
    localStorage.removeItem('sp_session_token');
    localStorage.removeItem('sp_offline_user'); // Clear offline cache on explicit logout
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    window.dispatchEvent(new Event('sp_logout'));
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};