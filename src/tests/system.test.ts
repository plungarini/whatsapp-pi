import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '../core/store.js';

describe('System Health & Integrations', () => {
	it('should have WhatsApp authentication data available', async () => {
		const authDir = process.env.WA_AUTH_DATA_DIR || './data/wa-auth';
		const resolvedAuthDir = path.resolve(process.cwd(), authDir);

		// Check if directory exists
		expect(fs.existsSync(resolvedAuthDir)).toBe(true);

		// Check if we can load the auth state
		const { state } = await useMultiFileAuthState(resolvedAuthDir);

		// A valid state should at least have creds populated if onboarded
		expect(state.creds).toBeDefined();
		expect(state.creds.me || state.creds.noiseKey).toBeDefined(); // User is logged in or has active keys
	});

	it('should have sqlite-vec extension loaded and ready', () => {
		// Test if we can call vec_version()
		let vecVersion = null;
		try {
			const row = db.prepare('SELECT vec_version() as version').get() as { version: string };
			vecVersion = row.version;
		} catch (error) {
			// If it fails, vec_version() doesn't exist
		}

		expect(vecVersion).toBeDefined();
		expect(vecVersion).not.toBeNull();
		expect(typeof vecVersion).toBe('string');
	});
});
