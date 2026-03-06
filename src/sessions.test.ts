import fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessionsRoutes } from './sessions.js';
import { db } from './store.js';

describe('WA Sessions CRUD', () => {
	const app = fastify();

	beforeAll(async () => {
		// Register routes
		app.register(sessionsRoutes);
		await app.ready();
	});

	afterAll(async () => {
		// Clean up test data
		db.prepare(`DELETE FROM wa_sessions WHERE id = ?`).run('test-session');
		await app.close();
		db.close();
	});

	it('should create a new session', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/sessions',
			payload: {
				id: 'test-session',
				project_name: 'Test Project',
				allowed_numbers: ['+1234567890'],
				webhook_url: 'http://localhost:9999/webhook',
			},
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.success).toBe(true);
		expect(body.id).toBe('test-session');
	});

	it('should list sessions', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/sessions',
		});

		expect(response.statusCode).toBe(200);
		const sessions = JSON.parse(response.body);
		const found = sessions.find((s: any) => s.id === 'test-session');
		expect(found).toBeDefined();
		expect(found.project_name).toBe('Test Project');
		expect(found.allowed_numbers).toContain('+1234567890');
	});

	it('should delete a session', async () => {
		const response = await app.inject({
			method: 'DELETE',
			url: '/sessions/test-session',
		});

		expect(response.statusCode).toBe(200);

		// Verify deletion
		const listResponse = await app.inject({
			method: 'GET',
			url: '/sessions',
		});

		const sessions = JSON.parse(listResponse.body);
		const found = sessions.find((s: any) => s.id === 'test-session');
		expect(found).toBeUndefined();
	});
});
