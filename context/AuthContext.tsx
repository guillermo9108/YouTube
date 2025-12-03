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
    const checkAuth = async () => {
        const savedId = localStorage.getItem('sp_current_user_id');
        const savedToken = localStorage.getItem('sp_session_token');

        if (savedId && savedToken) {
          try {
              const u = await db.getUser(savedId);
              if(u) {
                  // Attach the local token to the user object for validation
                  u.sessionToken = savedToken;
                  setUser(u);
              } else {
                  logout();
              }
          } catch (err) {
              console.error("Auth check failed:", err);
          }
        } else {
            setUser(null);
        }
        setIsLoading(false);
    };

    checkAuth();

    // Cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'sp_current_user_id' || e.key === 'sp_session_token') {
            checkAuth();
        }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Heartbeat Logic
  useEffect(() => {
    if (user && user.sessionToken) {
        // Clear existing interval if any
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        
        // Initial beat
        db.heartbeat(user.id, user.sessionToken);

        // Beat every 20 seconds
        heartbeatRef.current = window.setInterval(async () => {
            if (user && user.sessionToken) {
                const isValid = await db.heartbeat(user.id, user.sessionToken);
                if (!isValid) {
                    console.warn("Session expired or invalidated by another login.");
                    logout();
                }
            }
        }, 20000);
    } else {
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    }

    return () => {
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    };
  }, [user]);

  const refreshUser = () => {
     if (user) {
        db.getUser(user.id).then(u => { if(u) setUser({...u, sessionToken: user.sessionToken}); });
     }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        const u = await db.login(username, password);
        setUser(u);
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
        setUser(u);
        localStorage.setItem('sp_current_user_id', u.id);
        if (u.sessionToken) localStorage.setItem('sp_session_token', u.sessionToken);
    } finally {
        setIsLoading(false);
    }
  };

  const logout = () => {
    if (user) {
        db.logout(user.id).catch(console.error);
    }
    setUser(null);
    localStorage.removeItem('sp_current_user_id');
    localStorage.removeItem('sp_session_token');
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};