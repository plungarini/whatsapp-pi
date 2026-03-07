import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

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
				existingEnv[match[1]] = match[2].trim();
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
			const key = match[1].trim();
			const defaultValue = existingEnv[key] || match[2].trim();
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

	try {
		// Dynamically import dependencies first to avoid listener race conditions
		const {
			default: makeWASocket,
			useMultiFileAuthState,
			DisconnectReason,
			Browsers,
			fetchLatestBaileysVersion,
		} = await import('@whiskeysockets/baileys');
		const { default: pino } = await import('pino');
		const { default: qrcode } = await import('qrcode-terminal');

		console.log('Imported dependencies');

		const authDir = newEnv['WA_AUTH_DATA_DIR'] || './data/wa-auth';
		const resolvedAuthDir = path.resolve(process.cwd(), authDir);

		const { version, isLatest } = await fetchLatestBaileysVersion();
		console.log(`Using WA v${version.join('.')} (isLatest: ${isLatest})`);

		// Suppress baileys logs so it doesn't flood the terminal
		const logger = pino({ level: 'silent' });

		const connect = async () => {
			const { state, saveCreds } = await useMultiFileAuthState(resolvedAuthDir);
			return new Promise((resolve) => {
				const socket = makeWASocket({
					version,
					auth: state,
					printQRInTerminal: false,
					logger: logger,
					browser: Browsers.macOS('Desktop'),
					syncFullHistory: false,
				});

				socket.ev.on('creds.update', saveCreds);

				socket.ev.on('connection.update', (update) => {
					const { connection, lastDisconnect, qr } = update;

					if (qr) {
						console.log('\nReceived QR code! Please scan it with your WhatsApp app:');
						qrcode.generate(qr, { small: true });
					}

					if (connection === 'open') {
						console.log('\n✅ Successfully authenticated with WhatsApp!');

						if (qr) {
							console.log('⏳ Please keep this window open while WhatsApp synchronizes your chats to this device...');
							console.log('   (Your phone might say "Keep app open on both devices")\n');

							// Suppress annoying internal signal logs during the sync process
							const origConsoleWarn = console.warn;
							const origConsoleLog = console.log;
							console.warn = (...args) => {
								if (typeof args[0] === 'string' && args[0].includes('Closing open session')) return;
								origConsoleWarn(...args);
							};
							console.log = (...args) => {
								if (typeof args[0] === 'string' && args[0].includes('Closing session')) return;
								origConsoleLog(...args);
							};

							const rlWait = readline.createInterface({
								input: process.stdin,
								output: process.stdout,
							});

							rlWait.question('💬 Press ENTER when your phone tells you the setup is complete...', () => {
								rlWait.close();
								console.warn = origConsoleWarn;
								console.log = origConsoleLog;
								socket.ev.removeAllListeners('connection.update');
								socket.end(undefined);
								resolve({ success: true });
							});
						} else {
							// Already synced previously, just close gracefully
							setTimeout(() => {
								socket.ev.removeAllListeners('connection.update');
								socket.end(undefined);
								resolve({ success: true });
							}, 2000);
						}
					} else if (connection === 'close') {
						const error = lastDisconnect?.error;
						const statusCode = error?.output?.statusCode;

						if (statusCode === DisconnectReason.loggedOut) {
							console.log('\n❌ Logged out of WhatsApp. You can try running onboard again.');
							fs.rmSync(resolvedAuthDir, { recursive: true, force: true });
							socket.ev.removeAllListeners('connection.update');
							socket.end(undefined);
							resolve({ success: false });
						} else if (statusCode === 405) {
							console.log(
								'\n❌ WhatsApp rejected the connection (405). This usually means the server blocked the request, but try running onboard again.',
							);
							socket.ev.removeAllListeners('connection.update');
							socket.end(undefined);
							resolve({ success: false });
						} else {
							console.log(
								`Connection closed: ${error?.message || 'Unknown'} (Status code: ${statusCode || 'None'}). Reconnecting...`,
							);
							socket.ev.removeAllListeners('connection.update');
							socket.end(undefined);
							resolve({ reconnect: true });
						}
					}
				});
			});
		};

		let connected = false;
		while (!connected) {
			const result = await connect();
			if (result.success) {
				connected = true;
			} else if (result.reconnect) {
				await new Promise((r) => setTimeout(r, 2000));
			} else {
				console.log('\n❌ Onboarding failed. Please try again.');
				process.exit(1);
			}
		}

		console.log('\n🚀 Onboarding completely finished! Running tests...');

		let vecInstalled = false;
		try {
			await import('sqlite-vec');
			vecInstalled = true;
		} catch (e) {
			// Not installed
		}

		if (!vecInstalled) {
			const rl2 = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			const question2 = (query) => new Promise((resolve) => rl2.question(query, resolve));
			console.log('\n--- AI Semantic Search setup ---');
			console.log('Semantic search requires sqlite-vec. It seems to be missing or not loaded.');
			const installVec = await question2('Do you want to run the setup:vec command to fix this? (y/N): ');
			rl2.close();

			const { execSync } = await import('node:child_process');

			if (installVec.toLowerCase().trim() === 'y') {
				console.log('\nInstalling sqlite-vec extension (this may take a minute)...');
				try {
					execSync('npm run setup:vec', { stdio: 'inherit' });
					console.log('✅ Setup command finished. Please restart if tests still fail.');
				} catch (e) {
					console.error('Failed to install sqlite-vec:', e.message);
				}
			}
		}

		const { execSync } = await import('node:child_process');
		try {
			execSync('npm test', { stdio: 'inherit' });
			console.log('\n✅ All tests passed! You can now start the server.');
		} catch (error_) {
			console.error('\n❌ Tests failed. Please check the output above.', error_);
			process.exit(1);
		}
	} catch (err) {
		console.error('An error occurred during WhatsApp setup:', err);
		process.exit(1);
	}
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

try {
	await main();
} catch (err) {
	console.error(err);
	process.exit(1);
}
