
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
  let useCrossOrigin = false;
  let isBlob = false;

  // 1. Determine Source Type
  if (typeof fileOrUrl !== 'string') {
      // It's a File object (Upload)
      finalUrl = URL.createObjectURL(fileOrUrl);
      isBlob = true;
  } else {
      // It's a URL
      const url = fileOrUrl;
      
      // Check if Same Origin (Local NAS/Server)
      // If the URL is relative (starts with api/ or /) or matches current origin, treat as Safe.
      const isSameOrigin = url.startsWith('/') || url.startsWith('api/') || url.indexOf(window.location.origin) > -1;

      if (url.startsWith('blob:')) {
          finalUrl = url;
          isBlob = true;
      } else if (isSameOrigin) {
          // SAME ORIGIN OPTIMIZATION:
          // Do NOT fetch. Do NOT use crossOrigin attribute.
          // Browser treats this as local trusted content.
          finalUrl = url;
          useCrossOrigin = false; 
      } else {
          // EXTERNAL URL (Pexels, YouTube proxy, etc.)
          // Try to fetch as blob to avoid CORS tainting, fallback to crossOrigin anonymous
          try {
              const controller = new AbortController();
              const id = setTimeout(() => controller.abort(), 5000);
              const response = await fetch(url, { headers: { 'Range': 'bytes=0-5242880' }, signal: controller.signal }); // 5MB limit
              clearTimeout(id);
              
              if (response.ok || response.status === 206) {
                  const blob = await response.blob();
                  finalUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
                  isBlob = true;
              } else {
                  throw new Error("Fetch failed");
              }
          } catch (e) {
              // Fallback to direct URL with Anonymous CORS
              console.warn("External fetch failed, using direct URL with CORS");
              finalUrl = url;
              useCrossOrigin = true;
          }
      }
  }

  const cleanup = (video: HTMLVideoElement) => {
      try {
          video.pause();
          video.removeAttribute('src'); 
          video.load(); 
          video.remove();
          if (isBlob) URL.revokeObjectURL(finalUrl);
      } catch(e) {}
  };

  return new Promise((resolve) => {
      const video = document.createElement('video');
      
      // CRITICAL: Only set crossOrigin if strictly necessary (External).
      // Setting it on Same-Origin without proper server headers can CAUSE errors.
      if (useCrossOrigin) {
          video.crossOrigin = "anonymous";
      }
      
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      // Position off-screen but visible to DOM (fixes some WebKit bugs)
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';
      
      document.body.appendChild(video);

      let resolved = false;
      const done = (data: { thumbnail: File | null, duration: number }) => {
          if (resolved) return;
          resolved = true;
          cleanup(video);
          resolve(data);
      };

      // Safety Timeout - 30s for NAS wake-up
      const timer = setTimeout(() => {
          console.warn("Thumbnail Gen Timeout", finalUrl);
          // If we have duration at least, return it
          if (video.duration && !isNaN(video.duration) && video.duration > 0) {
              done({ thumbnail: null, duration: video.duration });
          } else {
              done({ thumbnail: null, duration: 0 });
          }
      }, 30000);

      video.onloadedmetadata = () => {
          if (video.duration === Infinity) {
              video.currentTime = 1e101;
              video.currentTime = 0;
          }
      };

      video.onloadeddata = () => {
          // Seek to 10% or 2s, whichever is safer
          let target = 2.0;
          if (video.duration > 0) {
              if (video.duration < 5) target = video.duration * 0.2;
              else if (video.duration < 60) target = 5.0;
              else target = 15.0; // Deep seek for movies
          }
          video.currentTime = target;
      };

      let seekAttempts = 0;

      video.onseeked = () => {
          if (!video.duration) return;

          try {
              const canvas = document.createElement('canvas');
              canvas.width = 640; 
              canvas.height = 360; 
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Check brightness to avoid black frames
                  const brightness = getBrightness(ctx, canvas.width, canvas.height);
                  
                  // If too dark and we haven't tried seeking yet, try once more
                  if (brightness < 10 && seekAttempts < 1 && video.duration > 10) {
                      console.log("Frame too dark, seeking forward...");
                      seekAttempts++;
                      video.currentTime += 10;
                      return;
                  }

                  canvas.toBlob((b) => {
                      if (b) {
                          const file = new File([b], "thumbnail.jpg", { type: "image/jpeg" });
                          clearTimeout(timer);
                          done({ thumbnail: file, duration: video.duration });
                      } else {
                          clearTimeout(timer);
                          done({ thumbnail: null, duration: video.duration });
                      }
                  }, 'image/jpeg', 0.75);
              } else {
                  clearTimeout(timer);
                  done({ thumbnail: null, duration: video.duration });
              }
          } catch (e) {
              // Tainted canvas error (CORS)
              console.warn("Canvas Tainted (CORS), returning duration only.", e);
              clearTimeout(timer);
              done({ thumbnail: null, duration: video.duration });
          }
      };

      video.onerror = (e) => {
          console.error("Video Error Event", video.error);
          clearTimeout(timer);
          done({ thumbnail: null, duration: 0 });
      };

      video.src = finalUrl;
  });
};
