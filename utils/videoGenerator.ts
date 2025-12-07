
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
  const isUrl = typeof fileOrUrl === 'string';
  let objectUrl = '';
  
  if (!isUrl) {
      objectUrl = URL.createObjectURL(fileOrUrl as File);
  }

  const loadVideo = (url: string, useCors: boolean): Promise<{video: HTMLVideoElement, duration: number}> => {
      return new Promise((resolve, reject) => {
          const video = document.createElement('video');
          if (useCors) {
              video.crossOrigin = "anonymous";
          }
          video.preload = "auto"; // Force load to get metadata/frame
          video.muted = true;
          video.playsInline = true;

          // Timeout differs based on mode
          const timeoutMs = useCors ? 20000 : 15000;
          const timer = setTimeout(() => {
              // RESCUE: If timeout happens but we have metadata/data (readyState >= 1), 
              // return what we have (likely Frame 0) instead of failing.
              if (video.readyState >= 1) { 
                  // console.warn("Timeout reached, capturing current state (Frame 0)");
                  resolve({ video, duration: video.duration || 0 });
              } else {
                  video.remove();
                  reject(new Error(useCors ? "CORS/Load Timeout" : "Metadata Timeout"));
              }
          }, timeoutMs);

          // Phase 1: Metadata Loaded (Duration available)
          video.onloadedmetadata = () => {
              if (!useCors) {
                  // If we don't need a thumbnail (fallback mode), we are done here
                  clearTimeout(timer);
                  resolve({ video, duration: video.duration || 0 });
                  return;
              }
              
              // OPTIMIZATION: Seek to 0.1s instead of 10% or 1s.
              // This ensures we get the first available frame almost immediately without buffering deep into the file.
              // This solves "Failed to load video" on slow connections/NAS.
              video.currentTime = 0.1; 
          };

          // Phase 2: Frame Ready (Thumbnail available)
          video.onseeked = () => {
              clearTimeout(timer);
              resolve({ video, duration: video.duration || 0 });
          };

          video.onerror = () => {
              // Try to rescue even on error if we have some data
              if (video.readyState >= 1) {
                  clearTimeout(timer);
                  resolve({ video, duration: video.duration || 0 });
              } else {
                  clearTimeout(timer);
                  video.remove();
                  reject(new Error("Video Load Error"));
              }
          };

          video.src = url;
      });
  };

  const src = isUrl ? (fileOrUrl as string) : objectUrl;

  try {
      // ATTEMPT 1: Secure Load (Try to get Thumbnail + Duration)
      const { video, duration } = await loadVideo(src, true); // try with CORS
      
      try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          const canvas = document.createElement('canvas');
          
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
          
          return new Promise((resolve) => {
              canvas.toBlob((blob) => {
                  video.remove();
                  if (objectUrl) URL.revokeObjectURL(objectUrl);
                  
                  if (blob) {
                      const thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                      resolve({ thumbnail: thumbFile, duration });
                  } else {
                      // Fallback if canvas is tainted but didn't throw
                      resolve({ thumbnail: null, duration });
                  }
              }, 'image/jpeg', 0.70);
          });

      } catch (drawError) {
          // If drawing fails (e.g. tainted canvas), just return duration
          video.remove();
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return { thumbnail: null, duration };
      }

  } catch (error) {
      // ATTEMPT 2: Insecure Load (Duration Only)
      // Only applicable for URLs (streaming from NAS), not local Files
      if (isUrl) {
          try {
              // console.warn("Retrying video in fallback mode (Duration Only)...");
              const { video, duration } = await loadVideo(src, false); // No CORS
              video.remove();
              // Success! We got the duration at least.
              return { thumbnail: null, duration };
          } catch (err2) {
              console.error("Fallback failed:", err2);
          }
      }
      
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return { thumbnail: null, duration: 0 };
  }
};
