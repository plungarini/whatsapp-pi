import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getSocket } from './baileys.js';
import { globalLogger } from './logger.js';
import { db } from './store.js';

export const senderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	// Send standard message
	fastify.post('/sessions/:id/send', async (request, reply) => {
		const { id } = request.params as any;
		const { to, text, image, metadata } = request.body as any;

		if (!to) {
			return reply.status(400).send({ error: 'Missing "to" (recipient phone number)' });
		}

		// Ensure session exists
		const sessionStmt = db.prepare(`SELECT * FROM wa_sessions WHERE id = ?`);
		const session = sessionStmt.get(id);

		if (!session) {
			return reply.status(404).send({ error: 'Session not found' });
		}

		try {
			const sock = getSocket();

			// Format "to" id roughly (Assuming standard format: XXXXXXXXXX@s.whatsapp.net)
			// Some basic parsing could be added here
			const jid = to.includes('@s.whatsapp.net') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

			let msgPayload: any = {};
			if (image) {
				msgPayload = { image: { url: image }, caption: text };
			} else if (text) {
				msgPayload = { text };
			} else {
				return reply.status(400).send({ error: 'Missing "text" or "image"' });
			}

			const result = await sock.sendMessage(jid, msgPayload);

			// Persist the outgoing message
			if (result && result.key && result.key.id) {
				const insertStmt = db.prepare(`
                    INSERT INTO wa_messages (session_id, message_id, sender, recipient, direction, content_type, body, media_url, timestamp, is_read, metadata)
                    VALUES (@session_id, @message_id, @sender, @recipient, 'outgoing', @content_type, @body, @media_url, @timestamp, 1, @metadata)
                `);

				insertStmt.run({
					session_id: id,
					message_id: result.key.id,
					sender: 'self', // For outgoing we are 'self'
					recipient: jid,
					content_type: image ? 'image' : 'text',
					body: text || null,
					media_url: image || null,
					timestamp: new Date().toISOString(),
					metadata: metadata ? JSON.stringify(metadata) : null,
				});
			}

			return { success: true, messageId: result?.key?.id };
		} catch (err: any) {
			globalLogger.error(`Error sending message for session ${id}:`, err);
			return reply.status(500).send({ error: 'Failed to send message', details: err.message });
		}
	});

	// Check auth QR
	fastify.get('/auth/qr', async (request, reply) => {
		const { getLatestQr } = await import('./baileys.js');
		const root = getLatestQr();
		if (root) {
			return { qr: root };
		}
		return { message: 'No active QR. Node may be connected.' };
	});
};
