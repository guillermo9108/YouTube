
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

  const src = isUrl ? (fileOrUrl as string) : objectUrl;

  const cleanup = (video: HTMLVideoElement) => {
      try {
          video.pause();
          video.removeAttribute('src'); // Detach media source
          video.load(); // Force browser to release resources
          video.remove();
      } catch(e) {}
  };

  const loadVideo = (mode: 'cors' | 'no-cors'): Promise<{ video: HTMLVideoElement, duration: number, error?: boolean }> => {
      return new Promise((resolve) => {
          const video = document.createElement('video');
          // Important: In 'cors' mode we ask for permission to screenshot.
          // In 'no-cors', we accept we can't screenshot, but we want metadata (duration).
          if (mode === 'cors') video.crossOrigin = "anonymous";
          
          video.preload = "auto"; 
          video.muted = true;
          video.playsInline = true;

          let resolved = false;
          const done = (data: { video: HTMLVideoElement, duration: number, error?: boolean }) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              resolve(data);
          };

          // Timeout: If NAS doesn't respond in time, fail this attempt
          const timer = setTimeout(() => {
              // Rescue: If we at least got metadata, return success
              if (video.readyState > 0 && video.duration) {
                  done({ video, duration: video.duration });
              } else {
                  done({ video, duration: 0, error: true });
              }
          }, mode === 'cors' ? 10000 : 15000); 

          video.onloadedmetadata = () => {
              if (mode === 'no-cors') {
                  // In no-cors, we can't capture, so just resolve with duration
                  done({ video, duration: video.duration || 0 });
              } else {
                  // In cors mode, we seek to start to ensure we have a frame
                  video.currentTime = 0.1;
              }
          };

          video.onseeked = () => {
              done({ video, duration: video.duration || 0 });
          };

          video.onerror = () => {
              done({ video, duration: 0, error: true });
          };

          video.src = src;
          video.load();
          const p = video.play();
          if(p) p.catch(() => {}); // Ignore autoplay blocks
      });
  };

  // Step 1: Try Secure Load (CORS enabled) -> Needed for Thumbnail
  let result = await loadVideo('cors');

  // Step 2: Fallback to Insecure Load (No CORS) -> Needed for Duration if CORS headers missing on NAS
  // This allows "Failed to load" videos to at least be categorized and playable.
  if (result.error && isUrl) {
      // console.warn("CORS load failed, retrying no-cors for duration...");
      cleanup(result.video);
      result = await loadVideo('no-cors');
  }

  // Step 3: Extract Data
  let thumbFile: File | null = null;
  const duration = result.duration;

  if (duration > 0 && !result.error) {
      // Try to capture thumbnail
      try {
          const video = result.video;
          // Canvas will throw SecurityError if video loaded in no-cors mode (tainted)
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth > 480 ? 480 : video.videoWidth; // Reduce res for speed
          const scale = canvas.width / video.videoWidth;
          canvas.height = video.videoHeight * scale;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // This is where it fails if no-cors. We catch it.
              const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.6));
              if (blob) {
                  thumbFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
              }
          }
      } catch (e) {
          // Expected error in no-cors mode, just ignore image generation
      }
  }

  // Step 4: Cleanup
  // Ensure we fully detach to help the Garbage Collector
  cleanup(result.video);
  if (objectUrl) URL.revokeObjectURL(objectUrl);

  return { thumbnail: thumbFile, duration };
};
