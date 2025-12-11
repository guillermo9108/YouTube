
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/db';
import { Video } from '../types';

interface GridContextType {
    activeTask: Video | null;
    completeTask: (duration: number, thumbnail: File | null) => Promise<void>;
    skipTask: () => void;
    isIdle: boolean;
}

const GridContext = createContext<GridContextType | null>(null);

export const useGrid = () => {
    const context = useContext(GridContext);
    if (!context) throw new Error("useGrid must be used within GridProvider");
    return context;
};

export const GridProvider = ({ children }: { children?: React.ReactNode }) => {
    const { user } = useAuth();
    const [activeTask, setActiveTask] = useState<Video | null>(null);
    const [isIdle, setIsIdle] = useState(true);
    const intervalRef = useRef<number | null>(null);
    const processingRef = useRef(false);

    const fetchNextTask = async () => {
        // Don't fetch if already have a task or currently processing logic
        if (activeTask || processingRef.current) return;
        
        try {
            // Get 1 random pending video
            const pending = await db.getUnprocessedVideos(1, 'random');
            
            if (pending && pending.length > 0) {
                processingRef.current = true;
                setIsIdle(false);
                setActiveTask(pending[0]);
            } else {
                setIsIdle(true);
            }
        } catch (e) {
            console.warn("Grid Fetch Error", e);
            setIsIdle(true);
        }
    };

    const completeTask = async (duration: number, thumbnail: File | null) => {
        if (!activeTask) return;
        
        try {
            await db.updateVideoMetadata(activeTask.id, duration, thumbnail);
            // Short delay before next task to allow UI to show "Done" state
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error("Task submission failed", e);
        } finally {
            setActiveTask(null);
            processingRef.current = false;
            // Try to fetch next immediately
            fetchNextTask();
        }
    };

    const skipTask = () => {
        setActiveTask(null);
        processingRef.current = false;
    };

    // Poll for tasks
    useEffect(() => {
        if (user) {
            // Initial check
            fetchNextTask();

            // Periodic check (every 10 seconds)
            intervalRef.current = window.setInterval(() => {
                if (!document.hidden && !activeTask) {
                    fetchNextTask();
                }
            }, 10000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user, activeTask]);

    return (
        <GridContext.Provider value={{ activeTask, completeTask, skipTask, isIdle }}>
            {children}
        </GridContext.Provider>
    );
};
