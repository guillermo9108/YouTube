
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
  let isBlob = false;

  // 1. Determine Source Type
  if (typeof fileOrUrl !== 'string') {
      finalUrl = URL.createObjectURL(fileOrUrl);
      isBlob = true;
  } else {
      finalUrl = fileOrUrl;
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
      let attemptMode: 'CORS' | 'NO_CORS' = 'CORS';
      
      // Default config
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous"; // Try CORS first to get Thumbnail
      
      // Position off-screen
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

      // Safety Timeout - 45s for slow NAS
      const timer = setTimeout(() => {
          if (video.duration && !isNaN(video.duration) && video.duration > 0 && video.duration !== Infinity) {
              done({ thumbnail: null, duration: video.duration });
          } else {
              done({ thumbnail: null, duration: 0 });
          }
      }, 45000);

      video.onloadedmetadata = () => {
          if (video.duration === Infinity) {
              video.currentTime = 1e101;
              video.currentTime = 0;
          }
      };

      video.onloadeddata = () => {
          // Seek logic
          let target = 2.0;
          if (video.duration > 0) {
              if (video.duration < 5) target = video.duration * 0.2;
              else if (video.duration < 60) target = 5.0;
              else target = 15.0;
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
                  
                  if (brightness < 10 && seekAttempts < 1 && video.duration > 10) {
                      // console.log("Frame too dark, seeking forward...");
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
              // Tainted canvas (CORS error) or other issue
              // We successfully loaded video, so return duration at least
              clearTimeout(timer);
              done({ thumbnail: null, duration: video.duration });
          }
      };

      video.onerror = (e) => {
          // If CORS attempt failed, retry without CORS
          if (attemptMode === 'CORS' && !isBlob) {
              console.warn("CORS Load failed, retrying without CORS to recover Duration...");
              attemptMode = 'NO_CORS';
              video.removeAttribute('crossOrigin');
              video.src = finalUrl; // Reload
              video.load();
              return;
          }

          // If failed again or blob failed
          console.error("Video Error Event", video.error);
          clearTimeout(timer);
          done({ thumbnail: null, duration: 0 });
      };

      video.src = finalUrl;
  });
};
