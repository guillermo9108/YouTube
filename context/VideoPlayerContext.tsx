
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
    setMinimized: (min: boolean) => void;
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

    // Auto-gestión de visibilidad del mini-reproductor basada en la ruta
    useEffect(() => {
        const isWatchPage = location.pathname.startsWith('/watch/');
        const isShortsPage = location.pathname === '/shorts';
        
        if (isWatchPage) {
            setIsMinimized(false);
        } else if (activeVideo && !isShortsPage) {
            setIsMinimized(true);
        } else {
            setIsMinimized(false);
        }
        
        // Si entramos a shorts, pausamos el video global
        if (isShortsPage && isPlaying) {
            setIsPlaying(false);
        }
    }, [location.pathname, activeVideo]);

    const playVideo = (video: Video, startTime: number = 0) => {
        setActiveVideo(video);
        setCurrentTime(startTime);
        setIsPlaying(true);
        setIsMinimized(false);
    };

    const togglePlay = () => setIsPlaying(!isPlaying);
    
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
            playVideo, togglePlay, closePlayer, updateTime, setMinimized: setIsMinimized 
        }}>
            {children}
        </VideoPlayerContext.Provider>
    );
};
