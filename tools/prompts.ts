// This tool generates context-rich prompts for an LLM to answer user questions.

import { buildCourseKnowledgeGraph } from '../lib/knowledge.js';
import { logger } from '../lib/logger.js';
import { generateEmbedding, cosineSimilarity } from '../lib/vectorize.js';
import { getDb } from '../lib/database.js';

export interface QAPromptParams {
  courseName: string;
  question: string;
}

interface EmbeddingRow {
    id: number;
    course_id: string;
    source_id: string;
    source_type: string;
    chunk_text: string;
    embedding: string;
}

function formatSemanticSearchResults(results: EmbeddingRow[]): string {
    if (results.length === 0) return "No relevant context found in course materials.\n";
    return "Most Relevant Context from Course Materials:\n" + results.map(r => `--- (Source: ${r.source_type} ${r.source_id})\n${r.chunk_text}\n\n`).join('');
}

export async function generateQAPrompt(params: QAPromptParams): Promise<string> {
  const { courseName, question } = params;

  logger.info(`Generating intelligent QA prompt for question "${question}" in course "${courseName}"`);

  try {
    // 1. Build the knowledge graph to get course ID and syllabus
    const graph = await buildCourseKnowledgeGraph({ courseName });

    // 2. Perform Semantic Search
    // Generate an embedding for the user's question
    const questionEmbedding = await generateEmbedding(question);

    // Fetch all embeddings for the course from the database
    const db = await getDb();
    const allEmbeddings: EmbeddingRow[] = await db.all('SELECT * FROM embeddings WHERE course_id = ?', graph.courseId);

    // Calculate similarity for each chunk
    const similarities = allEmbeddings.map(row => {
        const dbEmbedding = JSON.parse(row.embedding);
        return {
            ...row,
            similarity: cosineSimilarity(questionEmbedding, dbEmbedding),
        };
    });

    // Sort by similarity and take the top 5
    const topResults = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    
    // 3. Construct the smart context for the prompt
    const context = `
CONTEXT FOR COURSE: ${graph.courseName}
=====================================================

**COURSE SYLLABUS (excerpt):**
${graph.syllabus?.body?.substring(0, 2000) || "No syllabus body available."}
${(graph.syllabus?.body?.length || 0) > 2000 ? "\n... (syllabus truncated for brevity)" : ""}

---

**${formatSemanticSearchResults(topResults)}**

=====================================================
`;

    const prompt = `
You are an expert teaching assistant for the course "${graph.courseName}".
Based *only* on the context provided below, which includes the syllabus and the most semantically relevant excerpts from course materials, answer the user's question.
If the context does not contain the answer, state that you cannot answer the question with the information available.
Do not make up information. Be concise and directly answer the question.

${context}

**USER QUESTION:**
${question}

**YOUR ANSWER:**
`;

    return prompt;
  } catch (error) {
    logger.error(`Failed to generate QA prompt:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate QA prompt: ${error.message}`);
    } else {
      throw new Error('Failed to generate QA prompt: Unknown error');
    }
  }
} 