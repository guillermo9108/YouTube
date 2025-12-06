
import React, { createContext, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/db';
import { generateThumbnail } from '../utils/videoGenerator';

const GridContext = createContext<null>(null);

export const GridProvider = ({ children }: { children?: React.ReactNode }) => {
    const { user } = useAuth();
    const intervalRef = useRef<number | null>(null);
    const isProcessingRef = useRef(false);

    const processNextTask = async () => {
        if (isProcessingRef.current) return;
        
        try {
            // Fetch 1 random unprocessed video
            // We use a custom fetch here because the DB service doesn't expose the 'limit' param directly yet
            const response = await fetch('api/index.php?action=get_unprocessed_videos&limit=1&mode=random');
            const json = await response.json();
            
            if (!json.success || !json.data || json.data.length === 0) return;

            const video = json.data[0];
            isProcessingRef.current = true;
            // console.log("StreamPay Grid: Processing background task...", video.title);

            const { thumbnail, duration } = await generateThumbnail(video.videoUrl);

            if (duration > 0) {
                await db.updateVideoMetadata(video.id, duration, thumbnail);
                // console.log("StreamPay Grid: Task completed.");
            }

        } catch (e) {
            console.warn("StreamPay Grid Task Error", e);
        } finally {
            isProcessingRef.current = false;
        }
    };

    useEffect(() => {
        if (user) {
            // Run initially
            processNextTask();

            // Run periodically (every 15 seconds) if user is logged in
            // This acts as a background worker
            intervalRef.current = window.setInterval(() => {
                // Only run if tab is visible to avoid killing battery in background background
                if (!document.hidden) {
                    processNextTask();
                }
            }, 15000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user]);

    return (
        <GridContext.Provider value={null}>
            {children}
        </GridContext.Provider>
    );
};
