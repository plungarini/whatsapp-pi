/**
 * WhatsApp-Pi centralized logging
 * Buffers logs and sends them to the logger-pi service periodically
 */

const LOGGER_URL = process.env.LOGGER_URL || 'http://127.0.0.1:4000/logs';
const PROJECT_ID = 'whatsapp-pi';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000;

class RemoteLogger {
	private buffer: any[] = [];
	private timer: NodeJS.Timeout | null = null;
	private readonly originalLog = console.log;
	private readonly originalError = console.error;
	private readonly originalWarn = console.warn;
	private readonly originalDebug = console.debug;

	constructor() {
		this.setupInterception();
		this.startFlushTimer();
	}

	private setupInterception() {
		console.log = (...args: any[]) => {
			this.push('info', args.map(String).join(' '));
			this.originalLog.apply(console, args);
		};

		console.error = (...args: any[]) => {
			this.push('error', args.map(String).join(' '));
			this.originalError.apply(console, args);
		};

		console.warn = (...args: any[]) => {
			this.push('warn', args.map(String).join(' '));
			this.originalWarn.apply(console, args);
		};

		console.debug = (...args: any[]) => {
			this.push('debug', args.map(String).join(' '));
			this.originalDebug.apply(console, args);
		};
	}

	private push(level: string, message: string) {
		this.buffer.push({
			projectId: PROJECT_ID,
			level,
			message,
			timestamp: new Date().toISOString(),
		});

		if (this.buffer.length >= BATCH_SIZE) {
			this.flush();
		}
	}

	private startFlushTimer() {
		this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL);
	}

	public async flush() {
		if (this.buffer.length === 0) return;

		const payload = [...this.buffer];
		this.buffer = [];

		try {
			await fetch(LOGGER_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
		} catch (error_) {
			// Silent fail but log to original error console to avoid swallowing or infinite recursion
			this.originalError.call(console, '[RemoteLogger] Failed to flush logs:', error_);
		}
	}

	public info(msg: string, ...meta: any[]) {
		console.log(msg, ...meta);
	}

	public error(msg: string, ...meta: any[]) {
		console.error(msg, ...meta);
	}

	public warn(msg: string, ...meta: any[]) {
		console.warn(msg, ...meta);
	}

	public debug(msg: string, ...meta: any[]) {
		console.debug(msg, ...meta);
	}

	public async close() {
		if (this.timer) clearInterval(this.timer);
		await this.flush();
	}
}

export const globalLogger = new RemoteLogger();
