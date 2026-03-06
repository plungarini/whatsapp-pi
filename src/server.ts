import cors from '@fastify/cors';
import dotenv from 'dotenv';
import fastify from 'fastify';
import { closeWhatsApp, startWhatsAppProcess } from './baileys.js';
import { globalLogger } from './logger.js';
import { senderRoutes } from './sender.js';
import { sessionsRoutes } from './sessions.js';

dotenv.config();

const app = fastify({ logger: false });

// Register CORS
await app.register(cors, {
	origin: '*',
});

app.register(sessionsRoutes);
app.register(senderRoutes);

// Health check
app.get('/health', async (request, reply) => {
	return { status: 'ok', timestamp: new Date().toISOString() };
});

export async function startServer() {
	try {
		startWhatsAppProcess();
		const port = Number(process.env.PORT) || 3001;
		await app.listen({ port, host: '0.0.0.0' });
		console.log(`Server listening at http://0.0.0.0:${port}`);
	} catch (err) {
		console.error('Failed to start server:', err);
		process.exit(1);
	}
}

// Graceful Shutdown
async function closeApp() {
	console.log('Shutting down server...');
	try {
		closeWhatsApp();
		await app.close();
		await globalLogger.close(); // Flush logs before exit
		console.log('Server stopped cleanly.');
		process.exit(0);
	} catch (err) {
		console.error('Error during shutdown:', err);
		process.exit(1);
	}
}

process.on('SIGINT', closeApp);
process.on('SIGTERM', closeApp);

startServer();
