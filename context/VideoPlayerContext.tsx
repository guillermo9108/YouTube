
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Video } from '../types';
import { useLocation } from '../components/Router';

interface VideoPlayerContextType {
    activeVideo: Video | null;
    currentTime: number;
    isPlaying: boolean;
    isMinimized: boolean;
    playVideo: (video: Video, startTime?: number) => void;
    togglePlay: () => void;
    closePlayer: () => void;
    updateTime: (time: number) => void;
    setPlaying: (playing: boolean) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

export const useVideoPlayer = () => {
    const context = useContext(VideoPlayerContext);
    if (!context) throw new Error("useVideoPlayer must be used within VideoPlayerProvider");
    return context;
};

export const VideoPlayerProvider = ({ children }: { children?: React.ReactNode }) => {
    const [activeVideo, setActiveVideo] = useState<Video | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const location = useLocation();

    // Gestión estricta de la visibilidad del mini-reproductor
    useEffect(() => {
        const isWatchPage = location.pathname.startsWith('/watch/');
        const isShortsPage = location.pathname === '/shorts';
        
        // Si estamos en Watch, NUNCA minimizamos (el video está en su lugar normal)
        if (isWatchPage) {
            setIsMinimized(false);
        } 
        // Si tenemos un video activo y salimos de Watch, minimizamos (excepto si entramos a Shorts)
        else if (activeVideo && !isShortsPage) {
            setIsMinimized(true);
        } 
        // En cualquier otro caso (como entrar a Shorts o no tener video), ocultamos el mini
        else {
            setIsMinimized(false);
        }
        
        // Pausar video global si entramos a Shorts para evitar conflictos de audio
        if (isShortsPage && isPlaying) {
            setIsPlaying(false);
        }
    }, [location.pathname, activeVideo]);

    const playVideo = (video: Video, startTime: number = 0) => {
        setActiveVideo(video);
        setCurrentTime(startTime);
        setIsPlaying(true);
        // Al llamar a playVideo, asumimos que estamos cargando un video nuevo
    };

    const togglePlay = () => setIsPlaying(prev => !prev);
    const setPlaying = (val: boolean) => setIsPlaying(val);
    
    const closePlayer = () => {
        setActiveVideo(null);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsMinimized(false);
    };

    const updateTime = (time: number) => setCurrentTime(time);

    return (
        <VideoPlayerContext.Provider value={{ 
            activeVideo, currentTime, isPlaying, isMinimized, 
            playVideo, togglePlay, closePlayer, updateTime, setPlaying
        }}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
