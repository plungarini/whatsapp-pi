import { describe, expect, it } from 'vitest';
import { sessionsService } from '../services/sessions.service.js';

describe('WA Sessions CRUD', () => {
	const testId = 'test-session-' + Date.now();

	it('should create a new session', () => {
		const result = sessionsService.createSession({
			id: testId,
			project_name: 'Test Project',
			allowed_numbers: ['1234567890'],
			webhook_url: 'http://localhost:9999/webhook',
		});
		expect(result.success).toBe(true);
		expect(result.id).toBe(testId);
	});

	it('should list sessions', () => {
		const sessions = sessionsService.listSessions();
		expect(Array.isArray(sessions)).toBe(true);
		expect(sessions.some((s: any) => s.id === testId)).toBe(true);
	});

	it('should delete a session', () => {
		const result = sessionsService.deleteSession(testId);
		expect(result.success).toBe(true);
		const sessions = sessionsService.listSessions();
		expect(sessions.some((s: any) => s.id === testId)).toBe(false);
	});
});
