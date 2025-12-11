
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
      video.preload = "auto"; // Force load data
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

      const cleanup = () => {
          try {
              video.pause();
              video.removeAttribute('src');
              video.load();
              video.remove();
              if (isFile) URL.revokeObjectURL(videoUrl);
          } catch(e) {}
      };

      // Safety timeout (20s)
      const timeout = setTimeout(() => {
          cleanup();
          // Fallback: return what we have (duration might be known even if seek failed)
          const fallbackDur = video.duration && isFinite(video.duration) ? video.duration : 0;
          console.warn("Video thumb generator timed out");
          resolve({ thumbnail: null, duration: fallbackDur });
      }, 20000);

      // 1. Data Loaded -> Seek to representative frame
      video.onloadeddata = () => {
          const duration = video.duration;
          // Seek to 10% or 2 seconds, whichever is safe, to avoid black intro frames
          let seekTime = Math.min(2, duration / 2);
          if (duration > 60) seekTime = 5; // Long video? Take 5th second
          
          video.currentTime = seekTime;
      };

      // 2. Seeked -> Capture Frame
      video.onseeked = () => {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Optional: Check brightness to ensure not black frame?
                  // Skipping for performance/simplicity now.

                  canvas.toBlob(blob => {
                      clearTimeout(timeout);
                      cleanup();
                      const file = blob ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" }) : null;
                      const duration = video.duration && isFinite(video.duration) ? video.duration : 0;
                      resolve({ thumbnail: file, duration });
                  }, 'image/jpeg', 0.8);
              } else {
                  throw new Error("Canvas failed");
              }
          } catch (e) {
              console.error("Frame capture error", e);
              clearTimeout(timeout);
              cleanup();
              resolve({ thumbnail: null, duration: video.duration || 0 });
          }
      };

      video.onerror = (e) => {
          console.error("Video load error", e);
          clearTimeout(timeout);
          cleanup();
          resolve({ thumbnail: null, duration: 0 }); // Return empty on hard error
      };

      // Start loading
      video.src = videoUrl;
      video.load();
  });
};
