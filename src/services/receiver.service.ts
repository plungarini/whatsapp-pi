import { WASocket } from '@whiskeysockets/baileys';
import { globalLogger } from '../core/logger.js';
import { db } from '../core/store.js';

async function processMessage(msg: any) {
	if (!msg.message || msg.key.fromMe) return;

	const senderJid = msg.key.remoteJid;
	if (!senderJid) return;

	const senderNumber = senderJid.split('@')[0];
	const text = msg.message.conversation || msg.message.extendedTextMessage?.text || null;
	const hasMedia = !!msg.message.imageMessage || !!msg.message.videoMessage;

	const sessions = db.prepare(`SELECT * FROM wa_sessions`).all() as any[];

	let routed = false;
	for (const session of sessions) {
		const numbers = JSON.parse(session.allowed_numbers) as string[];
		const cleanN = (n: string) => n.replaceAll(/\D/g, '');
		const isAllowed = numbers.some((n) => senderNumber.includes(cleanN(n)) || cleanN(n).includes(senderNumber));

		if (isAllowed) {
			routed = true;
			await routeToSession(session, msg, senderJid, text, hasMedia);
		}
	}

	if (!routed && text) {
		globalLogger.debug(`Ignored unrouted incoming message from ${senderNumber}`);
	}
}

async function routeToSession(session: any, msg: any, senderJid: string, text: string | null, hasMedia: boolean) {
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

		globalLogger.info(`Routed message ${msg.key.id} to session ${session.id}`);

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
		globalLogger.warn(`Failed to insert incoming msg ${msg.key.id}: ${e}`);
	}
}

export function setupReceiver(socket: WASocket) {
	socket.ev.on('messages.upsert', async (m) => {
		if (m.type !== 'notify') return;
		for (const msg of m.messages) {
			await processMessage(msg);
		}
	});
}
