import React, { useState } from 'react';
import { useAuth, useNavigate } from '../App';
import { Layout as LayoutIcon } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 mb-4 shadow-xl shadow-indigo-500/20">
             <LayoutIcon size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            StreamPay
          </h1>
          <p className="text-slate-400 mt-2">The premier Pay-Per-View marketplace.</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="flex gap-4 mb-6 p-1 bg-slate-950 rounded-lg">
             <button 
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
               Login
             </button>
             <button 
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
               Register
             </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
               <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Username</label>
               <input
                 type="text"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                 placeholder="Enter your username"
               />
               {!isLogin && (
                 <p className="text-xs text-slate-500 mt-1">Choose a unique username.</p>
               )}
             </div>

             <div>
               <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Password</label>
               <input
                 type="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                 placeholder="Enter your password"
               />
             </div>
             
             {error && (
               <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                 <span className="block w-1.5 h-1.5 rounded-full bg-red-400"></span>
                 {error}
               </div>
             )}

             <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 shadow-lg shadow-indigo-900/20">
               {isLogin ? 'Sign In' : 'Create Account'}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
}