
import React, { useState, useEffect } from 'react';
import { DownloadCloud, Wifi, Search, Check, Clock, AlertCircle, Trash2, Upload } from 'lucide-react';
import { db } from '../services/db';
import { ContentRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/Router';

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadRequests = () => {
    setLoading(true);
    db.getRequests().then(res => {
      // Filter only my requests if not admin? Or show all? Let's show all for community feel, or just mine.
      // For now, let's show all so people see what's trending, but usually per user.
      // Let's filter client side for now if needed, but API returns all.
      // Assuming we only want to see OUR requests for now unless admin.
      const myRequests = user?.role === 'ADMIN' ? res : res.filter(r => r.userId === user?.id);
      setRequests(myRequests);
      setLoading(false);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;

    setIsSubmitting(true);
    try {
      await db.requestContent(user.id, query, useLocal);
      setQuery('');
      loadRequests();
    } catch (e) {
      alert("Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this request?')) {
      await db.deleteRequest(id);
      loadRequests();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <DownloadCloud className="text-indigo-400" /> Content Requests
        </h2>
        <p className="text-slate-400 text-sm">
          Request content from YouTube to be added to the platform.
        </p>
      </div>

      {/* Request Form */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search Query / Topic</label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="E.g. 'Funny Cat Shorts' or 'Coding Tutorials'"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer" onClick={() => setUseLocal(!useLocal)}>
            <div className={`w-5 h-5 rounded border flex items-center justify-center ${useLocal ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
              {useLocal && <Check size={14} className="text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <Wifi size={16} /> Use my device network
              </div>
              <p className="text-xs text-slate-500">
                I will download/upload the videos myself. Do not use server bandwidth.
              </p>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !query.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* Requests List */}
      <div>
        <h3 className="font-bold text-slate-300 mb-4">My Requests History</h3>
        
        <div className="space-y-3">
          {requests.length === 0 && !loading && (
            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No active requests.
            </div>
          )}

          {requests.map(req => (
            <div key={req.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 
                    ${req.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 
                      req.status === 'FAILED' ? 'bg-red-500/20 text-red-400' : 
                      req.status === 'MANUAL_UPLOAD' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-indigo-500/20 text-indigo-400'}`}>
                    {req.status === 'COMPLETED' ? <Check size={20} /> : 
                     req.status === 'FAILED' ? <AlertCircle size={20} /> :
                     req.status === 'MANUAL_UPLOAD' ? <Upload size={20} /> :
                     <Clock size={20} />}
                 </div>
                 <div>
                    <h4 className="font-bold text-white text-lg">{req.query}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                       <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                       <span>•</span>
                       <span className={`font-bold ${
                         req.status === 'PENDING' ? 'text-amber-400' : 
                         req.status === 'PROCESSING' ? 'text-blue-400' : 
                         req.status === 'COMPLETED' ? 'text-emerald-400' :
                         req.status === 'MANUAL_UPLOAD' ? 'text-amber-300' : 'text-red-400'
                       }`}>
                         {req.status.replace('_', ' ')}
                       </span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 {/* Action for Manual Upload */}
                 {(req.status === 'MANUAL_UPLOAD' || req.useLocalNetwork) && req.status !== 'COMPLETED' && (
                    <button 
                      onClick={() => navigate('/upload')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                    >
                      <Upload size={16} /> Upload Now
                    </button>
                 )}

                 {req.status === 'PENDING' && (
                   <button 
                     onClick={() => handleDelete(req.id)}
                     className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                     title="Cancel Request"
                   >
                     <Trash2 size={18} />
                   </button>
                 )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
