// This file contains the logic for the Indexer Agent, which fetches data from
// the Canvas API and populates the local SQLite database.

import { getDb, initDatabase } from './database.js';
import { listCourses, getCourseSyllabus, CourseInfo } from '../tools/courses.js';
import { listAssignments, AssignmentInfo } from '../tools/assignments.js';
import { searchFiles, getFileContent, FileInfo } from '../tools/files.js';
import { logger } from './logger.js';
import { generateEmbedding, splitIntoChunks } from './vectorize.js';

export interface IndexerParams {
  canvasBaseUrl: string;
  accessToken: string;
  forceRefresh?: boolean; // Force refresh even if data is recent
  maxAgeHours?: number;   // How old data can be before refresh (default: 6 hours)
}

// Smart caching logic
async function isDataFresh(courseId: string, maxAgeHours: number = 6): Promise<boolean> {
  const db = await getDb();
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  
  // Check if we have recent data for this course
  const courseData = await db.get(
    'SELECT last_indexed FROM courses WHERE id = ? AND last_indexed > ?',
    courseId, cutoffTime
  );
  
  return !!courseData;
}

async function getDatabaseStats(): Promise<{ courses: number; assignments: number; files: number; syllabi: number; lastIndexed?: string }> {
  const db = await getDb();
  
  const [courses, assignments, files, syllabi, lastIndexed] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM courses'),
    db.get('SELECT COUNT(*) as count FROM assignments'),
    db.get('SELECT COUNT(*) as count FROM files'),
    db.get('SELECT COUNT(*) as count FROM syllabus'),
    db.get('SELECT MAX(last_indexed) as last_indexed FROM courses')
  ]);
  
  return {
    courses: courses?.count || 0,
    assignments: assignments?.count || 0,
    files: files?.count || 0,
    syllabi: syllabi?.count || 0,
    lastIndexed: lastIndexed?.last_indexed
  };
}

// Single progress tracker
interface ProgressTracker {
  current: number;
  total: number;
  currentTask: string;
}

function formatProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage}%`;
}

function logProgress(tracker: ProgressTracker) {
  const progressBar = formatProgressBar(tracker.current, tracker.total);
  
  // Truncate long task names to keep everything on one line
  const maxTaskLength = 50; // Adjust based on terminal width
  let taskText = tracker.currentTask;
  if (taskText.length > maxTaskLength) {
    taskText = taskText.substring(0, maxTaskLength - 3) + '...';
  }
  
  // Simple line clearing - just carriage return to overwrite
  process.stderr.write(`\r🔄 Indexing: ${progressBar} | ${taskText}`);
}

async function upsertCourse(course: CourseInfo) {
  const db = await getDb();
  await db.run(
    'INSERT INTO courses (id, name, course_code, data, last_indexed) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, course_code=excluded.course_code, data=excluded.data, last_indexed=excluded.last_indexed',
    course.id,
    course.name,
    course.courseCode,
    JSON.stringify(course),
    new Date().toISOString()
  );
}

async function generateAndStoreEmbeddings(
  course_id: string, 
  source_id: string, 
  source_type: 'syllabus' | 'assignment' | 'file', 
  text: string
) {
    if (!text) return;
    const db = await getDb();
    const chunks = splitIntoChunks(text, 512, 128);
    let chunkCount = 0;
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        await db.run(
            'INSERT INTO embeddings (course_id, source_id, source_type, chunk_text, embedding) VALUES (?, ?, ?, ?, ?)',
            course_id,
            source_id,
            source_type,
            chunk,
            JSON.stringify(embedding)
        );
        chunkCount++;
    }
    // Silently store embeddings without logging to keep progress bar clean
}

export async function runFullIndex(params: IndexerParams) {
  const { canvasBaseUrl, accessToken, forceRefresh = false, maxAgeHours = 6 } = params;
  
  // Ensure database is initialized
  await initDatabase();
  
  // Check existing data
  const stats = await getDatabaseStats();
  
  if (!forceRefresh && stats.courses > 0) {
    if (stats.lastIndexed) {
      const lastIndexedDate = new Date(stats.lastIndexed);
      const ageHours = (Date.now() - lastIndexedDate.getTime()) / (1000 * 60 * 60);
      
      if (ageHours < maxAgeHours) {
        logger.info(`📊 Database is fresh (last indexed ${ageHours.toFixed(1)} hours ago)`);
        logger.info(`📈 Current stats: ${stats.courses} courses, ${stats.assignments} assignments, ${stats.files} files, ${stats.syllabi} syllabi`);
        logger.info(`⏭️  Skipping indexing. Use forceRefresh=true to override.`);
        return;
      }
    }
  }
  
  logger.info('🚀 Starting smart index run...');
  
  if (forceRefresh) {
    logger.info('🔄 Force refresh mode - will update all content');
  } else {
    logger.info(`⏰ Updating content older than ${maxAgeHours} hours`);
  }

  // 1. Fetch all active courses
  const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'active' });
  logger.info(`📚 Found ${courses.length} active courses to process.`);

  // 2. Filter courses that need updating
  const coursesToUpdate: CourseInfo[] = [];
  
  if (forceRefresh) {
    coursesToUpdate.push(...courses);
  } else {
    for (const course of courses) {
      const isFresh = await isDataFresh(course.id, maxAgeHours);
      if (!isFresh) {
        coursesToUpdate.push(course);
      }
    }
  }
  
  if (coursesToUpdate.length === 0) {
    logger.info('✅ All course data is up to date. No indexing needed.');
    return;
  }
  
  logger.info(`🔄 Will update ${coursesToUpdate.length} out of ${courses.length} courses`);

  // Clear old embeddings for courses being updated
  if (coursesToUpdate.length > 0) {
    await (await getDb()).run(`DELETE FROM embeddings WHERE course_id IN (${coursesToUpdate.map(c => `'${c.id}'`).join(',')})`);
  }

  // 3. Count items to update for progress tracking
  let totalAssignments = 0;
  let totalFiles = 0;
  
  for (const course of coursesToUpdate) {
    try {
      const assignments = await listAssignments({ canvasBaseUrl, accessToken, courseId: course.id });
      totalAssignments += assignments.length;
    } catch (e) {
      // Continue counting
    }
    
    try {
      const files = await searchFiles({ canvasBaseUrl, accessToken, courseId: course.id });
      totalFiles += files.length;
    } catch (e) {
      // Continue counting
    }
  }

  // Total items = syllabi + assignments + files for courses being updated
  const totalItems = coursesToUpdate.length + totalAssignments + totalFiles;
  let currentItem = 0;

  const progress: ProgressTracker = {
    current: 0,
    total: totalItems,
    currentTask: 'Starting...'
  };

  // 4. Process only courses that need updating
  for (const course of coursesToUpdate) {
    await upsertCourse(course);

    // Process syllabus
    const shortCourseName = course.name.length > 20 ? course.name.substring(0, 20) + '...' : course.name;
    progress.currentTask = `Syllabus: ${shortCourseName}`;
    logProgress(progress);
    
    try {
        const syllabus = await getCourseSyllabus({ canvasBaseUrl, accessToken, courseId: course.id });
        const db = await getDb();
        await db.run(
            'INSERT INTO syllabus (course_id, body, url, last_indexed) VALUES (?, ?, ?, ?) ON CONFLICT(course_id) DO UPDATE SET body=excluded.body, url=excluded.url, last_indexed=excluded.last_indexed',
            course.id,
            syllabus.body,
            syllabus.url,
            new Date().toISOString()
        );
        
        if (syllabus.body) {
          await generateAndStoreEmbeddings(course.id, course.id, 'syllabus', syllabus.body);
        }
    } catch (e: any) {
        // Silently continue
    }
    
    progress.current = ++currentItem;
    logProgress(progress);

    // Process assignments
    try {
        const assignments = await listAssignments({ canvasBaseUrl, accessToken, courseId: course.id });
        const db = await getDb();
        
        for (const assignment of assignments) {
            const shortAssignmentName = assignment.name.length > 30 ? assignment.name.substring(0, 30) + '...' : assignment.name;
            progress.currentTask = `Assignment: ${shortAssignmentName}`;
            logProgress(progress);
            
            await db.run(
                'INSERT INTO assignments (id, course_id, name, data, last_indexed) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data, last_indexed=excluded.last_indexed',
                assignment.id,
                course.id,
                assignment.name,
                JSON.stringify(assignment),
                new Date().toISOString()
            );
            await generateAndStoreEmbeddings(course.id, assignment.id, 'assignment', assignment.description);
            
            progress.current = ++currentItem;
            logProgress(progress);
        }
    } catch (e: any) {
        // Silently continue
    }

    // Process files
    try {
        const files = await searchFiles({ canvasBaseUrl, accessToken, courseId: course.id });
        const db = await getDb();
        
        for (const file of files) {
            const shortFileName = file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name;
            progress.currentTask = `File: ${shortFileName}`;
            logProgress(progress);
            
            try {
                const fileWithContent = await getFileContent({ canvasBaseUrl, accessToken, courseId: course.id, fileId: file.id });
                await db.run(
                    'INSERT INTO files (id, course_id, name, data, content, last_indexed) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data, content=excluded.content, last_indexed=excluded.last_indexed',
                    file.id,
                    course.id,
                    file.name,
                    JSON.stringify(file),
                    fileWithContent.content,
                    new Date().toISOString()
                );
                await generateAndStoreEmbeddings(course.id, file.id, 'file', fileWithContent.content);
            } catch (e: any) {
                // Continue with next file
            }
            
            progress.current = ++currentItem;
            logProgress(progress);
        }
    } catch (e: any) {
        // Silently continue
    }
  }

  // Final completion
  progress.currentTask = 'Completed!';
  logProgress(progress);
  process.stderr.write('\n');
  
  const finalStats = await getDatabaseStats();
  logger.info(`✅ Smart index completed! Updated ${coursesToUpdate.length} courses.`);
  logger.info(`📈 Final stats: ${finalStats.courses} courses, ${finalStats.assignments} assignments, ${finalStats.files} files, ${finalStats.syllabi} syllabi`);
} 