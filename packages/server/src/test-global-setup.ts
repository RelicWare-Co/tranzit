import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { resolveTestDatabase, SERVER_ROOT } from "./lib/test-database";

export function removeTestDatabaseFiles(dbFile: string) {
	for (const suffix of ["", "-journal", "-shm", "-wal"]) {
		fs.rmSync(`${dbFile}${suffix}`, { force: true });
	}
}

export default function setup() {
	loadEnv({ path: path.resolve(SERVER_ROOT, "../../.env") });

	const { filePath: dbFile } = resolveTestDatabase();
	removeTestDatabaseFiles(dbFile);
}
