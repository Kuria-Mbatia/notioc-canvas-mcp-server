// This library is responsible for aggregating various pieces of course information
// into a single, comprehensive "knowledge graph" object.

import { findBestMatch } from './search.js';
import { logger } from './logger.js';
import { getDb } from './database.js';
import { CourseInfo, SyllabusInfo } from '../tools/courses.js';
import { AssignmentInfo } from '../tools/assignments.js';
import { FileInfo } from '../tools/files.js';

export interface KnowledgeGraphParams {
  courseName: string;
}

export interface CourseKnowledgeGraph {
  courseId: string;
  courseName: string;
  syllabus: SyllabusInfo | null;
  assignments: AssignmentInfo[];
  files: (FileInfo & { content?: string })[];
}

export async function buildCourseKnowledgeGraph(params: KnowledgeGraphParams): Promise<CourseKnowledgeGraph> {
  const { courseName } = params;
  const db = await getDb();

  logger.info(`Building knowledge graph for course "${courseName}" from local index...`);

  // 1. Find the course in the local DB
  const courses: CourseInfo[] = (await db.all('SELECT data FROM courses')).map(c => JSON.parse(c.data));
  const course = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
  if (!course) {
    throw new Error(`Could not find a course matching "${courseName}" in the local index. Please run the indexer first.`);
  }
  const courseId = course.id;

  // 2. Fetch all data from the local DB
  const syllabus = await db.get<SyllabusInfo>('SELECT body, url FROM syllabus WHERE course_id = ?', courseId);
  
  const assignmentsData = await db.all('SELECT data FROM assignments WHERE course_id = ?', courseId);
  const assignments: AssignmentInfo[] = assignmentsData.map(a => JSON.parse(a.data));

  const filesData = await db.all('SELECT data, content FROM files WHERE course_id = ?', courseId);
  const files: (FileInfo & { content?: string })[] = filesData.map(f => ({ ...JSON.parse(f.data), content: f.content }));
  
  const graph: CourseKnowledgeGraph = {
    courseId,
    courseName: course.name,
    syllabus: syllabus || null,
    assignments,
    files,
  };

  logger.info(`Successfully built knowledge graph for "${course.name}" from local index.`);
  return graph;
} 