import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { resolveTestDatabase, SERVER_ROOT } from "./lib/test-database";
import { removeTestDatabaseFiles } from "./test-global-setup";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true });
	}
});

describe("test database isolation", () => {
	test("uses the server test database by default", () => {
		const result = resolveTestDatabase({});

		expect(result.filePath).toBe(path.resolve(SERVER_ROOT, "sqlite.test.db"));
		expect(result.url).toBe(pathToFileURL(result.filePath).href);
	});

	test("normalizes a custom test database relative to the server root", () => {
		const result = resolveTestDatabase({
			TURSO_TEST_DATABASE_URL: "file:./tmp/custom.test.db",
		});

		expect(result.filePath).toBe(
			path.resolve(SERVER_ROOT, "tmp/custom.test.db"),
		);
	});

	test("rejects the default development database", () => {
		expect(() =>
			resolveTestDatabase({
				TURSO_TEST_DATABASE_URL: "file:./sqlite.db",
			}),
		).toThrow("must not point to the development database");
	});

	test("rejects the configured development database", () => {
		expect(() =>
			resolveTestDatabase({
				TURSO_DATABASE_URL: "file:./custom-development.db",
				TURSO_TEST_DATABASE_URL: "file:./custom-development.db",
			}),
		).toThrow("must not point to the development database");
	});

	test("removes a custom database and all SQLite sidecars", () => {
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "tranzit-test-database-"),
		);
		temporaryDirectories.push(directory);
		const dbFile = path.join(directory, "custom.test.db");
		const files = [
			dbFile,
			`${dbFile}-journal`,
			`${dbFile}-shm`,
			`${dbFile}-wal`,
		];

		for (const file of files) {
			fs.writeFileSync(file, "test");
		}

		removeTestDatabaseFiles(dbFile);

		for (const file of files) {
			expect(fs.existsSync(file)).toBe(false);
		}
	});
});
