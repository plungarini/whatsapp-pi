import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sessionsService } from '../../services/sessions.service.js';

export const sessionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	fastify.post('/sessions', async (request, reply) => {
		const { id, project_name, allowed_numbers, webhook_url } = request.body as any;
		if (!id || !project_name || !allowed_numbers) {
			return reply.status(400).send({ error: 'Missing required fields' });
		}
		return sessionsService.createSession({ id, project_name, allowed_numbers, webhook_url });
	});

	fastify.get('/sessions', async (request, reply) => {
		return sessionsService.listSessions();
	});

	fastify.delete('/sessions/:id', async (request, reply) => {
		const { id } = request.params as any;
		return sessionsService.deleteSession(id);
	});

	fastify.get('/sessions/:id/messages', async (request, reply) => {
		const { id } = request.params as any;
		const { limit = 50, offset = 0 } = request.query as any;
		return sessionsService.getSessionMessages(id, Number(limit), Number(offset));
	});

	fastify.get('/sessions/:id/messages/search', async (request, reply) => {
		return { success: false, message: 'Not implemented yet' };
	});
};
