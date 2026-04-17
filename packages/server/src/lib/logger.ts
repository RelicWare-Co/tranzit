import type { DebugLogOptions } from "hono-pino/debug-log";
import pino, { type LevelWithSilent, type LoggerOptions } from "pino";

const LOG_LEVELS: LevelWithSilent[] = [
	"trace",
	"debug",
	"info",
	"warn",
	"error",
	"fatal",
	"silent",
];

const DEFAULT_LOG_LEVEL: LevelWithSilent = "info";
const rawLevel = process.env.LOG_LEVEL?.toLowerCase();
const level = (
	rawLevel && LOG_LEVELS.includes(rawLevel as LevelWithSilent)
		? rawLevel
		: DEFAULT_LOG_LEVEL
) as LevelWithSilent;
const isVerboseLevel = level === "trace" || level === "debug";

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

const loggerOptions: LoggerOptions = {
	level,
	base: undefined,
	timestamp: pino.stdTimeFunctions.isoTime,
	serializers: {
		err: (value) => {
			const serialized = pino.stdSerializers.err(value);

			if (isVerboseLevel) {
				return serialized;
			}

			const errRecord = asRecord(serialized);
			if (!errRecord) {
				return serialized;
			}

			return {
				type: errRecord.type,
				code: errRecord.code,
				message: errRecord.message,
			};
		},
		req: (value) => {
			const req = asRecord(value);
			if (!req) {
				return value;
			}

			const method = typeof req.method === "string" ? req.method : undefined;
			const rawUrl = typeof req.url === "string" ? req.url : undefined;
			const path = rawUrl ? rawUrl.split("?")[0] : undefined;

			if (isVerboseLevel) {
				const headers = asRecord(req.headers);
				const userAgent = headers?.["user-agent"];
				const forwardedFor = headers?.["x-forwarded-for"];

				return {
					method,
					path,
					url: rawUrl,
					userAgent: typeof userAgent === "string" ? userAgent : undefined,
					forwardedFor:
						typeof forwardedFor === "string" ? forwardedFor : undefined,
				};
			}

			return { method, url: path };
		},
		res: (value) => {
			const res = asRecord(value);
			if (!res) {
				return value;
			}

			const status =
				typeof res.status === "number"
					? res.status
					: typeof res.statusCode === "number"
						? res.statusCode
						: undefined;

			if (isVerboseLevel) {
				return {
					status,
					statusText:
						typeof res.statusText === "string" ? res.statusText : undefined,
				};
			}

			return { status };
		},
	},
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"headers.authorization",
			"headers.cookie",
		],
		remove: true,
	},
};

if (
	process.env.NODE_ENV !== "production" &&
	process.env.LOG_PRETTY !== "false"
) {
	const prettyOptions: DebugLogOptions = {
		colorEnabled: true,
		normalLogFormat: "[{time}] {levelLabel} {msg} {bindings}",
		httpLogFormat:
			"[{time}] {levelLabel} #{reqId} {req.method} {req.url} {res.status} ({responseTime}ms) {msg} {bindings}",
	};

	loggerOptions.transport = {
		target: "hono-pino/debug-log",
		options: prettyOptions,
	};
}

export const logger = pino(loggerOptions);
