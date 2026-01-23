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
                        // Uso de Uint8Array nativo para evitar bucles lentos y errores de codificación
                        const byteArray = new Uint8Array(data);
                        const contentType = format || "image/jpeg";
                        
                        const blob = new Blob([byteArray], { type: contentType });
                        const extension = contentType.includes('png') ? 'png' : 'jpg';
                        const file = new File([blob], `cover.${extension}`, { type: contentType });
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
 * Si es video, captura un frame. Si es audio, extrae metadatos ID3.
 */
export const generateThumbnail = async (fileOrUrl: File | string): Promise<{ thumbnail: File | null, duration: number }> => {
  const isFile = typeof fileOrUrl !== 'string';
  const mediaUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl as string;
  
  // Detección de tipo
  const isAudio = isFile 
    ? (fileOrUrl as File).type.startsWith('audio') 
    : (mediaUrl.toLowerCase().split('?')[0].split('&')[0].endsWith('.mp3'));

  let extractedThumbnail: File | null = null;
  
  // Si es audio, intentamos ID3 primero
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
              // Si es audio o no tiene dimensiones de video, terminamos con lo que tengamos de ID3
              if (isAudio || media.videoWidth === 0) {
                  finish(extractedThumbnail, duration);
              } else {
                  // Si es video, buscamos un frame
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
              canvas.width = media.videoWidth || 640;
              canvas.height = media.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(blob => {
                      const file = blob ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" }) : null;
                      finish(file, media.duration || 0);
                  }, 'image/jpeg', 0.85);
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