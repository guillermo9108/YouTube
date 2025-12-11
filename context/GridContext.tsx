
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

// Configurable pause between tasks (in ms)
const TIMEOUT_BETWEEN_TASKS = 10000; // 10 seconds pause between "ads"

export const GridProvider = ({ children }: { children?: React.ReactNode }) => {
    const { user } = useAuth();
    const [activeTask, setActiveTask] = useState<Video | null>(null);
    const [isIdle, setIsIdle] = useState(true);
    
    // Refs to manage intervals and pauses
    const intervalRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const nextFetchTimeRef = useRef<number>(0);

    const fetchNextTask = async () => {
        // Conditions to NOT fetch:
        // 1. Already have a task
        // 2. Currently processing logic
        // 3. We are in the "pause" period (cooldown)
        if (activeTask || processingRef.current || Date.now() < nextFetchTimeRef.current) return;
        
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
            // Visual delay to show "Done" state in UI
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error("Task submission failed", e);
        } finally {
            setActiveTask(null);
            processingRef.current = false;
            
            // Set cooldown timer
            nextFetchTimeRef.current = Date.now() + TIMEOUT_BETWEEN_TASKS;
            setIsIdle(true);
        }
    };

    const skipTask = () => {
        setActiveTask(null);
        processingRef.current = false;
        // If skipped (error or closed), wait a bit shorter time (e.g. 5s)
        nextFetchTimeRef.current = Date.now() + 5000; 
        setIsIdle(true);
    };

    // Poll for tasks
    useEffect(() => {
        if (user) {
            // Periodic check loop
            intervalRef.current = window.setInterval(() => {
                // Only fetch if tab is active and we don't have a task
                if (!document.hidden && !activeTask) {
                    fetchNextTask();
                }
            }, 5000); // Check every 5 seconds (but fetchNextTask respects the cooldown)
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
