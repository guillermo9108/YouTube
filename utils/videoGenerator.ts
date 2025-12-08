
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

const blobCache = new Map<string, string>();

export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  let videoUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;
  let tempBlobUrl: string | null = null;

  // Cleanup helper
  const cleanup = (video: HTMLVideoElement) => {
      try {
          video.pause();
          video.removeAttribute('src'); 
          video.load(); 
          video.remove();
          if (isFile) URL.revokeObjectURL(videoUrl);
          if (tempBlobUrl) URL.revokeObjectURL(tempBlobUrl);
      } catch(e) {}
  };

  // --- STRATEGY 1: PARTIAL FETCH (The "Local File" Simulation) ---
  // We download the first 5MB. This bypasses CORS and usually gets the MOOV atom (metadata).
  if (!isFile) {
      try {
          // console.log("Attempting Partial Fetch (5MB)...");
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for fetch
          
          const response = await fetch(videoUrl, { 
              headers: { 'Range': 'bytes=0-5242880' }, // 5MB
              signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok || response.status === 206) {
              const blob = await response.blob();
              // Re-create blob with specific type to help browser
              const fixedBlob = new Blob([blob], { type: 'video/mp4' }); 
              tempBlobUrl = URL.createObjectURL(fixedBlob);
              // Use the blob URL instead of the remote URL
              videoUrl = tempBlobUrl; 
          }
      } catch (e) {
          console.warn("Partial fetch failed, falling back to direct stream.", e);
      }
  }

  // --- MAIN VIDEO PROCESSOR ---
  return new Promise((resolve) => {
      const video = document.createElement('video');
      
      // Config for maximum compatibility
      video.preload = "auto"; // Force load
      video.muted = true;
      video.playsInline = true;
      
      // If we are using a BLOB (Strategy 1), we don't need crossorigin (it's same-origin).
      // If we are using remote URL, we try anonymous first.
      if (!tempBlobUrl && !isFile) {
          video.crossOrigin = "anonymous";
      }
      
      // Hidden placement
      video.style.position = 'fixed';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      document.body.appendChild(video);

      let isResolved = false;
      
      const finalize = (thumb: File | null, dur: number) => {
          if (isResolved) return;
          isResolved = true;
          cleanup(video);
          resolve({ thumbnail: thumb, duration: dur });
      };

      // TIMEOUTS
      // 60s Hard Timeout (for NAS spin-up)
      const hardTimeout = setTimeout(() => {
          if (video.duration && video.duration > 0 && video.duration !== Infinity) {
              finalize(null, video.duration); // Return what we have
          } else {
              // Strategy 3: Rescue Mode. Return 1s duration so it marks as "processed" and doesn't loop forever.
              console.error("Hard timeout reached. Marking as 1s to skip.");
              finalize(null, 1); 
          }
      }, 60000);

      video.onloadedmetadata = () => {
          if (video.duration === Infinity) {
              video.currentTime = 1e101;
              video.currentTime = 0;
          }
      };

      video.onloadeddata = () => {
          let seekTarget = 1.0;
          if (video.duration > 5) seekTarget = 5.0;
          if (video.duration > 60) seekTarget = 15.0;
          
          // If using partial blob, ensure we don't seek past downloaded range
          if (tempBlobUrl && video.duration > 30) {
              seekTarget = 1.0; // Stay safe with blob
          }
          
          video.currentTime = seekTarget;
      };

      let attempts = 0;
      video.onseeked = () => {
          if (!video.duration) return;

          try {
              const canvas = document.createElement('canvas');
              canvas.width = 640; 
              canvas.height = 360; 
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Simple darkness check
                  if (getBrightness(ctx, canvas.width, canvas.height) < 10 && attempts < 1 && !tempBlobUrl) {
                      attempts++;
                      video.currentTime += 5; // Try jumping forward
                      return;
                  }

                  canvas.toBlob(blob => {
                      clearTimeout(hardTimeout);
                      if (blob) {
                          finalize(new File([blob], "thumb.jpg", { type: "image/jpeg" }), video.duration);
                      } else {
                          finalize(null, video.duration);
                      }
                  }, 'image/jpeg', 0.7);
              } else {
                  clearTimeout(hardTimeout);
                  finalize(null, video.duration);
              }
          } catch (e) {
              // Canvas tainted (CORS error) - This is expected if Strategy 2 is active
              // We successfully loaded video metadata, so just return the duration.
              clearTimeout(hardTimeout);
              // console.warn("Canvas security blocked thumbnail. Returning duration only.");
              finalize(null, video.duration);
          }
      };

      video.onerror = (e) => {
          // --- STRATEGY 2: DIRECT STREAM FALLBACK ---
          // If Strategy 1 (Blob) failed OR standard CORS failed
          if (video.crossOrigin === "anonymous" && !tempBlobUrl) {
              // console.log("CORS load failed. Retrying in Opaque Mode (Duration Only)...");
              video.removeAttribute('crossOrigin');
              video.src = videoUrl; // Reload same URL without CORS header
              return; // Let it retry
          }
          
          // If we are here, everything failed.
          console.error("Video load error", video.error);
          clearTimeout(hardTimeout);
          finalize(null, 0); // 0 indicates failure to Admin.tsx
      };

      // Start loading
      video.src = videoUrl;
  });
};
