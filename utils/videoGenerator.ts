
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
  let blob: Blob | null = null;
  let finalUrl = '';
  let isLocalBlob = false;

  // STRATEGY: Mimic "Upload" behavior by making remote files local via Fetch (Partial Download)
  if (typeof fileOrUrl === 'string') {
      // It's a URL (NAS or Remote)
      const url = fileOrUrl;
      
      // Check if it's already a blob URL
      if (url.startsWith('blob:')) {
          finalUrl = url;
          isLocalBlob = true;
      } else {
          // Attempt to download the first 50MB to get header + first frame
          // This bypasses CORS canvas tainting because we create a local object URL from the response
          try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

              const response = await fetch(url, {
                  headers: { 'Range': 'bytes=0-52428800' }, // Request first 50MB
                  signal: controller.signal
              });
              clearTimeout(timeoutId);

              if (response.ok || response.status === 206) {
                  const contentType = response.headers.get('content-type') || 'video/mp4';
                  blob = await response.blob();
                  // Force correct MIME if generic
                  if (blob.type === 'application/octet-stream' || !blob.type) {
                      blob = new Blob([blob], { type: 'video/mp4' });
                  } else {
                      // Re-wrap to ensure type is preserved
                      blob = new Blob([blob], { type: contentType });
                  }
                  
                  finalUrl = URL.createObjectURL(blob);
                  isLocalBlob = true;
              } else {
                  // Fallback to direct streaming if range request fails
                  finalUrl = url; 
              }
          } catch (e) {
              console.warn("Smart fetch failed, falling back to direct URL", e);
              finalUrl = url;
          }
      }
  } else {
      // It's a File object (Upload page)
      blob = fileOrUrl;
      finalUrl = URL.createObjectURL(blob);
      isLocalBlob = true;
  }

  const cleanup = (video: HTMLVideoElement) => {
      try {
          video.pause();
          video.removeAttribute('src'); 
          video.load(); 
          video.remove();
          // Only revoke if we created it here (remote fetch case)
          if (isLocalBlob && typeof fileOrUrl === 'string') {
              URL.revokeObjectURL(finalUrl);
          }
      } catch(e) {}
  };

  return new Promise((resolve) => {
      const video = document.createElement('video');
      
      // IMPORTANT: If it is a local blob (from File or Fetch), we DO NOT need crossOrigin.
      // If it is a remote URL (fallback), we DO need it.
      if (!isLocalBlob) {
          video.crossOrigin = "anonymous";
      }
      
      video.preload = "metadata"; // We only need start
      video.muted = true;
      video.playsInline = true;
      // Force hardware acceleration constraints to avoid black frames on some GPUs
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      document.body.appendChild(video);

      let resolved = false;
      const done = (data: { thumbnail: File | null, duration: number }) => {
          if (resolved) return;
          resolved = true;
          cleanup(video);
          resolve(data);
      };

      // Timeout for processing
      const timer = setTimeout(() => {
          // If we have duration but no image, return that
          if (video.duration && !isNaN(video.duration) && video.duration > 0) {
              done({ thumbnail: null, duration: video.duration });
          } else {
              done({ thumbnail: null, duration: 0 });
          }
      }, 15000);

      video.onloadeddata = () => {
          // Seek to 1 second or 25% if very short
          const targetTime = video.duration > 5 ? 1.0 : (video.duration * 0.25);
          video.currentTime = targetTime;
      };

      video.onseeked = async () => {
          if (!video.duration) return;

          try {
              const canvas = document.createElement('canvas');
              // Use reasonable resolution for thumbnail
              canvas.width = 640; 
              canvas.height = 360; 
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Check if black frame
                  const brightness = getBrightness(ctx, canvas.width, canvas.height);
                  if (brightness < 5 && video.currentTime < (video.duration / 2)) {
                      // If frame is too dark, try seeking further
                      video.currentTime += 5;
                      return; // Wait for next seeked event
                  }

                  canvas.toBlob((b) => {
                      if (b) {
                          const file = new File([b], "thumbnail.jpg", { type: "image/jpeg" });
                          clearTimeout(timer);
                          done({ thumbnail: file, duration: video.duration });
                      } else {
                          // Canvas tainted or error
                          clearTimeout(timer);
                          done({ thumbnail: null, duration: video.duration });
                      }
                  }, 'image/jpeg', 0.7);
              } else {
                  clearTimeout(timer);
                  done({ thumbnail: null, duration: video.duration });
              }
          } catch (e) {
              console.error("Canvas capture error", e);
              clearTimeout(timer);
              done({ thumbnail: null, duration: video.duration });
          }
      };

      video.onerror = () => {
          clearTimeout(timer);
          done({ thumbnail: null, duration: 0 });
      };

      video.src = finalUrl;
      video.load();
  });
};
