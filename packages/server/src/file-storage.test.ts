/**
 * Unit tests for file storage service.
 *
 * Tests:
 * - File write and read round-trip
 * - File existence check
 * - File deletion
 * - Directory creation
 * - Error handling for missing files
 *
 * Run with: cd server && bun test src/file-storage.test.ts
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	deleteFile,
	fileExists,
	getUploadDir,
	readFile,
	resolveStoragePath,
	storeFile,
} from "./lib/file-storage";

// Use a test-specific directory to avoid polluting actual uploads
const TEST_UPLOAD_DIR = join(process.cwd(), "test-uploads");

// Override UPLOAD_DIR for tests by temporarily setting env
const originalUploadDir = process.env.UPLOAD_DIR;

describe("File Storage", () => {
	beforeEach(() => {
		// Create clean test directory
		if (existsSync(TEST_UPLOAD_DIR)) {
			rmSync(TEST_UPLOAD_DIR, { recursive: true });
		}
		mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
		process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(TEST_UPLOAD_DIR)) {
			rmSync(TEST_UPLOAD_DIR, { recursive: true });
		}
		// Restore original env
		if (originalUploadDir) {
			process.env.UPLOAD_DIR = originalUploadDir;
		} else {
			delete process.env.UPLOAD_DIR;
		}
	});

	test("resolveStoragePath joins upload dir with storage key", () => {
		const storageKey = "documents/req-123/1234567890-abc-file.pdf";
		const path = resolveStoragePath(storageKey);
		expect(path).toBe(join(TEST_UPLOAD_DIR, "documents", "req-123", "1234567890-abc-file.pdf"));
	});

	test("stores and reads file successfully", () => {
		const storageKey = "documents/test-req/test-file.pdf";
		const content = Buffer.from("Hello, World!", "utf-8");

		// Store file
		const storedPath = storeFile(storageKey, content);
		expect(storedPath).toBe(join(TEST_UPLOAD_DIR, "documents", "test-req", "test-file.pdf"));

		// Verify file exists on disk
		expect(existsSync(storedPath)).toBe(true);

		// Read file back
		const readContent = readFile(storageKey);
		expect(readContent).toEqual(content);
	});

	test("creates nested directories automatically", () => {
		const storageKey = "documents/a/b/c/d/deep-file.pdf";
		const content = Buffer.from("Deep content", "utf-8");

		storeFile(storageKey, content);

		const storedPath = resolveStoragePath(storageKey);
		expect(existsSync(storedPath)).toBe(true);
		expect(existsSync(join(TEST_UPLOAD_DIR, "documents", "a", "b", "c", "d"))).toBe(true);
	});

	test("fileExists returns true for existing file", () => {
		const storageKey = "documents/existing-file.pdf";
		const content = Buffer.from("exists", "utf-8");
		storeFile(storageKey, content);

		expect(fileExists(storageKey)).toBe(true);
	});

	test("fileExists returns false for non-existing file", () => {
		expect(fileExists("documents/non-existing-file.pdf")).toBe(false);
	});

	test("readFile throws for non-existing file", () => {
		expect(() => readFile("documents/missing-file.pdf")).toThrow("File not found");
	});

	test("deleteFile removes existing file", () => {
		const storageKey = "documents/to-delete.pdf";
		const content = Buffer.from("delete me", "utf-8");
		storeFile(storageKey, content);

		expect(fileExists(storageKey)).toBe(true);

		const deleted = deleteFile(storageKey);
		expect(deleted).toBe(true);
		expect(fileExists(storageKey)).toBe(false);
	});

	test("deleteFile returns false for non-existing file", () => {
		const deleted = deleteFile("documents/already-gone.pdf");
		expect(deleted).toBe(false);
	});

	test("handles binary content correctly", () => {
		const storageKey = "documents/binary-file.bin";
		// Create binary content with various byte values
		const content = Buffer.alloc(256);
		for (let i = 0; i < 256; i++) {
			content[i] = i;
		}

		storeFile(storageKey, content);
		const readContent = readFile(storageKey);

		expect(readContent).toEqual(content);
	});
});
