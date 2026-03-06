import { globalLogger } from './logger.js';

// Stubbed for now, as the plan outlines an optional vector semantic search
export function computeEmbedding(text: string): number[] {
	globalLogger.debug(`Mock embedding compute for: ${text}`);
	// return array of 384 zeros for stub
	return Array.from({ length: 384 }, () => 0);
}
