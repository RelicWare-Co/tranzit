import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SERVER_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_DEVELOPMENT_DATABASE_PATH = path.resolve(
	SERVER_ROOT,
	"sqlite.db",
);
const DEFAULT_TEST_DATABASE_PATH = path.resolve(SERVER_ROOT, "sqlite.test.db");

function resolveFileDatabasePath(databaseUrl: string): string {
	if (!databaseUrl.startsWith("file:")) {
		throw new Error(
			"TURSO_TEST_DATABASE_URL must point to a local file: database.",
		);
	}

	const location = databaseUrl.slice("file:".length);
	if (!location) {
		throw new Error("TURSO_TEST_DATABASE_URL must include a database path.");
	}

	if (location.startsWith("/")) {
		return path.resolve(fileURLToPath(databaseUrl));
	}

	return path.resolve(SERVER_ROOT, decodeURIComponent(location));
}

function resolveDevelopmentDatabasePath(
	databaseUrl: string | undefined,
): string | null {
	if (!databaseUrl?.startsWith("file:")) {
		return null;
	}

	const location = databaseUrl.slice("file:".length);
	if (!location) {
		return null;
	}

	if (location.startsWith("/")) {
		return path.resolve(fileURLToPath(databaseUrl));
	}

	return path.resolve(SERVER_ROOT, decodeURIComponent(location));
}

export function resolveTestDatabase(env: NodeJS.ProcessEnv = process.env): {
	filePath: string;
	url: string;
} {
	const configuredUrl = env.TURSO_TEST_DATABASE_URL?.trim();
	const filePath = configuredUrl
		? resolveFileDatabasePath(configuredUrl)
		: DEFAULT_TEST_DATABASE_PATH;
	const developmentDatabasePath = resolveDevelopmentDatabasePath(
		env.TURSO_DATABASE_URL?.trim(),
	);

	if (
		filePath === DEFAULT_DEVELOPMENT_DATABASE_PATH ||
		filePath === developmentDatabasePath
	) {
		throw new Error(
			"TURSO_TEST_DATABASE_URL must not point to the development database.",
		);
	}

	return {
		filePath,
		url: pathToFileURL(filePath).href,
	};
}
