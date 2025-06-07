// MCP Tool: Build Course Knowledge Graph

import { buildCourseKnowledgeGraph, CourseKnowledgeGraph } from '../lib/knowledge.js';

export interface BuildKnowledgeGraphParams {
  courseName: string;
}

// This function primarily acts as a wrapper around the core logic in lib/knowledge.ts
export async function getKnowledgeGraph(params: BuildKnowledgeGraphParams): Promise<CourseKnowledgeGraph> {
  return buildCourseKnowledgeGraph(params);
} 