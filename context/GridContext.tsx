
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
            // Use standardized DB service method
            const pending = await db.getUnprocessedVideos(1, 'random');
            
            if (!pending || pending.length === 0) return;

            const video = pending[0];
            isProcessingRef.current = true;

            const { thumbnail, duration } = await generateThumbnail(video.videoUrl);

            if (duration > 0) {
                await db.updateVideoMetadata(video.id, duration, thumbnail);
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
