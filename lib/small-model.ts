/**
 * Small Model Client - OpenRouter GPT-OSS Integration
 * Handles intent classification and candidate reranking for token efficiency
 */

import { logger } from './logger.js';

export interface SmallModelConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  cacheTTL: number; // Cache results for this many ms
}

export function getDefaultSmallModelConfig(): SmallModelConfig {
  return {
    enabled: true,
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash', // Much better than GPT-OSS for reasoning
    timeout: 15000, // 15 seconds (Gemini can be a bit slower but much smarter)
    maxRetries: 2,
    cacheTTL: 5 * 60 * 1000 // 5 minutes
  };
}

export const DEFAULT_SMALL_MODEL_CONFIG: SmallModelConfig = getDefaultSmallModelConfig();

export interface IntentClassification {
  files: boolean;
  pages: boolean;
  assignments: boolean;
  discussions: boolean;
  grades: boolean;
  calendar: boolean;
  confidence: number;
  reasoning: string;
}

export interface RerankCandidate {
  id: string;
  title: string;
  source: string;
  snippet?: string;
  type: 'file' | 'page' | 'link' | 'assignment';
}

export interface RerankResult {
  id: string;
  score: number;
  reasoning: string;
}

// Cache for small model results
const intentCache = new Map<string, { result: IntentClassification; timestamp: number }>();
const rerankCache = new Map<string, { result: RerankResult[]; timestamp: number }>();

/**
 * Generate cache key for intent classification
 */
function getIntentCacheKey(query: string, courseId?: string): string {
  return `intent_${courseId || 'global'}_${query.toLowerCase().trim()}`;
}

/**
 * Generate cache key for reranking
 */
function getRerankCacheKey(query: string, candidates: RerankCandidate[]): string {
  const candidateHash = candidates.map(c => `${c.id}:${c.title}`).join('|');
  return `rerank_${query.toLowerCase().trim()}_${candidateHash}`;
}

/**
 * Call OpenRouter API with proper error handling and retries
 */
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  config: SmallModelConfig = getDefaultSmallModelConfig()
): Promise<string> {
  if (!config.enabled || !config.apiKey) {
    throw new Error('Small model disabled or API key missing');
  }

  const requestBody = {
    model: config.model,
    messages,
    temperature: 0.1,
    max_tokens: 1000,
    top_p: 0.95
  };

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://canvas-mcp-server.local',
          'X-Title': 'Canvas MCP Server'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }

      return result.choices[0].message.content.trim();

    } catch (error) {
      logger.debug(`[Small Model] Attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
      
      if (attempt === config.maxRetries) {
        throw new Error(`OpenRouter API failed after ${config.maxRetries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Unexpected error in OpenRouter call');
}

/**
 * Classify user intent from search query
 */
export async function classifyIntent(
  query: string,
  courseId?: string,
  config: SmallModelConfig = getDefaultSmallModelConfig()
): Promise<IntentClassification> {
  const cacheKey = getIntentCacheKey(query, courseId);
  
  // Check cache first
  const cached = intentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < config.cacheTTL) {
    logger.debug(`[Small Model] Intent cache hit: ${cacheKey}`);
    return cached.result;
  }

  try {
    logger.debug(`[Small Model] Classifying intent for: "${query}"`);
    
    const prompt = `Analyze this Canvas LMS search query and determine what types of content the user is looking for.

Query: "${query}"

Respond with a JSON object indicating which content types are relevant (true/false) and your confidence:

{
  "files": boolean,          // Looking for documents, slides, PDFs, images, etc.
  "pages": boolean,          // Looking for course pages, reading materials, etc.
  "assignments": boolean,    // Looking for homework, projects, submissions, etc.
  "discussions": boolean,    // Looking for forum posts, Q&A, conversations, etc.
  "grades": boolean,         // Looking for scores, feedback, gradebook, etc.
  "calendar": boolean,       // Looking for due dates, schedule, events, etc.
  "confidence": number,      // 0.0-1.0 how confident you are
  "reasoning": string        // Brief explanation of your classification
}

Examples:
- "find homework 3 files" → files=true, assignments=true
- "what's due this week" → assignments=true, calendar=true  
- "lecture slides uncertainty" → files=true, pages=true
- "discussion about quantum" → discussions=true, pages=true
- "my grade on midterm" → grades=true, assignments=true

Respond only with valid JSON.`;

    const response = await callOpenRouter([
      { role: 'user', content: prompt }
    ], config);

    // Parse JSON response
    let intent: IntentClassification;
    try {
      intent = JSON.parse(response);
    } catch (parseError) {
      logger.warn(`[Small Model] Failed to parse intent JSON: ${response}`);
      // Fallback classification
      intent = {
        files: query.toLowerCase().includes('file') || query.toLowerCase().includes('slide') || query.toLowerCase().includes('pdf'),
        pages: query.toLowerCase().includes('page') || query.toLowerCase().includes('reading'),
        assignments: query.toLowerCase().includes('assignment') || query.toLowerCase().includes('homework') || query.toLowerCase().includes('due'),
        discussions: query.toLowerCase().includes('discussion') || query.toLowerCase().includes('forum'),
        grades: query.toLowerCase().includes('grade') || query.toLowerCase().includes('score'),
        calendar: query.toLowerCase().includes('due') || query.toLowerCase().includes('schedule'),
        confidence: 0.5,
        reasoning: 'Fallback keyword-based classification'
      };
    }

    // Cache the result
    intentCache.set(cacheKey, { result: intent, timestamp: Date.now() });
    
    logger.info(`[Small Model] Intent classified: ${Object.entries(intent).filter(([k, v]) => k !== 'confidence' && k !== 'reasoning' && v).map(([k]) => k).join(', ')} (confidence: ${intent.confidence})`);
    
    return intent;

  } catch (error) {
    logger.warn(`[Small Model] Intent classification failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Fallback to keyword-based classification
    const fallbackIntent: IntentClassification = {
      files: true, // Default to including files
      pages: true, // Default to including pages
      assignments: query.toLowerCase().includes('assignment') || query.toLowerCase().includes('homework') || query.toLowerCase().includes('due'),
      discussions: query.toLowerCase().includes('discussion') || query.toLowerCase().includes('forum'),
      grades: query.toLowerCase().includes('grade') || query.toLowerCase().includes('score'),
      calendar: query.toLowerCase().includes('due') || query.toLowerCase().includes('schedule'),
      confidence: 0.3,
      reasoning: 'Fallback due to API error'
    };
    
    return fallbackIntent;
  }
}

/**
 * Rerank candidates by relevance to query
 */
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  topK: number = 5,
  config: SmallModelConfig = getDefaultSmallModelConfig()
): Promise<RerankResult[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= topK) {
    // If we have few candidates, return all with default scores
    return candidates.map((c, i) => ({
      id: c.id,
      score: 1.0 - (i * 0.1),
      reasoning: 'All candidates returned due to low count'
    }));
  }

  const cacheKey = getRerankCacheKey(query, candidates);
  
  // Check cache first
  const cached = rerankCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < config.cacheTTL) {
    logger.debug(`[Small Model] Rerank cache hit: ${cacheKey.substring(0, 50)}...`);
    return cached.result.slice(0, topK);
  }

  try {
    logger.debug(`[Small Model] Reranking ${candidates.length} candidates for: "${query}"`);
    
    const candidatesText = candidates.map((c, i) => 
      `${i + 1}. ID: ${c.id}
   Type: ${c.type}
   Title: ${c.title}
   Source: ${c.source}
   ${c.snippet ? `Snippet: ${c.snippet.substring(0, 200)}` : ''}`
    ).join('\n\n');

    const prompt = `Rank these Canvas LMS search results by relevance to the user's query. Return the top ${topK} most relevant items.

Query: "${query}"

Candidates:
${candidatesText}

Analyze each candidate and respond with a JSON array of the top ${topK} most relevant results:

[
  {
    "id": "candidate_id",
    "score": number,     // 0.0-1.0 relevance score
    "reasoning": string  // Brief explanation why this is relevant
  }
]

Consider:
- Direct keyword matches in title/content
- Semantic similarity to query intent
- Source relevance (e.g., lecture slides for "lecture" queries)
- Content type appropriateness

Respond only with valid JSON array.`;

    const response = await callOpenRouter([
      { role: 'user', content: prompt }
    ], config);

    // Parse JSON response
    let results: RerankResult[];
    try {
      results = JSON.parse(response);
      if (!Array.isArray(results)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      logger.warn(`[Small Model] Failed to parse rerank JSON: ${response}`);
      // Fallback to original order with decreasing scores
      results = candidates.slice(0, topK).map((c, i) => ({
        id: c.id,
        score: 1.0 - (i * 0.1),
        reasoning: 'Fallback ranking due to parse error'
      }));
    }

    // Ensure we only return valid candidates and limit to topK
    const validResults = results
      .filter(r => candidates.some(c => c.id === r.id))
      .slice(0, topK);

    // Cache the result
    rerankCache.set(cacheKey, { result: validResults, timestamp: Date.now() });
    
    logger.info(`[Small Model] Reranked to top ${validResults.length} candidates (avg score: ${(validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length).toFixed(2)})`);
    
    return validResults;

  } catch (error) {
    logger.warn(`[Small Model] Reranking failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Fallback to original order
    return candidates.slice(0, topK).map((c, i) => ({
      id: c.id,
      score: 1.0 - (i * 0.1),
      reasoning: 'Fallback ranking due to API error'
    }));
  }
}

/**
 * Clear caches
 */
export function clearSmallModelCache(): { intentCleared: number; rerankCleared: number } {
  const intentCleared = intentCache.size;
  const rerankCleared = rerankCache.size;
  
  intentCache.clear();
  rerankCache.clear();
  
  logger.info(`[Small Model] Cleared caches: ${intentCleared} intent + ${rerankCleared} rerank entries`);
  
  return { intentCleared, rerankCleared };
}

/**
 * Get cache statistics
 */
export function getSmallModelStats(): {
  intentCacheSize: number;
  rerankCacheSize: number;
  config: SmallModelConfig;
} {
  return {
    intentCacheSize: intentCache.size,
    rerankCacheSize: rerankCache.size,
    config: DEFAULT_SMALL_MODEL_CONFIG
  };
} 