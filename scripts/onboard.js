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
