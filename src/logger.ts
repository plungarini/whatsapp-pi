// A global logger client that intercepts standard console calls,
// batches them, and asynchronously flushes them to the logger-pi service.

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
	level: LogLevel;
	timestamp: string;
	message: string;
	meta?: any;
}

class LoggerClient {
	private logs: LogEntry[] = [];
	private readonly projectId = 'whatsapp-pi';
	private readonly endpoint = 'http://127.0.0.1:4000/logs';
	private interval: NodeJS.Timeout;
	private flushing = false;

	// Keep references to original console methods so we can mirror to terminal
	private origLog = console.log;
	private origWarn = console.warn;
	private origError = console.error;
	private origInfo = console.info;
	private origDebug = console.debug;

	constructor() {
		// Override global console methods
		console.log = (...args: any[]) => {
			this.origLog(...args);
			this.queue('info', args);
		};
		console.info = (...args: any[]) => {
			this.origInfo(...args);
			this.queue('info', args);
		};
		console.warn = (...args: any[]) => {
			this.origWarn(...args);
			this.queue('warn', args);
		};
		console.error = (...args: any[]) => {
			this.origError(...args);
			this.queue('error', args);
		};
		console.debug = (...args: any[]) => {
			this.origDebug(...args);
			this.queue('debug', args);
		};

		// Flush every 500ms
		this.interval = setInterval(() => this.flush(), 500);

		// Catch uncaught exceptions and flush immediately
		process.on('uncaughtException', (err) => {
			this.origError('Uncaught Exception:', err);
			this.queue('fatal', [err.stack || err.message || err]);
			this.flushSync();
			process.exit(1);
		});

		process.on('unhandledRejection', (reason) => {
			this.origError('Unhandled Rejection:', reason);
			const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
			this.queue('fatal', [msg]);
			this.flushSync();
			process.exit(1);
		});
	}

	private queue(level: LogLevel, args: any[]) {
		const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');

		this.logs.push({
			level,
			timestamp: new Date().toISOString(),
			message,
		});

		if (this.logs.length > 5000) {
			this.logs = this.logs.slice(-1000);
		}
	}

	public info(...args: any[]) {
		this.queue('info', args);
		this.origInfo(...args);
	}
	public error(...args: any[]) {
		this.queue('error', args);
		this.origError(...args);
	}
	public warn(...args: any[]) {
		this.queue('warn', args);
		this.origWarn(...args);
	}
	public debug(...args: any[]) {
		this.queue('debug', args);
		this.origDebug(...args);
	}
	public log(...args: any[]) {
		this.queue('info', args);
		this.origLog(...args);
	}

	public async flush() {
		if (this.flushing || this.logs.length === 0) return;
		this.flushing = true;

		const batch = [...this.logs];
		this.logs = [];

		try {
			await fetch(this.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: this.projectId, logs: batch }),
			});
		} catch (err) {
			this.logs = [...batch, ...this.logs].slice(-5000);
		} finally {
			this.flushing = false;
		}
	}

	private flushSync() {
		if (this.logs.length === 0) return;
		try {
			fetch(this.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: this.projectId, logs: this.logs }),
			}).catch(() => {});
		} catch (e) {}
	}

	public async close() {
		clearInterval(this.interval);
		await this.flush();
	}
}

export const globalLogger = new LoggerClient();
