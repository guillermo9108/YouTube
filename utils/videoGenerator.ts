// @ts-ignore
import jsmediatags from 'jsmediatags';

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

/**
 * Extract Album Art from Audio using jsmediatags
 */
const extractAudioCover = async (fileOrUrl: File | string): Promise<File | null> => {
    return new Promise((resolve) => {
        try {
            jsmediatags.read(fileOrUrl, {
                onSuccess: (tag: any) => {
                    const { data, format } = tag.tags.picture || {};
                    if (data && format) {
                        let base64String = "";
                        for (let i = 0; i < data.length; i++) {
                            base64String += String.fromCharCode(data[i]);
                        }
                        const contentType = format;
                        const byteCharacters = base64String;
                        const byteArrays = [];
                        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                            const slice = byteCharacters.slice(offset, offset + 512);
                            const byteNumbers = new Array(slice.length);
                            for (let i = 0; i < slice.length; i++) {
                                byteNumbers[i] = slice.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            byteArrays.push(byteArray);
                        }
                        const blob = new Blob(byteArrays, { type: contentType });
                        const file = new File([blob], "cover.jpg", { type: contentType });
                        resolve(file);
                    } else {
                        resolve(null);
                    }
                },
                onError: () => resolve(null)
            });
        } catch (e) {
            resolve(null);
        }
    });
};

// Robust Video/Audio Thumbnail Generator
export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  const videoUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;
  const isAudio = isFile ? (fileOrUrl as File).type.startsWith('audio') : (videoUrl.toLowerCase().endsWith('.mp3'));

  // Stage 0: Audio specific extraction
  let audioThumbnail: File | null = null;
  if (isAudio) {
      audioThumbnail = await extractAudioCover(fileOrUrl);
  }

  return new Promise((resolve, reject) => {
      const media = document.createElement('video');
      
      // Critical settings for background processing
      media.preload = "metadata"; 
      media.muted = true;
      media.playsInline = true;
      media.crossOrigin = "anonymous";
      
      // Hidden element
      media.style.position = 'fixed';
      media.style.top = '-9999px';
      media.style.left = '-9999px';
      media.style.width = '640px';
      media.style.height = '360px';
      media.style.opacity = '0';
      document.body.appendChild(media);

      let isResolved = false;

      const cleanup = () => {
          try {
              media.pause();
              media.removeAttribute('src');
              media.load();
              media.remove();
              if (isFile) URL.revokeObjectURL(videoUrl);
          } catch(e) {}
      };

      const finish = (thumb: File | null, dur: number) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ thumbnail: thumb, duration: Math.floor(dur) });
      };

      // Safety timeout (15s)
      const timeout = setTimeout(() => {
          console.warn("Media generator timed out for:", isFile ? (fileOrUrl as File).name : 'url');
          const fallbackDur = (media.duration && isFinite(media.duration)) ? media.duration : 0;
          finish(audioThumbnail, fallbackDur);
      }, 15000);

      // --- STAGE 1: Metadata Loaded (Get Duration) ---
      media.onloadedmetadata = () => {
          const duration = media.duration;
          
          if (!isFinite(duration)) {
              media.currentTime = 1; 
          } else {
              if (isAudio || media.videoWidth === 0) {
                  // If it's audio or no video stream, just finish with duration and the audio cover if found
                  finish(audioThumbnail, duration);
              } else {
                  // Seek to 20% or 2s to avoid black intro
                  let seekTime = Math.min(2, duration / 5); 
                  if (duration > 60) seekTime = 5; 
                  media.currentTime = seekTime;
              }
          }
      };

      // --- STAGE 2: Frame Ready (Capture Thumbnail) ---
      media.onseeked = () => {
          try {
              if (isResolved || isAudio || media.videoWidth === 0) return;

              const canvas = document.createElement('canvas');
              canvas.width = media.videoWidth || 640;
              canvas.height = media.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
                  
                  canvas.toBlob(blob => {
                      const file = blob ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" }) : null;
                      const duration = (media.duration && isFinite(media.duration)) ? media.duration : 0;
                      finish(file, duration);
                  }, 'image/jpeg', 0.75);
              } else {
                  finish(audioThumbnail, media.duration || 0);
              }
          } catch (e) {
              console.error("Frame capture error", e);
              finish(audioThumbnail, media.duration || 0);
          }
      };

      // Error Handling
      media.onerror = (e) => {
          console.warn("Media load error:", e);
          finish(audioThumbnail, 0);
      };

      // Start loading
      media.src = videoUrl;
  });
};