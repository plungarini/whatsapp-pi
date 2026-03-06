import { db } from '../core/store.js';

export const sessionsService = {
	createSession(data: { id: string; project_name: string; allowed_numbers: any; webhook_url?: string }) {
		const stmt = db.prepare(`
			INSERT OR REPLACE INTO wa_sessions (id, project_name, allowed_numbers, webhook_url)
			VALUES (@id, @project_name, @allowed_numbers, @webhook_url)
		`);

		stmt.run({
			...data,
			allowed_numbers: JSON.stringify(data.allowed_numbers),
			webhook_url: data.webhook_url || null,
		});

		return { success: true, id: data.id };
	},

	listSessions() {
		const stmt = db.prepare(`SELECT * FROM wa_sessions`);
		const rows = stmt.all();

		return (rows as any[]).map((row) => ({
			...row,
			allowed_numbers: JSON.parse(row.allowed_numbers),
		}));
	},

	deleteSession(id: string) {
		db.prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
		return { success: true };
	},

	getSessionMessages(id: string, limit: number = 50, offset: number = 0) {
		const stmt = db.prepare(`
			SELECT * FROM wa_messages 
			WHERE session_id = ? 
			ORDER BY timestamp DESC
			LIMIT ? OFFSET ?
		`);
		const rows = stmt.all(id, limit, offset);

		return (rows as any[]).map((row) => ({
			...row,
			is_read: Boolean(row.is_read),
			metadata: row.metadata ? JSON.parse(row.metadata) : null,
		}));
	},
};
