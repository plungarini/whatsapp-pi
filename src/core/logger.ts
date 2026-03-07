import pino from 'pino';

const LOGGER_URL = process.env.LOGGER_URL || 'http://127.0.0.1:4000/logs';
const PROJECT_ID = 'whatsapp-pi';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000;

class RemoteStream {
	private buffer: any[] = [];
	private readonly timer: NodeJS.Timeout;

	constructor() {
		this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL);
	}

	write(msg: string) {
		try {
			const data = JSON.parse(msg);
			this.buffer.push({
				projectId: PROJECT_ID,
				level: this.mapLevel(data.level),
				message: data.msg,
				timestamp: new Date(data.time).toISOString(),
				...data,
			});

			if (this.buffer.length >= BATCH_SIZE) {
				this.flush();
			}
		} catch {
			// ignore parse errors
		}
	}

	private mapLevel(level: number): string {
		if (level <= 20) return 'debug';
		if (level <= 30) return 'info';
		if (level <= 40) return 'warn';
		if (level <= 50) return 'error';
		return 'fatal';
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
		} catch {
			// silent fail
		}
	}

	public stop() {
		clearInterval(this.timer);
	}
}

const remoteStream = new RemoteStream();

export const globalLogger = pino(
	{
		level: 'info',
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.multistream([
		{
			stream: pino.transport({
				target: 'pino-pretty',
				options: {
					colorize: true,
					ignore: 'pid,hostname,projectId',
					include: 'level,time,msg',
				},
			}),
		},
		{ stream: remoteStream },
	]),
);

// Intercept console calls to pipe them through pino
// We use a more robust version that doesn't just stringify everything
console.log = (...args: any[]) => {
	const msg = args.find((a) => typeof a === 'string') || '';
	const objs = args.filter((a) => typeof a !== 'string');
	if (objs.length > 0) {
		globalLogger.info(Object.assign({}, ...objs), msg);
	} else {
		globalLogger.info(msg);
	}
};

console.error = (...args: any[]) => {
	const msg = args.find((a) => typeof a === 'string') || '';
	const objs = args.filter((a) => typeof a !== 'string');
	if (objs.length > 0) {
		globalLogger.error(Object.assign({}, ...objs), msg);
	} else {
		globalLogger.error(msg);
	}
};

console.warn = (...args: any[]) => {
	const msg = args.find((a) => typeof a === 'string') || '';
	const objs = args.filter((a) => typeof a !== 'string');
	if (objs.length > 0) {
		globalLogger.warn(Object.assign({}, ...objs), msg);
	} else {
		globalLogger.warn(msg);
	}
};

console.debug = (...args: any[]) => {
	const msg = args.find((a) => typeof a === 'string') || '';
	const objs = args.filter((a) => typeof a !== 'string');
	if (objs.length > 0) {
		globalLogger.debug(Object.assign({}, ...objs), msg);
	} else {
		globalLogger.debug(msg);
	}
};

// Add close method for graceful shutdown
(globalLogger as any).close = async () => {
	remoteStream.stop();
	await remoteStream.flush();
};
