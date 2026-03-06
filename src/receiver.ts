import { WASocket } from '@whiskeysockets/baileys';
import { globalLogger } from './logger.js';
import { db } from './store.js';

export function setupReceiver(socket: WASocket) {
	socket.ev.on('messages.upsert', async (m) => {
		if (m.type !== 'notify') return;

		for (const msg of m.messages) {
			if (!msg.message || msg.key.fromMe) continue; // Ignore own messages

			const senderJid = msg.key.remoteJid;
			if (!senderJid) continue;

			// Extract pure number
			const senderNumber = senderJid.split('@')[0];

			let text = msg.message.conversation || msg.message.extendedTextMessage?.text || null;
			let hasMedia = !!msg.message.imageMessage || !!msg.message.videoMessage;

			// Find sessions this number is allowed in
			const stmt = db.prepare(`SELECT * FROM wa_sessions`);
			const sessions = stmt.all() as any[];

			let routed = false;
			for (const session of sessions) {
				const numbers = JSON.parse(session.allowed_numbers) as string[];

				// Broad match logic (e.g. +39123456 vs 39123456@s.whatsapp.net)
				const isAllowed = numbers.some(
					(n) => senderNumber.includes(n.replace(/[^0-9]/g, '')) || n.replace(/[^0-9]/g, '').includes(senderNumber),
				);

				if (isAllowed) {
					routed = true;
					// Insert into local DB
					const insertStmt = db.prepare(`
                        INSERT OR IGNORE INTO wa_messages 
                        (session_id, message_id, sender, recipient, direction, content_type, body, timestamp, is_read)
                        VALUES (@session_id, @message_id, @sender, @recipient, 'incoming', @content_type, @body, @timestamp, 0)
                    `);

					try {
						insertStmt.run({
							session_id: session.id,
							message_id: msg.key.id,
							sender: senderJid,
							recipient: 'self',
							content_type: hasMedia ? 'media' : 'text',
							body: text,
							timestamp: new Date().toISOString(),
						});

						globalLogger.info(`Routed message ${msg.key.id} from ${senderNumber} to session ${session.id}`);

						// Webhook push
						if (session.webhook_url) {
							fetch(session.webhook_url, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									sessionId: session.id,
									messageId: msg.key.id,
									sender: senderJid,
									text: text,
									hasMedia,
								}),
							}).catch((err) => {
								globalLogger.error(`Failed to push webhook to ${session.webhook_url}:`, err.message);
							});
						}
					} catch (e) {
						globalLogger.warn(`Failed to insert incoming msg ${msg.key.id}:`, e);
					}
				}
			}

			if (!routed && text) {
				globalLogger.debug(`Ignored unrouted incoming message from ${senderNumber}`);
			}
		}
	});
}
