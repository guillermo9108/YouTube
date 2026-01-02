
import { env, pipeline } from '@xenova/transformers';

// Configuración estricta para entorno NAS/Offline
env.allowRemoteModels = false;
env.localModelPath = './models/';

class VectorService {
    private extractor: any = null;
    private loading = false;
    private failed = false;

    private async init() {
        if (this.extractor || this.loading || this.failed) return;
        this.loading = true;
        try {
            console.log("VectorService: Cargando motor de IA local...");
            this.extractor = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', {
                quantized: true,
            });
            console.log("VectorService: Motor listo.");
        } catch (e) {
            this.failed = true;
            console.error("VectorService: Error crítico. El modelo en ./models/ es inaccesible o está corrupto.", e);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Genera un embedding vectorial a partir de texto
     */
    public async generateEmbedding(text: string): Promise<number[] | null> {
        if (this.failed) return null;
        await this.init();
        if (!this.extractor) return null;

        try {
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (e) {
            console.warn("VectorService: No se pudo procesar el texto.");
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
        const result = dotProduct / (mA * mB);
        return isNaN(result) ? 0 : result;
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
