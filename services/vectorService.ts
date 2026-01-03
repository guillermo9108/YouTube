
import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración para usar modelos locales únicamente
env.allowRemoteModels = false;
env.localModelPath = './models/';

class VectorService {
    private extractor: any = null;
    private isInitializing = false;

    async init() {
        if (this.extractor || this.isInitializing) return;
        this.isInitializing = true;
        try {
            // Usamos el modelo ligero MiniLM para móviles
            this.extractor = await pipeline('feature-extraction', 'all-MiniLM-L6-v2');
            console.log("VectorService: Modelo cargado localmente.");
        } catch (e) {
            console.error("VectorService Error:", e);
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Genera un embedding a partir de texto (título + descripción)
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.extractor) await this.init();
        if (!this.extractor) return [];

        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    /**
     * Calcula similitud de coseno entre dos vectores
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const vectorService = new VectorService();
