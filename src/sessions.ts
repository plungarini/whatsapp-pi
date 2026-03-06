import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from './store.js';

export const sessionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	// Create Session
	fastify.post('/sessions', async (request, reply) => {
		const { id, project_name, allowed_numbers, webhook_url } = request.body as any;

		if (!id || !project_name || !allowed_numbers) {
			return reply.status(400).send({ error: 'Missing required fields' });
		}

		const stmt = db.prepare(`
			INSERT OR REPLACE INTO wa_sessions (id, project_name, allowed_numbers, webhook_url)
			VALUES (@id, @project_name, @allowed_numbers, @webhook_url)
		`);

		stmt.run({
			id,
			project_name,
			allowed_numbers: JSON.stringify(allowed_numbers),
			webhook_url: webhook_url || null,
		});

		return { success: true, id };
	});

	// List Sessions
	fastify.get('/sessions', async (request, reply) => {
		const stmt = db.prepare(`SELECT * FROM wa_sessions`);
		const rows = stmt.all();

		const sessions = (rows as any[]).map((row) => ({
			...row,
			allowed_numbers: JSON.parse(row.allowed_numbers),
		}));

		return sessions;
	});

	// Delete Session
	fastify.delete('/sessions/:id', async (request, reply) => {
		const { id } = request.params as any;
		db.prepare(`DELETE FROM wa_sessions WHERE id = ?`).run(id);
		return { success: true };
	});

	// Get Messages for Session
	fastify.get('/sessions/:id/messages', async (request, reply) => {
		const { id } = request.params as any;
		const { limit = 50, offset = 0 } = request.query as any;

		const stmt = db.prepare(`
			SELECT * FROM wa_messages 
			WHERE session_id = ? 
			ORDER BY timestamp DESC
			LIMIT ? OFFSET ?
		`);
		const rows = stmt.all(id, Number(limit), Number(offset));

		return (rows as any[]).map((row) => ({
			...row,
			is_read: Boolean(row.is_read),
			metadata: row.metadata ? JSON.parse(row.metadata) : null,
		}));
	});

	// Semantic Search wrapper placeholder (will be implemented in embeddings.ts)
	fastify.get('/sessions/:id/messages/search', async (request, reply) => {
		return { success: false, message: 'Not implemented yet' };
	});
};
