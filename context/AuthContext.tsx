
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
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
  
  useEffect(() => {
    const savedId = localStorage.getItem('sp_current_user_id');
    if (savedId) {
      db.getUser(savedId)
        .then(u => {
            if(u) setUser(u);
            else localStorage.removeItem('sp_current_user_id');
        })
        .catch(err => {
            console.error("Auth check failed:", err);
            // Don't remove ID immediately on network error, allows retry
        })
        .finally(() => setIsLoading(false));
    } else {
        setIsLoading(false);
    }
  }, []);

  const refreshUser = () => {
     if (user) {
        db.getUser(user.id).then(u => { if(u) setUser(u); });
     }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        const u = await db.login(username, password);
        setUser(u);
        localStorage.setItem('sp_current_user_id', u.id);
    } finally {
        setIsLoading(false);
    }
  };

  const register = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        const u = await db.register(username, password);
        setUser(u);
        localStorage.setItem('sp_current_user_id', u.id);
    } finally {
        setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sp_current_user_id');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
