// This file manages the SQLite database connection and schema.

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger.js';

let db: Database;

export async function getDb() {
  if (db) return db;

  const dataDir = path.resolve('./data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'canvas_cache.db');
  logger.info(`Connecting to database at ${dbPath}...`);

  try {
    const newDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    logger.info('Database connection established.');
    db = newDb;
    return db;
  } catch (error) {
    logger.error('Failed to connect to the database:', error);
    throw error;
  }
}

export async function initDatabase() {
  const db = await getDb();
  logger.info('Initializing database schema...');

  // Original Canvas cache tables
  const cacheSchemaQueries = [
    `CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT,
      course_code TEXT,
      data TEXT, -- Store the full CourseInfo object as JSON
      last_indexed DATETIME
    );`,
    `CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      name TEXT,
      data TEXT, -- Store the full AssignmentInfo object as JSON
      last_indexed DATETIME,
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      name TEXT,
      updated_at TEXT,
      data TEXT, -- Store the full FileInfo object as JSON
      content TEXT, -- Store the full file content
      last_indexed DATETIME,
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS syllabus (
      course_id TEXT PRIMARY KEY,
      body TEXT,
      url TEXT,
      content_hash TEXT,
      last_indexed DATETIME,
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT,
      source_id TEXT, -- e.g., file_id, assignment_id
      source_type TEXT, -- 'file', 'assignment', or 'syllabus'
      chunk_text TEXT,
      embedding TEXT, -- Stored as a JSON array of numbers
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    // Additional Canvas data tables needed for progress tracking
    `CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_name TEXT,
      enrollment_state TEXT,
      workflow_state TEXT,
      created_at DATETIME,
      updated_at DATETIME,
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      submitted_at DATETIME,
      score REAL,
      grade TEXT,
      workflow_state TEXT,
      submission_type TEXT,
      data TEXT, -- Store full submission data as JSON
      FOREIGN KEY(assignment_id) REFERENCES assignments(id)
    );`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT,
      quiz_type TEXT,
      points_possible REAL,
      due_at DATETIME,
      data TEXT, -- Store full quiz data as JSON
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS quiz_submissions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      attempt INTEGER,
      started_at DATETIME,
      finished_at DATETIME,
      score REAL,
      workflow_state TEXT,
      data TEXT, -- Store full submission data as JSON
      FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
    );`,
    `CREATE TABLE IF NOT EXISTS discussion_topics (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT,
      message TEXT,
      posted_at DATETIME,
      discussion_type TEXT,
      data TEXT, -- Store full topic data as JSON
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );`,
    `CREATE TABLE IF NOT EXISTS discussion_entries (
      id TEXT PRIMARY KEY,
      discussion_topic_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message TEXT,
      posted_at DATETIME,
      created_at DATETIME,
      data TEXT, -- Store full entry data as JSON
      FOREIGN KEY(discussion_topic_id) REFERENCES discussion_topics(id)
    );`
  ];

  // New Persona System tables
  const personaSchemaQueries = [
    // Student Persona Profile Table
    `CREATE TABLE IF NOT EXISTS student_personas (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- Writing Style Analysis
      avg_message_length INTEGER DEFAULT 0,
      avg_discussion_length INTEGER DEFAULT 0,
      formality_level TEXT DEFAULT 'medium', -- 'casual', 'medium', 'formal'
      vocabulary_complexity TEXT DEFAULT 'medium', -- 'simple', 'medium', 'complex'
      emoji_usage_frequency REAL DEFAULT 0.0,
      punctuation_style TEXT, -- JSON: {"exclamation": 0.1, "question": 0.05}
      
      -- Communication Patterns
      response_time_pattern TEXT, -- 'immediate', 'quick', 'thoughtful', 'delayed'
      preferred_interaction_time TEXT, -- 'morning', 'afternoon', 'evening', 'late'
      communication_frequency TEXT, -- 'high', 'medium', 'low'
      
      -- Academic Behavior
      engagement_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
      participation_style TEXT, -- 'proactive', 'responsive', 'observer'
      collaboration_preference TEXT, -- 'group_oriented', 'independent', 'mixed'
      
      -- Preferences
      topics_of_interest TEXT, -- JSON array of topics they engage with most
      learning_style_indicators TEXT, -- JSON: {"visual": 0.6, "auditory": 0.3, "kinesthetic": 0.1}
      
      -- Analysis Metadata
      total_interactions_analyzed INTEGER DEFAULT 0,
      confidence_score REAL DEFAULT 0.0,
      last_analysis_date DATETIME
    );`,

    // Interaction History Table
    `CREATE TABLE IF NOT EXISTS interaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      interaction_type TEXT NOT NULL, -- 'discussion_post', 'discussion_reply', 'message_sent', 'message_received'
      
      -- Content Analysis
      content TEXT NOT NULL,
      content_length INTEGER,
      word_count INTEGER,
      sentiment_score REAL, -- -1.0 to 1.0
      formality_score REAL, -- 0.0 to 1.0
      complexity_score REAL, -- 0.0 to 1.0
      
      -- Context Information
      course_id TEXT,
      course_name TEXT,
      recipient_ids TEXT, -- JSON array for messages
      discussion_topic_id TEXT,
      assignment_context TEXT,
      
      -- Temporal Data
      created_at DATETIME NOT NULL,
      day_of_week INTEGER, -- 0-6
      hour_of_day INTEGER, -- 0-23
      
      -- Relationships
      interaction_with_peers BOOLEAN DEFAULT FALSE,
      interaction_with_instructors BOOLEAN DEFAULT FALSE,
      is_group_work BOOLEAN DEFAULT FALSE,
      
      -- Analysis Metadata
      analyzed_at DATETIME,
      analysis_version TEXT DEFAULT '1.0',
      
      FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
    );`,

    // Student Relationships Table
    `CREATE TABLE IF NOT EXISTS student_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id TEXT NOT NULL,
      contact_user_id TEXT NOT NULL,
      contact_name TEXT,
      contact_type TEXT, -- 'peer', 'instructor', 'ta', 'advisor'
      
      -- Relationship Analysis
      interaction_frequency INTEGER DEFAULT 0,
      communication_style_with_contact TEXT, -- 'formal', 'friendly', 'professional', 'casual'
      typical_topics TEXT, -- JSON array
      relationship_strength REAL DEFAULT 0.0, -- 0.0 to 1.0
      
      -- Context
      shared_courses TEXT, -- JSON array of course IDs
      collaboration_history TEXT, -- JSON array of project/assignment contexts
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE(student_user_id, contact_user_id),
      FOREIGN KEY (student_user_id) REFERENCES student_personas(user_id)
    );`,

    // Academic Context Table
    `CREATE TABLE IF NOT EXISTS academic_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      
      -- Current Academic State
      current_courses TEXT, -- JSON array of course objects
      upcoming_deadlines TEXT, -- JSON array of deadline objects
      recent_submissions TEXT, -- JSON array of recent work
      current_workload_level TEXT, -- 'light', 'moderate', 'heavy', 'overwhelming'
      
      -- Performance Context
      grade_trends TEXT, -- JSON with performance patterns
      strength_areas TEXT, -- JSON array of strong subjects/skills
      challenge_areas TEXT, -- JSON array of areas needing support
      
      -- Temporal Context
      semester_progress REAL, -- 0.0 to 1.0
      time_until_major_deadlines INTEGER, -- days
      current_stress_indicators TEXT, -- JSON with stress signals
      
      -- Learning Context
      recently_studied_topics TEXT, -- JSON array
      active_discussion_topics TEXT, -- JSON array
      collaboration_opportunities TEXT, -- JSON array
      
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
    );`,

    // Persona Analysis Cache Table (for performance)
    `CREATE TABLE IF NOT EXISTS persona_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      analysis_type TEXT NOT NULL, -- 'writing_style', 'communication_pattern', 'relationship_analysis'
      analysis_data TEXT NOT NULL, -- JSON of analysis results
      cache_key TEXT NOT NULL, -- Hash of input parameters
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      
      FOREIGN KEY (user_id) REFERENCES student_personas(user_id),
      UNIQUE(user_id, analysis_type, cache_key)
    );`
  ];

  // Create indexes for performance
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_interaction_history_user_type ON interaction_history(user_id, interaction_type);`,
    `CREATE INDEX IF NOT EXISTS idx_interaction_history_created_at ON interaction_history(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_student_relationships_student ON student_relationships(student_user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_academic_context_user ON academic_context(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_persona_cache_user_type ON persona_analysis_cache(user_id, analysis_type);`,
    `CREATE INDEX IF NOT EXISTS idx_persona_cache_expires ON persona_analysis_cache(expires_at);`
  ];

  try {
    // Execute original cache schema
    await Promise.all(cacheSchemaQueries.map(query => db.exec(query)));
    logger.info('Original canvas cache schema verified.');

    // Execute new persona schema
    await Promise.all(personaSchemaQueries.map(query => db.exec(query)));
    logger.info('Persona system tables created successfully.');

    // Create indexes for performance
    await Promise.all(indexQueries.map(query => db.exec(query)));
    logger.info('Database indexes created successfully.');

    logger.info('Database schema initialization completed successfully.');
  } catch (error) {
    logger.error('Failed to initialize database schema:', error);
    throw error;
  }
}

// Persona System Database Operations
export class PersonaDB {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  static async create(): Promise<PersonaDB> {
    const db = await getDb();
    return new PersonaDB(db);
  }

  // Student Persona Operations
  async createOrUpdatePersona(userId: string, personaData: Partial<StudentPersona>): Promise<void> {
    const {
      display_name, avg_message_length, avg_discussion_length, formality_level,
      vocabulary_complexity, emoji_usage_frequency, punctuation_style,
      response_time_pattern, preferred_interaction_time, communication_frequency,
      engagement_level, participation_style, collaboration_preference,
      topics_of_interest, learning_style_indicators, total_interactions_analyzed,
      confidence_score
    } = personaData;

    const currentTimestamp = new Date().toISOString();

    await this.db.run(`
      INSERT OR REPLACE INTO student_personas (
        user_id, display_name, avg_message_length, avg_discussion_length,
        formality_level, vocabulary_complexity, emoji_usage_frequency, punctuation_style,
        response_time_pattern, preferred_interaction_time, communication_frequency,
        engagement_level, participation_style, collaboration_preference,
        topics_of_interest, learning_style_indicators, total_interactions_analyzed,
        confidence_score, updated_at, last_analysis_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, display_name, avg_message_length, avg_discussion_length,
      formality_level, vocabulary_complexity, emoji_usage_frequency,
      JSON.stringify(punctuation_style), response_time_pattern,
      preferred_interaction_time, communication_frequency, engagement_level,
      participation_style, collaboration_preference,
      JSON.stringify(topics_of_interest), JSON.stringify(learning_style_indicators),
      total_interactions_analyzed, confidence_score, currentTimestamp, currentTimestamp
    ]);
  }

  async getPersona(userId: string): Promise<StudentPersona | null> {
    const row = await this.db.get('SELECT * FROM student_personas WHERE user_id = ?', [userId]);
    if (!row) return null;

    return {
      ...row,
      punctuation_style: row.punctuation_style ? JSON.parse(row.punctuation_style) : null,
      topics_of_interest: row.topics_of_interest ? JSON.parse(row.topics_of_interest) : [],
      learning_style_indicators: row.learning_style_indicators ? JSON.parse(row.learning_style_indicators) : {}
    };
  }

  // Interaction History Operations
  async addInteraction(interactionData: InteractionHistoryEntry): Promise<number> {
    const currentTimestamp = new Date().toISOString();
    
    const result = await this.db.run(`
      INSERT INTO interaction_history (
        user_id, interaction_type, content, content_length, word_count,
        sentiment_score, formality_score, complexity_score, course_id, course_name,
        recipient_ids, discussion_topic_id, assignment_context, created_at,
        day_of_week, hour_of_day, interaction_with_peers, interaction_with_instructors,
        is_group_work, analyzed_at, analysis_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      interactionData.user_id, interactionData.interaction_type, interactionData.content,
      interactionData.content_length, interactionData.word_count, interactionData.sentiment_score,
      interactionData.formality_score, interactionData.complexity_score, interactionData.course_id,
      interactionData.course_name, JSON.stringify(interactionData.recipient_ids),
      interactionData.discussion_topic_id, interactionData.assignment_context,
      interactionData.created_at, interactionData.day_of_week, interactionData.hour_of_day,
      interactionData.interaction_with_peers, interactionData.interaction_with_instructors,
      interactionData.is_group_work, currentTimestamp, '1.0'
    ]);
    return result.lastID!;
  }

  async getRecentInteractions(userId: string, limit: number = 50): Promise<InteractionHistoryEntry[]> {
    const rows = await this.db.all(`
      SELECT * FROM interaction_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);

    return rows.map(row => ({
      ...row,
      recipient_ids: row.recipient_ids ? JSON.parse(row.recipient_ids) : []
    }));
  }

  // Relationship Operations
  async updateRelationship(relationshipData: StudentRelationship): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO student_relationships (
        student_user_id, contact_user_id, contact_name, contact_type,
        interaction_frequency, communication_style_with_contact, typical_topics,
        relationship_strength, shared_courses, collaboration_history, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      relationshipData.student_user_id, relationshipData.contact_user_id,
      relationshipData.contact_name, relationshipData.contact_type,
      relationshipData.interaction_frequency, relationshipData.communication_style_with_contact,
      JSON.stringify(relationshipData.typical_topics), relationshipData.relationship_strength,
      JSON.stringify(relationshipData.shared_courses), JSON.stringify(relationshipData.collaboration_history)
    ]);
  }

  async getRelationships(userId: string): Promise<StudentRelationship[]> {
    const rows = await this.db.all(`
      SELECT * FROM student_relationships 
      WHERE student_user_id = ?
      ORDER BY relationship_strength DESC
    `, [userId]);

    return rows.map(row => ({
      ...row,
      typical_topics: row.typical_topics ? JSON.parse(row.typical_topics) : [],
      shared_courses: row.shared_courses ? JSON.parse(row.shared_courses) : [],
      collaboration_history: row.collaboration_history ? JSON.parse(row.collaboration_history) : []
    }));
  }

  // Academic Context Operations
  async updateAcademicContext(userId: string, contextData: AcademicContextData): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO academic_context (
        user_id, current_courses, upcoming_deadlines, recent_submissions,
        current_workload_level, grade_trends, strength_areas, challenge_areas,
        semester_progress, time_until_major_deadlines, current_stress_indicators,
        recently_studied_topics, active_discussion_topics, collaboration_opportunities,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      userId, JSON.stringify(contextData.current_courses), JSON.stringify(contextData.upcoming_deadlines),
      JSON.stringify(contextData.recent_submissions), contextData.current_workload_level,
      JSON.stringify(contextData.grade_trends), JSON.stringify(contextData.strength_areas),
      JSON.stringify(contextData.challenge_areas), contextData.semester_progress,
      contextData.time_until_major_deadlines, JSON.stringify(contextData.current_stress_indicators),
      JSON.stringify(contextData.recently_studied_topics), JSON.stringify(contextData.active_discussion_topics),
      JSON.stringify(contextData.collaboration_opportunities)
    ]);
  }

  async getAcademicContext(userId: string): Promise<AcademicContextData | null> {
    const row = await this.db.get('SELECT * FROM academic_context WHERE user_id = ?', [userId]);
    if (!row) return null;

    return {
      ...row,
      current_courses: row.current_courses ? JSON.parse(row.current_courses) : [],
      upcoming_deadlines: row.upcoming_deadlines ? JSON.parse(row.upcoming_deadlines) : [],
      recent_submissions: row.recent_submissions ? JSON.parse(row.recent_submissions) : [],
      grade_trends: row.grade_trends ? JSON.parse(row.grade_trends) : {},
      strength_areas: row.strength_areas ? JSON.parse(row.strength_areas) : [],
      challenge_areas: row.challenge_areas ? JSON.parse(row.challenge_areas) : [],
      current_stress_indicators: row.current_stress_indicators ? JSON.parse(row.current_stress_indicators) : {},
      recently_studied_topics: row.recently_studied_topics ? JSON.parse(row.recently_studied_topics) : [],
      active_discussion_topics: row.active_discussion_topics ? JSON.parse(row.active_discussion_topics) : [],
      collaboration_opportunities: row.collaboration_opportunities ? JSON.parse(row.collaboration_opportunities) : []
    };
  }

  // Analysis Cache Operations
  async cacheAnalysis(userId: string, analysisType: string, cacheKey: string, analysisData: any, expiresInHours: number = 24): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    await this.db.run(`
      INSERT OR REPLACE INTO persona_analysis_cache (
        user_id, analysis_type, analysis_data, cache_key, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `, [userId, analysisType, JSON.stringify(analysisData), cacheKey, expiresAt.toISOString()]);
  }

  async getCachedAnalysis(userId: string, analysisType: string, cacheKey: string): Promise<any | null> {
    const row = await this.db.get(`
      SELECT analysis_data FROM persona_analysis_cache 
      WHERE user_id = ? AND analysis_type = ? AND cache_key = ? AND expires_at > CURRENT_TIMESTAMP
    `, [userId, analysisType, cacheKey]);

    return row ? JSON.parse(row.analysis_data) : null;
  }

  // Cleanup expired cache entries
  async cleanupExpiredCache(): Promise<void> {
    await this.db.run('DELETE FROM persona_analysis_cache WHERE expires_at <= CURRENT_TIMESTAMP');
  }
}

// Type definitions for the persona system
export interface StudentPersona {
  user_id: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
  avg_message_length: number;
  avg_discussion_length: number;
  formality_level: 'casual' | 'medium' | 'formal';
  vocabulary_complexity: 'simple' | 'medium' | 'complex';
  emoji_usage_frequency: number;
  punctuation_style?: { [key: string]: number };
  response_time_pattern?: 'immediate' | 'quick' | 'thoughtful' | 'delayed';
  preferred_interaction_time?: 'morning' | 'afternoon' | 'evening' | 'late';
  communication_frequency?: 'high' | 'medium' | 'low';
  engagement_level: 'low' | 'medium' | 'high';
  participation_style?: 'proactive' | 'responsive' | 'observer';
  collaboration_preference?: 'group_oriented' | 'independent' | 'mixed';
  topics_of_interest: string[];
  learning_style_indicators: { [key: string]: number };
  total_interactions_analyzed: number;
  confidence_score: number;
  last_analysis_date?: string;
}

export interface InteractionHistoryEntry {
  id?: number;
  user_id: string;
  interaction_type: 'discussion_post' | 'discussion_reply' | 'message_sent' | 'message_received';
  content: string;
  content_length: number;
  word_count: number;
  sentiment_score?: number;
  formality_score?: number;
  complexity_score?: number;
  course_id?: string;
  course_name?: string;
  recipient_ids?: string[];
  discussion_topic_id?: string;
  assignment_context?: string;
  created_at: string;
  day_of_week: number;
  hour_of_day: number;
  interaction_with_peers: boolean;
  interaction_with_instructors: boolean;
  is_group_work: boolean;
  analyzed_at?: string;
  analysis_version: string;
}

export interface StudentRelationship {
  id?: number;
  student_user_id: string;
  contact_user_id: string;
  contact_name?: string;
  contact_type: 'peer' | 'instructor' | 'ta' | 'advisor';
  interaction_frequency: number;
  communication_style_with_contact?: 'formal' | 'friendly' | 'professional' | 'casual';
  typical_topics: string[];
  relationship_strength: number;
  shared_courses: string[];
  collaboration_history: any[];
  created_at?: string;
  updated_at?: string;
}

export interface AcademicContextData {
  user_id: string;
  current_courses: any[];
  upcoming_deadlines: any[];
  recent_submissions: any[];
  current_workload_level: 'light' | 'moderate' | 'heavy' | 'overwhelming';
  grade_trends: { [key: string]: any };
  strength_areas: string[];
  challenge_areas: string[];
  semester_progress: number;
  time_until_major_deadlines: number;
  current_stress_indicators: { [key: string]: any };
  recently_studied_topics: string[];
  active_discussion_topics: string[];
  collaboration_opportunities: string[];
  updated_at?: string;
} 