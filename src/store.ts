import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as sqliteVec from 'sqlite-vec';
import { globalLogger } from './logger.js';
dotenv.config();

const dbPath = process.env.DATABASE_URL || './data/whatsapp.db';

// Ensure data dir exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

export const db: Database.Database = new Database(dbPath);

// Load sqlite-vec extension
sqliteVec.load(db);

db.pragma('journal_mode = WAL');

export function initDb() {
	globalLogger.info('Initializing SQLite database schema...');

	// Create tables if they don't exist
	db.exec(`
		CREATE TABLE IF NOT EXISTS wa_sessions (
		  id TEXT PRIMARY KEY,
		  project_name TEXT NOT NULL,
		  allowed_numbers TEXT NOT NULL,
		  webhook_url TEXT,
		  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`);

	db.exec(`
		CREATE TABLE IF NOT EXISTS wa_messages (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  session_id TEXT NOT NULL REFERENCES wa_sessions(id),
		  message_id TEXT UNIQUE,
		  sender TEXT NOT NULL,
		  recipient TEXT NOT NULL,
		  direction TEXT CHECK(direction IN ('incoming', 'outgoing')),
		  content_type TEXT DEFAULT 'text',
		  body TEXT,
		  media_url TEXT,
		  timestamp DATETIME NOT NULL,
		  is_read BOOLEAN DEFAULT 0,
		  metadata TEXT,
		  FOREIGN KEY (session_id) REFERENCES wa_sessions(id)
		);
	`);

	// Virtual table for vector embeddings using sqlite-vec
	try {
		db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_messages USING vec0(
                message_id INTEGER PRIMARY KEY,
                embedding float[384]
            );
        `);
	} catch (e) {
		// If it already exists, sqlite-vec throws sometimes or vec module handles it
		globalLogger.warn('Virtual table vec_messages creation issue (might exist already):', e);
	}

	db.exec(`
		CREATE TABLE IF NOT EXISTS wa_compaction_logs (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  session_id TEXT NOT NULL,
		  messages_compacted INTEGER,
		  summary TEXT,
		  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`);

	db.exec(`CREATE INDEX IF NOT EXISTS idx_wa_messages_session ON wa_messages(session_id, timestamp);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_wa_messages_sender ON wa_messages(sender);`);

	globalLogger.info('Database initialized successfully.');
}

// Call init on load
initDb();

// Close db on exit gracefully
export function closeDb() {
	db.close();
}
