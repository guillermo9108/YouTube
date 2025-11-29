
import React from 'react';
import { Home, Upload, User, ShieldCheck, Smartphone, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { Link, useLocation, Outlet } from './Router';

const UploadIndicator = () => {
  const { isUploading, progress, currentFileIndex, totalFiles, uploadSpeed } = useUpload();
  
  if (!isUploading) return null;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-6">
       <div className="relative w-12 h-12 flex items-center justify-center">
          {/* Background Circle */}
          <svg className="transform -rotate-90 w-12 h-12">
            <circle
              className="text-slate-700"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="24"
              cy="24"
            />
            <circle
              className="text-indigo-500 transition-all duration-300 ease-in-out"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="24"
              cy="24"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-white">{Math.round(progress)}%</span>
       </div>
       <div className="flex flex-col min-w-[100px]">
          <span className="text-xs font-bold text-white">Uploading...</span>
          <span className="text-[10px] text-slate-400">File {currentFileIndex} of {totalFiles}</span>
          <span className="text-[10px] text-indigo-400 font-mono">{uploadSpeed}</span>
       </div>
    </div>
  );
};

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => location.pathname === path ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-200';
  
  // Check if we are in shorts mode to remove padding/container limits
  const isShortsMode = location.pathname === '/shorts';

  const Avatar = ({ size=24, className='' }: {size?: number, className?: string}) => (
      user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className={`rounded-full object-cover ${className}`} style={{width: size, height: size}} />
      ) : (
          <User size={size} className={className} />
      )
  );

  return (
    <div className={`min-h-screen flex flex-col bg-black ${isShortsMode ? '' : 'pb-20 md:pb-0'}`}>
      {/* Top Bar for Desktop */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
          StreamPay
        </Link>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full text-indigo-300">
             Balance: {user?.balance} Saldo
          </span>
          {user?.role === 'ADMIN' && (
             <Link to="/admin" className={isActive('/admin')}>Admin</Link>
          )}
          <Link to="/" className={isActive('/')}>Browse</Link>
          <Link to="/shorts" className={isActive('/shorts')}>Shorts</Link>
          <Link to="/requests" className={isActive('/requests')}>Requests</Link>
          <Link to="/upload" className={isActive('/upload')}>Upload</Link>
          <Link to="/profile" className={`flex items-center gap-2 ${isActive('/profile')}`}>
            <Avatar size={20} />
            Profile
          </Link>
        </div>
      </header>

      {/* Main Content - Reduced pt for mobile from 6 to 2 */}
      <main className={isShortsMode ? 'fixed inset-0 md:relative md:inset-auto h-[100dvh] md:h-[calc(100dvh-73px)] z-0' : 'flex-1 container mx-auto px-4 pt-2 md:pt-8 max-w-5xl'}>
        <Outlet />
      </main>
      
      {/* Global Upload Widget */}
      <UploadIndicator />

      {/* Bottom Nav for Mobile - HIDDEN ON SHORTS */}
      {!isShortsMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center py-3 z-50 safe-area-bottom">
          <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
            <Home size={22} />
            <span className="text-[10px]">Home</span>
          </Link>

          <Link to="/shorts" className={`flex flex-col items-center gap-1 ${isActive('/shorts')}`}>
            <Smartphone size={22} />
            <span className="text-[10px]">Shorts</span>
          </Link>
          
          <Link to="/upload" className={`flex flex-col items-center gap-1 ${isActive('/upload')}`}>
            <Upload size={22} />
            <span className="text-[10px]">Upload</span>
          </Link>

          {user?.role === 'ADMIN' && (
             <Link to="/admin" className={`flex flex-col items-center gap-1 ${isActive('/admin')}`}>
              <ShieldCheck size={22} />
              <span className="text-[10px]">Admin</span>
            </Link>
          )}

          <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile')}`}>
            <Avatar size={22} />
            <span className="text-[10px]">Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
