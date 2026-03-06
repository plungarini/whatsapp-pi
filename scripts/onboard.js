import fs from 'fs';
import path from 'path';
import readline from 'readline';

const envPath = path.resolve(process.cwd(), '.env');
const envExamplePath = path.resolve(process.cwd(), '.env.example');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
	console.log('\n=== WhatsApp-Pi Onboarding ===\n');

	// Read existing .env if it exists
	const existingEnv = {};
	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, 'utf8');
		content.split('\n').forEach((line) => {
			const match = line.match(/^([^=]+)=(.*)$/);
			if (match) {
				existingEnv[match[1]] = match[2];
			}
		});
	}

	// Read .env.example
	if (!fs.existsSync(envExamplePath)) {
		console.error('Error: .env.example file not found.');
		process.exit(1);
	}

	const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
	const lines = exampleContent.split('\n');
	const newEnv = {};

	for (const line of lines) {
		const match = line.match(/^([^=]+)=(.*)$/);
		if (match) {
			const key = match[1];
			const defaultValue = existingEnv[key] || match[2];
			const answer = await question(`Enter value for ${key} [${defaultValue}]: `);
			newEnv[key] = answer.trim() || defaultValue;
		}
	}

	rl.close();

	// Write back to .env
	const envOutput = Object.entries(newEnv)
		.map(([k, v]) => `${k}=${v}`)
		.join('\n');

	fs.writeFileSync(envPath, envOutput);
	console.log('\n✅ Successfully saved configuration to .env\n');

	console.log('--- WhatsApp Authentication ---');
	console.log('Initializing WhatsApp client. Please wait for the QR code...\n');

	// Dynamically import baileys and pino to avoid loading them if the script fails early
	const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
	const { default: pino } = await import('pino');

	const authDir = newEnv['WA_AUTH_DATA_DIR'] || './data/wa-auth';
	const resolvedAuthDir = path.resolve(process.cwd(), authDir);
	const { state, saveCreds } = await useMultiFileAuthState(resolvedAuthDir);

	// Suppress baileys logs so it doesn't flood the terminal
	const logger = pino({ level: 'silent' });

	const socket = makeWASocket({
		auth: state,
		// printQRInTerminal is deprecated, handled manually below
		printQRInTerminal: false,
		logger: logger,
	});

	socket.ev.on('creds.update', saveCreds);

	// Load qrcode-terminal
	const { default: qrcode } = await import('qrcode-terminal');

	await new Promise((resolve) => {
		socket.ev.on('connection.update', (update) => {
			const { connection, lastDisconnect, qr } = update;

			if (qr) {
				qrcode.generate(qr, { small: true });
			}

			if (connection === 'open') {
				console.log('\n✅ Successfully authenticated with WhatsApp!');
				socket.end(undefined);
				resolve();
			} else if (connection === 'close') {
				const statusCode = lastDisconnect?.error?.output?.statusCode;
				if (statusCode === DisconnectReason.loggedOut) {
					console.log('\n❌ Logged out of WhatsApp. You can try running onboard again.');
					socket.end(undefined);
					resolve();
				}
				// If it's a different code, baileys will automatically try to reconnect, so we just wait.
			}
		});
	});

	console.log('\n🚀 Onboarding completely finished! You can now start the server.');
}
// Handle sigint
let isExiting = false;
process.on('SIGINT', () => {
	if (!isExiting) {
		isExiting = true;
		console.log('\nSetup interrupted. Use npm run onboard to resume.');
		process.exit(0);
	}
});

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
