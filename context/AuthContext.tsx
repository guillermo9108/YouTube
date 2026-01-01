
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { db } from '../services/db';
import { useToast } from './ToastContext';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../utils/constants';

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
  const toast = useToast();
  
  const logout = () => {
    if (user) {
        try { db.logout(user.id).catch(() => {}); } catch(e){}
    }
    setUser(null);
    storage.clearSession();
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    window.dispatchEvent(new Event('sp_logout'));
  };

  useEffect(() => {
    const handleExpired = () => {
        toast.warning("Sesión cerrada: Has iniciado sesión en otro dispositivo.");
        logout();
    };
    window.addEventListener('sp_session_expired', handleExpired);

    const savedId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

    const initAuth = async () => {
        if (savedId && savedToken) {
            try {
                const u = await db.getUser(savedId);
                if (u) {
                    u.sessionToken = savedToken;
                    u.balance = Number(u.balance);
                    setUser(u);
                    storage.set(STORAGE_KEYS.OFFLINE_USER, u);
                } else {
                    logout();
                }
            } catch (err) {
                const offlineUser = storage.get<User | null>(STORAGE_KEYS.OFFLINE_USER, null);
                if (offlineUser && offlineUser.id === savedId) {
                    setUser(offlineUser);
                }
            } finally {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    };

    initAuth();
    return () => window.removeEventListener('sp_session_expired', handleExpired);
  }, []);

  useEffect(() => {
    if (user && user.sessionToken) {
        storage.set(STORAGE_KEYS.OFFLINE_USER, user);

        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        
        heartbeatRef.current = window.setInterval(async () => {
            if (user && user.id && !document.hidden) {
                await db.heartbeat(user.id).catch(() => {});
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
     const currentToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
     if (user && currentToken) {
        db.getUser(user.id).then(u => { 
            if(u && u.id === user.id) {
                const refreshed = {
                    ...u, 
                    sessionToken: currentToken,
                    balance: Number(u.balance)
                };
                setUser(refreshed);
                storage.set(STORAGE_KEYS.OFFLINE_USER, refreshed);
            }
        }).catch(() => {});
     }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        const u = await db.login(username, password);
        u.balance = Number(u.balance);
        setUser(u);
        storage.set(STORAGE_KEYS.OFFLINE_USER, u);
        storage.set(STORAGE_KEYS.USER_ID, u.id);
        if (u.sessionToken) storage.set(STORAGE_KEYS.TOKEN, u.sessionToken);
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
        storage.set(STORAGE_KEYS.OFFLINE_USER, u);
        storage.set(STORAGE_KEYS.USER_ID, u.id);
        if (u.sessionToken) storage.set(STORAGE_KEYS.TOKEN, u.sessionToken);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
