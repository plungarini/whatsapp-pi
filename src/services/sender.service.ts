import { getSocket } from '../core/baileys.js';
import { db } from '../core/store.js';

export const messagingService = {
	async sendMessage(params: { sessionId: string; to: string; text?: string; image?: string; metadata?: any }) {
		const { sessionId, to, text, image, metadata } = params;

		// Ensure session exists
		const sessionStmt = db.prepare(`SELECT * FROM wa_sessions WHERE id = ?`);
		const session = sessionStmt.get(sessionId);

		if (!session) {
			throw new Error('Session not found');
		}

		const sock = getSocket();
		const jid = to.includes('@s.whatsapp.net') ? to : `${to.replaceAll(/\D/g, '')}@s.whatsapp.net`;

		let msgPayload: any = {};
		if (image) {
			msgPayload = { image: { url: image }, caption: text };
		} else if (text) {
			msgPayload = { text };
		} else {
			throw new Error('Missing "text" or "image"');
		}

		const result = await sock.sendMessage(jid, msgPayload);

		if (result?.key?.id) {
			const insertStmt = db.prepare(`
				INSERT INTO wa_messages (session_id, message_id, sender, recipient, direction, content_type, body, media_url, timestamp, is_read, metadata)
				VALUES (@session_id, @message_id, @sender, @recipient, 'outgoing', @content_type, @body, @media_url, @timestamp, 1, @metadata)
			`);

			insertStmt.run({
				session_id: sessionId,
				message_id: result.key.id,
				sender: 'self',
				recipient: jid,
				content_type: image ? 'image' : 'text',
				body: text || null,
				media_url: image || null,
				timestamp: new Date().toISOString(),
				metadata: metadata ? JSON.stringify(metadata) : null,
			});
		}

		return { success: true, messageId: result?.key?.id };
	},
};
