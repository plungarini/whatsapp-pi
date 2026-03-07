import { globalLogger } from '../core/logger.js';

export const aiService = {
	computeEmbedding(text: string): number[] {
		globalLogger.debug(`Mock embedding compute for: ${text}`);
		return Array.from({ length: 384 }, () => 0);
	},

	runCompactionCheck(sessionId: string) {
		globalLogger.debug(`Checked history compaction for session: ${sessionId}`);
	},
};
