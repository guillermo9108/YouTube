
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

// Simplified Generator - Mostly for Local File Uploads now
export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  const videoUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;

  return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous"; // Needed for Canvas extraction if URL is remote
      
      video.style.position = 'fixed';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
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

      const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Video load timeout"));
      }, 15000);

      video.onloadedmetadata = () => {
          video.currentTime = Math.min(2, video.duration / 2);
      };

      video.onseeked = () => {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(blob => {
                      clearTimeout(timeout);
                      cleanup();
                      resolve({ 
                          thumbnail: blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null, 
                          duration: video.duration 
                      });
                  }, 'image/jpeg', 0.7);
              } else {
                  throw new Error("Canvas context failed");
              }
          } catch (e) {
              clearTimeout(timeout);
              cleanup();
              // Return duration at least, even if thumbnail fails
              resolve({ thumbnail: null, duration: video.duration || 0 });
          }
      };

      video.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          reject(new Error("Video load error"));
      };

      video.src = videoUrl;
  });
};
