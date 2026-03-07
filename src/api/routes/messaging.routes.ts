import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { messagingService } from '../../services/sender.service.js';

export const messagingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	fastify.post('/sessions/:id/send', async (request, reply) => {
		const { id } = request.params as any;
		const { to, text, image, metadata } = request.body as any;

		if (!to) {
			return reply.status(400).send({ error: 'Missing "to" (recipient phone number)' });
		}

		try {
			return await messagingService.sendMessage({ sessionId: id, to, text, image, metadata });
		} catch (err: any) {
			return reply.status(err.message === 'Session not found' ? 404 : 500).send({
				error: err.message || 'Failed to send message',
			});
		}
	});

	fastify.get('/auth/qr', async (request, reply) => {
		const { getLatestQr } = await import('../../core/baileys.js');
		const qr = getLatestQr();
		if (qr) {
			return { qr };
		}
		return { message: 'No active QR. Node may be connected.' };
	});
};
