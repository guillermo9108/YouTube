
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
  let finalUrl = '';
  let isLocalBlob = false;
  let forceDirect = false;

  // STRATEGY: 
  // 1. Try to fetch the first 5MB (Header + First Frame) to create a local clean Blob.
  //    This bypasses CORS issues entirely for the canvas.
  // 2. If that fails, fall back to direct URL streaming.
  
  if (typeof fileOrUrl === 'string') {
      const url = fileOrUrl;
      
      if (url.startsWith('blob:')) {
          finalUrl = url;
          isLocalBlob = true;
      } else {
          try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

              // Only fetch 5MB. This is enough for metadata and the first few keyframes.
              const response = await fetch(url, {
                  headers: { 'Range': 'bytes=0-5242880' }, 
                  signal: controller.signal
              });
              clearTimeout(timeoutId);

              if (response.ok || response.status === 206) {
                  const blob = await response.blob();
                  // Ensure MIME type is video
                  const cleanBlob = new Blob([blob], { type: 'video/mp4' });
                  finalUrl = URL.createObjectURL(cleanBlob);
                  isLocalBlob = true;
              } else {
                  console.warn("Smart fetch rejected by server, falling back to direct URL");
                  forceDirect = true;
                  finalUrl = url; 
              }
          } catch (e) {
              console.warn("Smart fetch failed (Network/Timeout), falling back to direct URL", e);
              forceDirect = true;
              finalUrl = url;
          }
      }
  } else {
      finalUrl = URL.createObjectURL(fileOrUrl);
      isLocalBlob = true;
  }

  const cleanup = (video: HTMLVideoElement) => {
      try {
          video.pause();
          video.removeAttribute('src'); 
          video.load(); 
          video.remove();
          if (isLocalBlob && typeof fileOrUrl === 'string') {
              URL.revokeObjectURL(finalUrl);
          }
      } catch(e) {}
  };

  return new Promise((resolve) => {
      const video = document.createElement('video');
      
      // CRITICAL: 
      // If we made a local blob, NO crossOrigin needed (it's same-origin by definition).
      // If we are forcing direct URL because fetch failed, we TRY 'anonymous' first to get the image.
      // If 'anonymous' fails to load (error event), we might need to retry without it just to get duration.
      if (!isLocalBlob) {
          video.crossOrigin = "anonymous";
      }
      
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      // Mute/Volume 0 helps some browsers autoplay/load background video
      video.volume = 0; 
      document.body.appendChild(video);

      let resolved = false;
      const done = (data: { thumbnail: File | null, duration: number }) => {
          if (resolved) return;
          resolved = true;
          cleanup(video);
          resolve(data);
      };

      // Safety Timeout
      const timer = setTimeout(() => {
          // If we timed out but managed to get duration, return that at least.
          if (video.duration && !isNaN(video.duration) && video.duration > 0) {
              console.log("Timeout but got duration:", video.duration);
              done({ thumbnail: null, duration: video.duration });
          } else {
              console.log("Hard Timeout on video processing");
              done({ thumbnail: null, duration: 0 });
          }
      }, 25000); // 25s max total processing time

      video.onloadedmetadata = () => {
          // As soon as metadata loads, if we are in fallback mode and only care about duration, 
          // we could potentially stop here if image extraction is deemed impossible. 
          // But we try to seek to get the image.
          if (video.duration === Infinity) {
              video.currentTime = 1e101; // Fake seek to find end for duration
              video.currentTime = 0;
          }
      };

      video.onloadeddata = () => {
          // Seek to a safe spot. 
          // For very short videos (e.g. 1s), seeking to 1s might hit end.
          const targetTime = video.duration > 3 ? 1.0 : (video.duration * 0.1);
          video.currentTime = targetTime;
      };

      video.onseeked = async () => {
          if (!video.duration) return;

          try {
              const canvas = document.createElement('canvas');
              canvas.width = 640; 
              canvas.height = 360; 
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Check brightness to avoid black frames (common in first second)
                  const brightness = getBrightness(ctx, canvas.width, canvas.height);
                  if (brightness < 5 && video.currentTime < (Math.min(10, video.duration / 2))) {
                      console.log("Frame too dark, seeking forward...");
                      video.currentTime += 2; // Jump forward
                      return; // Wait for next seeked
                  }

                  canvas.toBlob((b) => {
                      if (b) {
                          const file = new File([b], "thumbnail.jpg", { type: "image/jpeg" });
                          clearTimeout(timer);
                          done({ thumbnail: file, duration: video.duration });
                      } else {
                          // Tainted canvas or generic error
                          clearTimeout(timer);
                          done({ thumbnail: null, duration: video.duration });
                      }
                  }, 'image/jpeg', 0.7);
              } else {
                  clearTimeout(timer);
                  done({ thumbnail: null, duration: video.duration });
              }
          } catch (e) {
              // SecurityError (Tainted Canvas) happens here if crossOrigin failed but video loaded.
              // We return the duration at least!
              console.warn("Canvas capture failed (likely CORS), returning duration only.", e);
              clearTimeout(timer);
              done({ thumbnail: null, duration: video.duration });
          }
      };

      video.onerror = (e) => {
          console.error("Video element error:", video.error);
          
          // Retry logic: If we failed with crossOrigin, try without it just to get duration?
          // Not easy to hot-swap attribute. We just fail here.
          // Usually means format unsupported or network 404.
          clearTimeout(timer);
          done({ thumbnail: null, duration: 0 });
      };

      video.src = finalUrl;
  });
};
