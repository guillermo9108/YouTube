import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, User, Bot } from 'lucide-react';
import { aiService } from '../services/ai';
import { Video } from '../types';
import { Link } from './Router';

interface Message {
    role: 'user' | 'model';
    text: string;
}

export default function AIConcierge({ videos }: { videos: Video[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: '¡Hola! Soy tu Conserje de StreamPay. ¿Buscas algo especial para ver hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const response = await aiService.chatWithConcierge(userMsg, [], videos);
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: "Lo siento, mi conexión se ha interrumpido." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-24 md:bottom-8 left-4 z-[100]">
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
                >
                    <Sparkles className="group-hover:animate-pulse" />
                    <div className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-slate-950"></div>
                </button>
            ) : (
                <div className="w-80 md:w-96 h-[500px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                <Bot size={18} className="text-white"/>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">IA Concierge</h3>
                                <p className="text-[10px] text-emerald-500 font-bold uppercase">En línea</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={20}/></button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                                    <span className="text-xs text-slate-400 italic">Buscando en catálogo...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSend} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="¿Qué me recomiendas?"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                        />
                        <button 
                            disabled={!input.trim() || isLoading}
                            className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all shadow-lg"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}