import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Servicio de Inteligencia Artificial utilizando Google Gemini.
 * Se encarga de la generación automática de metadatos para optimizar la subida de contenidos.
 */

const getAIClient = () => {
    // La API KEY se obtiene exclusivamente de las variables de entorno configuradas.
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const aiService = {
    /**
     * Sugiere metadatos estructurados para un video basándose únicamente en su nombre de archivo.
     * @param filename Nombre original del archivo de video.
     * @returns Objeto JSON con título, descripción, categoría y etiquetas, o null en caso de error.
     */
    async suggestMetadata(filename: string) {
        const ai = getAIClient();
        if (!ai) return null;

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analiza el nombre de archivo: "${filename}" y genera metadatos optimizados para una plataforma de video.`,
                config: {
                    systemInstruction: "Eres un experto en curación de contenido y SEO de video. Tu tarea es extraer información relevante de nombres de archivo y generar un JSON puro con las propiedades: title (máx 60 chars), description (2 párrafos atractivos), category (GENERAL, MOVIES, SERIES, SPORTS, MUSIC u OTHER) y tags (array de 5 strings).",
                    responseMimeType: "application/json"
                }
            });

            // Se accede a .text directamente según las guías del SDK.
            const jsonText = response.text;
            if (!jsonText) return null;

            return JSON.parse(jsonText);
        } catch (e) {
            console.error("Gemini AI Service Error:", e);
            return null;
        }
    }
};