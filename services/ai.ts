import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Video } from "../types";

/**
 * Servicio de Inteligencia Artificial utilizando Google Gemini.
 */

const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const aiService = {
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

            const jsonText = response.text;
            if (!jsonText) return null;
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("Gemini AI Service Error:", e);
            return null;
        }
    },

    /**
     * Chat interactivo para recomendar contenido basado en el catálogo actual.
     */
    async chatWithConcierge(userMessage: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], availableVideos: Video[]) {
        const ai = getAIClient();
        if (!ai) return "Configuración de IA no disponible.";

        const context = availableVideos.map(v => `- ${v.title} (${v.category}, Precio: ${v.price} Saldo, ID: ${v.id})`).join('\n');

        try {
            const chat = ai.chats.create({
                model: 'gemini-3-flash-preview',
                config: {
                    systemInstruction: `Eres el Conserje de StreamPay, un asistente elegante y experto en cine.
                    Tu catálogo actual es:\n${context}\n
                    Reglas:
                    1. Recomienda videos específicos de la lista.
                    2. Sé breve y entusiasta.
                    3. Si el usuario pregunta por precios, guíalo.
                    4. No inventes videos que no estén en la lista.
                    5. Responde siempre en español.`,
                }
            });

            // Enviar historial previo si existe
            // (Simplificado para este ejemplo enviando el mensaje actual)
            const response = await chat.sendMessage({ message: userMessage });
            return response.text || "Lo siento, no pude procesar tu solicitud.";
        } catch (e) {
            console.error("Concierge Error:", e);
            return "Tuve un pequeño problema técnico. ¿Podemos intentarlo de nuevo?";
        }
    }
};