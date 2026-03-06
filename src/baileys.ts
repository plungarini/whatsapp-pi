import { Boom } from '@hapi/boom';
import makeWASocket, {
	ConnectionState,
	DisconnectReason,
	useMultiFileAuthState,
	WASocket,
} from '@whiskeysockets/baileys';
import dotenv from 'dotenv';
import path from 'path';
import { globalLogger } from './logger.js';
import { setupReceiver } from './receiver.js';

dotenv.config();

const authDataDir = process.env.WA_AUTH_DATA_DIR || './data/wa-auth';

let socket: WASocket | null = null;
let latestQr: string | null = null;

// Reconnection logic
async function connectToWhatsApp() {
	const { state, saveCreds } = await useMultiFileAuthState(path.resolve(process.cwd(), authDataDir));

	// Import fetchLatestBaileysVersion dynamically since it's not exported at the top level in types by default, or just require it
	const { fetchLatestBaileysVersion, Browsers } = await import('@whiskeysockets/baileys');
	const { version } = await fetchLatestBaileysVersion();

	socket = makeWASocket({
		version,
		auth: state,
		printQRInTerminal: false, // We will serve the QR via HTTP
		logger: globalLogger as any, // Best effort hook
		browser: Browsers.macOS('Desktop'),
		syncFullHistory: false,
	});

	setupReceiver(socket);

	socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
		const { connection, lastDisconnect, qr } = update;

		if (qr) {
			latestQr = qr;
			globalLogger.info('New QR code received, scan to authenticate.');
		}

		if (connection === 'close') {
			const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
			globalLogger.error('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);

			if (shouldReconnect) {
				setTimeout(() => connectToWhatsApp(), 5000); // 5 sec backoff
			}
		} else if (connection === 'open') {
			globalLogger.info('WhatsApp connection opened successfully');
			latestQr = null; // Clear QR since we are connected
		}
	});

	socket.ev.on('creds.update', saveCreds);
}

export function startWhatsAppProcess() {
	connectToWhatsApp().catch((err) => {
		globalLogger.error('Failed starting Baileys WS', err);
	});
}

export function getSocket(): WASocket {
	if (!socket) {
		throw new Error('Socket is not initialized yet');
	}
	return socket;
}

export function getLatestQr() {
	return latestQr;
}

export function closeWhatsApp() {
	if (socket) {
		socket.end(undefined);
	}
}
