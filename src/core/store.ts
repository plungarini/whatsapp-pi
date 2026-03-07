import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = process.env.DB_PATH || './data/whatsapp-pi.db';
export const db: Database.Database = new Database(path.resolve(process.cwd(), dbPath));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS wa_sessions (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        allowed_numbers TEXT NOT NULL, -- JSON array of phone numbers
        webhook_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wa_messages (
        session_id TEXT NOT NULL,
        message_id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        direction TEXT CHECK(direction IN ('incoming', 'outgoing')) NOT NULL,
        content_type TEXT NOT NULL,
        body TEXT,
        media_url TEXT,
        timestamp DATETIME NOT NULL,
        is_read INTEGER DEFAULT 0,
        metadata TEXT, -- JSON blob for extra baileys data
        FOREIGN KEY(session_id) REFERENCES wa_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS wa_compaction_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        original_count INTEGER NOT NULL,
        summary TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES wa_sessions(id)
    );
`);

// Vector table for semantic search (using sqlite-vec if available)
try {
	// Attempting to load vector extension dynamically if installed
	const sqliteVec = require('sqlite-vec');
	sqliteVec.load(db);

	db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS wa_messages_vec USING vec0(
            message_id TEXT PRIMARY KEY,
            embedding FLOAT[384]
        );
    `);
} catch (e: any) {
	console.warn(`Vector extension (sqlite-vec) not loaded. Semantic search will be unavailable. (${e.message})`);
}
