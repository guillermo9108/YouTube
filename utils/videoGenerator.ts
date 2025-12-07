
// Helper to calculate image brightness
const getBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;

    for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x];
        g = data[x + 1];
        b = data[x + 2];
        avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
    }

    return Math.floor(colorSum / (width * height));
};

export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    
    // Critical for processing videos served from the API
    video.crossOrigin = "anonymous"; 
    // Force browser to negotiate stream immediately
    video.preload = "auto"; 
    
    let objectUrl = '';
    if (typeof fileOrUrl === 'string') {
        video.src = fileOrUrl;
    } else {
        objectUrl = URL.createObjectURL(fileOrUrl);
        video.src = objectUrl;
    }
    
    // Safety Timeout (60 seconds - increased for slow NAS streams)
    const timeout = setTimeout(() => {
        if(objectUrl) URL.revokeObjectURL(objectUrl);
        video.remove();
        console.warn("Thumbnail generation timed out for:", fileOrUrl);
        resolve({ thumbnail: null, duration: 0 });
    }, 60000);

    video.muted = true;
    video.playsInline = true;

    // Checkpoints to try if frame is dark
    const attemptPoints = [0, 0.15, 0.50]; 
    let currentAttempt = 0;

    const captureFrame = () => {
        try {
            const width = video.videoWidth;
            const height = video.videoHeight;
            
            if (width === 0 || height === 0) {
                // Video might not be ready
                throw new Error("Invalid video dimensions");
            }

            const canvas = document.createElement('canvas');
            
            // Optimization: Scale down max width
            if (width > 640) { 
                const scale = 640 / width;
                canvas.width = 640;
                canvas.height = height * scale;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const brightness = getBrightness(ctx, canvas.width, canvas.height);
            const duration = video.duration || 0;

            if (brightness < 20 && currentAttempt < attemptPoints.length - 1) {
                currentAttempt++;
                if (duration > 0) {
                    const nextTime = Math.max(1.0, duration * attemptPoints[currentAttempt]);
                    video.currentTime = nextTime;
                    return; // Wait for seeked event again
                }
            }

            canvas.toBlob((blob) => {
                clearTimeout(timeout);
                if (blob) {
                    const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    resolve({ thumbnail: thumbFile, duration });
                } else {
                    resolve({ thumbnail: null, duration: 0 });
                }
                if(objectUrl) URL.revokeObjectURL(objectUrl);
                video.remove();
            }, 'image/jpeg', 0.70);

        } catch (e) {
            console.error("Frame capture error:", e);
            clearTimeout(timeout);
            if(objectUrl) URL.revokeObjectURL(objectUrl);
            video.remove();
            resolve({ thumbnail: null, duration: 0 });
        }
    };

    video.onloadedmetadata = () => {
        // Seek to 1s or 10% to avoid black start frames
        const target = Math.min(10, (video.duration || 0) * 0.1);
        video.currentTime = Math.max(1.0, target);
    };

    video.onseeked = captureFrame;
    
    video.onerror = (e) => {
        // Do not immediately resolve null. 
        // Allow the browser to retry network errors internally until the main timeout hits.
        console.warn("Video load warning (retrying internally):", e);
    };
  });
};
