
import { env, pipeline } from '@xenova/transformers';

// Configuración estricta para entorno NAS/Offline
env.allowRemoteModels = false;
env.localModelPath = './models/';

class VectorService {
    private extractor: any = null;
    private loading = false;

    private async init() {
        if (this.extractor || this.loading) return;
        this.loading = true;
        try {
            this.extractor = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', {
                quantized: true,
            });
        } catch (e) {
            console.error("No se pudo cargar el modelo de IA local desde ./models/", e);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Genera un embedding vectorial a partir de texto
     */
    public async generateEmbedding(text: string): Promise<number[] | null> {
        await this.init();
        if (!this.extractor) return null;

        try {
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (e) {
            return null;
        }
    }

    /**
     * Calcula la similitud de coseno entre dos vectores
     */
    public cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let mA = 0;
        let mB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            mA += vecA[i] * vecA[i];
            mB += vecB[i] * vecB[i];
        }
        mA = Math.sqrt(mA);
        mB = Math.sqrt(mB);
        return dotProduct / (mA * mB) || 0;
    }

    /**
     * Promedia una lista de vectores para crear un perfil de interés
     */
    public averageVectors(vectors: number[][]): number[] | null {
        if (vectors.length === 0) return null;
        const size = vectors[0].length;
        const avg = new Array(size).fill(0);
        for (const vec of vectors) {
            for (let i = 0; i < size; i++) avg[i] += vec[i];
        }
        return avg.map(v => v / vectors.length);
    }
}

export const vectorService = new VectorService();
