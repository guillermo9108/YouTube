import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';

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

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  
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