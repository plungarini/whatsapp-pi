import cors from '@fastify/cors';
import fastify from 'fastify';
import { closeWhatsApp, startWhatsAppProcess } from '../core/baileys.js';
import { globalLogger } from '../core/logger.js';
import { messagingRoutes } from './routes/messaging.routes.js';
import { sessionsRoutes } from './routes/sessions.routes.js';

const app = fastify({ logger: false });

export async function initServer() {
	// Register CORS
	await app.register(cors, {
		origin: '*',
	});

	// Register Routes
	app.addHook('preHandler', async (request, reply) => {
		const apiKey = process.env.API_KEY || 'bf8699858ab55fac8358d21371ddd048';
		const providedKey = request.headers['x-api-key'];

		if (providedKey !== apiKey) {
			return reply.status(401).send({ error: 'Unauthorized: Invalid API Key' });
		}
	});

	await app.register(sessionsRoutes);
	await app.register(messagingRoutes);

	// Health check
	app.get('/health', async () => {
		return { status: 'ok', timestamp: new Date().toISOString() };
	});

	return app;
}

export async function startServer() {
	try {
		const server = await initServer();
		startWhatsAppProcess();
		const port = Number(process.env.PORT) || 3001;
		await server.listen({ port, host: '0.0.0.0' });
		console.log(`Server listening at http://0.0.0.0:${port}`);
	} catch (err) {
		console.error('Failed to start server:', err);
		process.exit(1);
	}
}

// Graceful Shutdown
async function closeApp() {
	console.log('\nShutting down server...');
	try {
		closeWhatsApp();
		await app.close();
		await (globalLogger as any).close();
		console.log('Server stopped cleanly.');
		process.exit(0);
	} catch (err) {
		console.error('Error during shutdown:', err);
		process.exit(1);
	}
}

process.on('SIGINT', closeApp);
process.on('SIGTERM', closeApp);
