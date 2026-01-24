// @ts-ignore
import jsmediatags from 'jsmediatags';

/**
 * Extrae la carátula de un archivo de audio (MP3, etc.) usando jsmediatags.
 * Soporta tanto objetos File como URLs de streaming.
 */
const extractAudioCover = async (fileOrUrl: File | string): Promise<File | null> => {
    return new Promise((resolve) => {
        try {
            const reader = (jsmediatags as any).read || jsmediatags;
            reader(fileOrUrl, {
                onSuccess: (tag: any) => {
                    const picture = tag.tags.picture;
                    if (picture) {
                        const { data, format } = picture;
                        const byteArray = new Uint8Array(data);
                        const contentType = format || "image/jpeg";
                        
                        const blob = new Blob([byteArray], { type: contentType });
                        // Intentamos convertir a WebP para consistencia, de lo contrario JPG
                        const file = new File([blob], `cover.jpg`, { type: contentType });
                        resolve(file);
                    } else {
                        resolve(null);
                    }
                },
                onError: (error: any) => {
                    console.warn("jsmediatags error:", error);
                    resolve(null);
                }
            });
        } catch (e) {
            console.error("Error en extractAudioCover:", e);
            resolve(null);
        }
    });
};

/**
 * Generador robusto de miniaturas para Video y Audio.
 * Si es video, captura un frame en formato WebP (optimizado). 
 * Si es audio, extrae metadatos ID3.
 */
export const generateThumbnail = async (fileOrUrl: File | string, forceAudio?: boolean): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  const mediaUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;
  
  const isAudio = forceAudio ?? (isFile 
    ? (fileOrUrl as File).type.startsWith('audio') 
    : (
        mediaUrl.toLowerCase().includes('.mp3') || 
        mediaUrl.toLowerCase().includes('.m4a') || 
        mediaUrl.toLowerCase().includes('.aac')
      ));

  let extractedThumbnail: File | null = null;
  
  if (isAudio) {
      extractedThumbnail = await extractAudioCover(fileOrUrl);
  }

  return new Promise((resolve) => {
      const media = document.createElement('video');
      
      media.preload = "metadata"; 
      media.muted = true;
      media.playsInline = true;
      media.crossOrigin = "anonymous";
      
      media.style.position = 'fixed';
      media.style.top = '-9999px';
      media.style.left = '-9999px';
      media.style.opacity = '0';
      document.body.appendChild(media);

      let isResolved = false;

      const cleanup = () => {
          try {
              media.pause();
              media.removeAttribute('src');
              media.load();
              media.remove();
              if (isFile) URL.revokeObjectURL(mediaUrl);
          } catch(e) {}
      };

      const finish = (thumb: File | null, dur: number) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ thumbnail: thumb, duration: Math.floor(dur) });
      };

      // Timeout de seguridad (15s)
      const timeout = setTimeout(() => {
          const fallbackDur = (media.duration && isFinite(media.duration)) ? media.duration : 0;
          finish(extractedThumbnail, fallbackDur);
      }, 15000);

      media.onloadedmetadata = () => {
          const duration = media.duration;
          
          if (!isFinite(duration)) {
              media.currentTime = 1; 
          } else {
              if (isAudio || media.videoWidth === 0) {
                  finish(extractedThumbnail, duration);
              } else {
                  let seekTime = Math.min(2, duration / 5); 
                  if (duration > 60) seekTime = 5; 
                  media.currentTime = seekTime;
              }
          }
      };

      media.onseeked = () => {
          if (isResolved || isAudio || media.videoWidth === 0) return;

          try {
              const canvas = document.createElement('canvas');
              // Limitamos resolución de miniatura para ahorrar espacio en servidor
              const scale = Math.min(1, 640 / media.videoWidth);
              canvas.width = media.videoWidth * scale;
              canvas.height = media.videoHeight * scale;
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
                  // PRIORIDAD: WebP para máximo ahorro. Fallback a JPEG.
                  canvas.toBlob(blob => {
                      const file = blob ? new File([blob], "thumbnail.webp", { type: "image/webp" }) : null;
                      finish(file, media.duration || 0);
                  }, 'image/webp', 0.7);
              } else {
                  finish(extractedThumbnail, media.duration || 0);
              }
          } catch (e) {
              finish(extractedThumbnail, media.duration || 0);
          }
      };

      media.onerror = () => {
          finish(extractedThumbnail, 0);
      };

      media.src = mediaUrl;
  });
};