import { globalLogger } from './logger.js';

// Stubbed history compaction using LLM
export function runCompactionCheck(sessionId: string) {
	globalLogger.debug(`Checked history compaction for session: ${sessionId}`);
}
