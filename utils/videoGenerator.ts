
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

export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  // Add timestamp to prevent caching issues on the video stream
  const originalUrl = isFile ? URL.createObjectURL(fileOrUrl) : (fileOrUrl as string);
  const videoUrl = isFile ? originalUrl : `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

  const loadVideo = (mode: 'FULL' | 'SIMPLE'): Promise<{ thumbnail: File | null, duration: number }> => {
      return new Promise((resolve, reject) => {
          const video = document.createElement('video');
          video.preload = "metadata"; // Efficient loading
          video.muted = true;
          video.playsInline = true;
          
          // Hidden placement
          video.style.position = 'fixed';
          video.style.opacity = '0';
          video.style.pointerEvents = 'none';
          document.body.appendChild(video);

          // Cleanup helper
          const cleanup = () => {
              try {
                  video.pause();
                  video.removeAttribute('src');
                  video.load();
                  video.remove();
                  if (isFile && mode === 'SIMPLE') URL.revokeObjectURL(originalUrl);
              } catch(e) {}
          };

          // MODE CONFIG
          if (mode === 'FULL' && !isFile) {
              video.crossOrigin = "anonymous"; // Try to get CORS for Thumbnail
          } else {
              video.removeAttribute('crossOrigin'); // Opaque mode (Duration only)
          }

          // Timeout limits
          const timeoutMs = mode === 'FULL' ? 10000 : 30000; // Give 'SIMPLE' mode more time to just read metadata
          const timer = setTimeout(() => {
              cleanup();
              reject(new Error("Timeout"));
          }, timeoutMs);

          // HANDLERS
          video.onloadedmetadata = () => {
              // We have duration! 
              // If duration is Infinity (streaming), try to fix it, otherwise accept it.
              if (video.duration === Infinity) {
                  video.currentTime = 1e101;
                  video.currentTime = 0;
              }
              
              // If we are in SIMPLE mode, we can't use canvas (tainted), so stop here with duration.
              if (mode === 'SIMPLE') {
                  const d = (video.duration && video.duration !== Infinity) ? video.duration : 0;
                  clearTimeout(timer);
                  cleanup();
                  resolve({ thumbnail: null, duration: d });
              }
          };

          video.onloadeddata = () => {
              if (mode === 'FULL') {
                  video.currentTime = Math.min(5, video.duration / 2); // Seek for thumb
              }
          };

          video.onseeked = () => {
              if (mode !== 'FULL') return;

              try {
                  const canvas = document.createElement('canvas');
                  canvas.width = 640;
                  canvas.height = 360;
                  const ctx = canvas.getContext('2d');
                  
                  if (ctx) {
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      
                      // Check for black frame
                      if (getBrightness(ctx, canvas.width, canvas.height) < 5 && video.currentTime < 10) {
                          // If too dark, try one more jump if we haven't already (simplified logic here)
                          // For now, just accept what we have to avoid loops
                      }

                      canvas.toBlob(blob => {
                          clearTimeout(timer);
                          cleanup();
                          resolve({ 
                              thumbnail: blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null, 
                              duration: video.duration 
                          });
                      }, 'image/jpeg', 0.7);
                  } else {
                      throw new Error("Canvas Context Failed");
                  }
              } catch (e) {
                  // If canvas fails (tainted), fallback to returning just duration
                  clearTimeout(timer);
                  cleanup();
                  resolve({ thumbnail: null, duration: video.duration });
              }
          };

          video.onerror = () => {
              clearTimeout(timer);
              cleanup();
              reject(new Error(`Video Error: ${video.error?.code || 'Unknown'}`));
          };

          // START
          video.src = videoUrl;
      });
  };

  // --- EXECUTION FLOW ---
  
  if (isFile) {
      // Local file (Upload page) - Simple single attempt
      try {
          return await loadVideo('FULL');
      } catch (e) {
          return { thumbnail: null, duration: 0 };
      }
  } else {
      // Remote file (Admin Scanner) - Dual Strategy
      try {
          // Attempt 1: Full Metadata + Thumbnail (Requires proper CORS)
          // console.log("VideoGen: Attempting FULL scan...");
          return await loadVideo('FULL');
      } catch (e) {
          // console.warn("VideoGen: FULL scan failed, retrying SIMPLE (Duration only)...", e);
          try {
              // Attempt 2: Just Duration (Ignores CORS, element becomes opaque)
              return await loadVideo('SIMPLE');
          } catch (e2) {
              // console.error("VideoGen: All attempts failed.", e2);
              return { thumbnail: null, duration: 0 };
          }
      }
  }
};
