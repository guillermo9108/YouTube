
// Helper to calculate image brightness
const getBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let colorSum = 0;

    for (let x = 0, len = data.length; x < len; x += 4) {
        const r = data[x];
        const g = data[x + 1];
        const b = data[x + 2];
        const avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
    }

    return Math.floor(colorSum / (width * height));
};

// Robust Video Thumbnail Generator
export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  const videoUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;

  return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      // Critical settings for background processing
      video.preload = "metadata"; // Priority 1: Get metadata first
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      
      // Hidden element
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '640px';
      video.style.height = '360px';
      video.style.opacity = '0';
      document.body.appendChild(video);

      let isResolved = false;

      const cleanup = () => {
          try {
              video.pause();
              video.removeAttribute('src');
              video.load();
              video.remove();
              if (isFile) URL.revokeObjectURL(videoUrl);
          } catch(e) {}
      };

      const finish = (thumb: File | null, dur: number) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ thumbnail: thumb, duration: Math.floor(dur) });
      };

      // Safety timeout (15s) - Reduced to prevent UI hanging too long
      const timeout = setTimeout(() => {
          console.warn("Video generator timed out for:", isFile ? (fileOrUrl as File).name : 'url');
          // Try to return at least duration if we got it
          const fallbackDur = (video.duration && isFinite(video.duration)) ? video.duration : 0;
          finish(null, fallbackDur);
      }, 15000);

      // --- STAGE 1: Metadata Loaded (Get Duration) ---
      video.onloadedmetadata = () => {
          const duration = video.duration;
          
          if (!isFinite(duration)) {
              // Streaming or corrupt duration
              video.currentTime = 1; // Try to force a seek to trigger loading
          } else {
              // We have duration, now try to get thumbnail
              // Seek to 20% or 2s to avoid black intro
              let seekTime = Math.min(2, duration / 5); 
              if (duration > 60) seekTime = 5; 
              video.currentTime = seekTime;
          }
      };

      // --- STAGE 2: Frame Ready (Capture Thumbnail) ---
      video.onseeked = () => {
          try {
              if (isResolved) return;

              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  canvas.toBlob(blob => {
                      const file = blob ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" }) : null;
                      const duration = (video.duration && isFinite(video.duration)) ? video.duration : 0;
                      finish(file, duration);
                  }, 'image/jpeg', 0.75); // Slightly lower quality for speed
              } else {
                  finish(null, video.duration || 0);
              }
          } catch (e) {
              console.error("Frame capture error", e);
              finish(null, video.duration || 0);
          }
      };

      // Error Handling (e.g., codec not supported by browser)
      video.onerror = (e) => {
          console.warn("Video load error (Codec likely unsupported):", e);
          finish(null, 0); // Return 0 duration so user can manually edit
      };

      // Start loading
      video.src = videoUrl;
  });
};
