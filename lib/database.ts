// This file manages the SQLite database connection and schema.

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { logger } from './logger.js';

let db: Database;

export async function getDb() {
  if (db) return db;

  const dbPath = './canvas_cache.db';
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

  // Use TEXT for JSON data and DATETIME for timestamps
  const schemaQueries = [
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
    );`
  ];

  try {
    await Promise.all(schemaQueries.map(query => db.exec(query)));
    logger.info('Database schema initialized successfully.');
  } catch (error) {
    logger.error('Failed to initialize database schema:', error);
    throw error;
  }
} 