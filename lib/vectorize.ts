// This file encapsulates the logic for creating vector embeddings from text.

import { pipeline, Pipeline, PipelineType, FeatureExtractionPipeline } from '@xenova/transformers';
import { logger } from './logger.js';

class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: FeatureExtractionPipeline | null = null;

  static async getInstance() {
    if (this.instance === null) {
      // Suppress initialization messages to keep progress bar clean
      // logger.info('Initializing embedding model... (This may take a moment on first run)');
      this.instance = await pipeline(this.task as PipelineType, this.model) as FeatureExtractionPipeline;
      // logger.info('Embedding model initialized.');
    }
    return this.instance;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await EmbeddingPipeline.getInstance();
  if (!extractor) {
    throw new Error('Embedding pipeline not initialized.');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0; // Or throw an error
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
} 