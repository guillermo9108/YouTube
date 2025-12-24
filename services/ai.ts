
import { GoogleGenAI } from "@google/genai";

// Inicialización asumiendo que la clave viene del entorno como pide la guía
// Si no hay clave, las funciones devolverán null de forma segura
const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const aiService = {
    /**
     * Sugiere metadatos para un video basado en su nombre de archivo
     */
    async suggestMetadata(filename: string) {
        const ai = getAIClient();
        if (!ai) return null;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Eres un experto en curación de contenido de video. 
                Basado en el nombre de archivo: "${filename}", genera un JSON con:
                - title: Un título atractivo (máx 60 chars)
                - description: Una descripción de 2 párrafos que incite a ver el video.
                - category: Una de estas: [GENERAL, MOVIES, SERIES, SPORTS, MUSIC, OTHER]
                - tags: 5 etiquetas relevantes.
                Responde ÚNICAMENTE el JSON puro.`,
                config: {
                    responseMimeType: "application/json"
                }
            });

            return JSON.parse(response.text || '{}');
        } catch (e) {
            console.error("Gemini AI Error:", e);
            return null;
        }
    }
};
