// @ts-ignore
import jsmediatags from 'jsmediatags';

/**
 * Intenta extraer la carátula de un audio con un timeout estricto.
 */
const extractAudioCoverSafe = async (fileOrUrl: File | string): Promise<File | null> => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn("jsmediatags: Timeout alcanzado");
            resolve(null);
        }, 5000); // No esperar más de 5s por los tags

        try {
            const reader = (jsmediatags as any).read || jsmediatags;
            reader(fileOrUrl, {
                onSuccess: (tag: any) => {
                    clearTimeout(timeout);
                    const picture = tag.tags.picture;
                    if (picture) {
                        const { data, format } = picture;
                        const byteArray = new Uint8Array(data);
                        const contentType = format || "image/jpeg";
                        const blob = new Blob([byteArray], { type: contentType });
                        const file = new File([blob], `cover.jpg`, { type: contentType });
                        resolve(file);
                    } else {
                        resolve(null);
                    }
                },
                onError: (error: any) => {
                    clearTimeout(timeout);
                    console.warn("jsmediatags: Error en lectura", error);
                    resolve(null);
                }
            });
        } catch (e) {
            clearTimeout(timeout);
            console.error("jsmediatags: Excepción", e);
            resolve(null);
        }
    });
};

/**
 * Generador ultra-robusto de miniaturas y duración.
 * Garantiza resolución en máximo 15 segundos incluso si el archivo está dañado.
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

  return new Promise(async (resolve) => {
      let isResolved = false;
      let extractedThumbnail: File | null = null;

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
          clearTimeout(mainTimeout);
          cleanup();
          resolve({ thumbnail: thumb, duration: Math.floor(dur) });
      };

      // Timeout Maestro (15s) - Garantía de que nada se queda colgado
      const mainTimeout = setTimeout(() => {
          console.warn("ThumbnailGenerator: Timeout Maestro alcanzado");
          const fallbackDur = (media.duration && isFinite(media.duration)) ? media.duration : 0;
          finish(extractedThumbnail, fallbackDur);
      }, 15000);

      // Si es audio, disparamos la extracción de tags en paralelo
      if (isAudio) {
          extractAudioCoverSafe(fileOrUrl).then(thumb => {
              extractedThumbnail = thumb;
          });
      }

      media.onloadedmetadata = () => {
          const duration = media.duration;
          if (!isFinite(duration)) {
              media.currentTime = 0.5; 
          } else {
              if (isAudio || media.videoWidth === 0) {
                  // Si pasaron 2s y ya tenemos metadata, terminamos (esperamos un poco a que jsmediatags termine si puede)
                  setTimeout(() => finish(extractedThumbnail, duration), 1000);
              } else {
                  media.currentTime = Math.min(2, duration / 2);
              }
          }
      };

      media.onseeked = () => {
          if (isResolved || isAudio || media.videoWidth === 0) return;

          try {
              const canvas = document.createElement('canvas');
              const scale = Math.min(1, 640 / media.videoWidth);
              canvas.width = media.videoWidth * scale;
              canvas.height = media.videoHeight * scale;
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(blob => {
                      const file = blob ? new File([blob], "thumbnail.webp", { type: "image/webp" }) : null;
                      finish(file, media.duration || 0);
                  }, 'image/webp', 0.7);
              } else {
                  finish(null, media.duration || 0);
              }
          } catch (e) {
              finish(null, media.duration || 0);
          }
      };

      media.onerror = () => {
          console.error("Media Error durante extracción");
          // Si el media falla, quizás los tags ID3 sí funcionaron
          setTimeout(() => finish(extractedThumbnail, 0), 500);
      };

      media.src = mediaUrl;
  });
};