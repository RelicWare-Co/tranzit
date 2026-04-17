import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger";

/**
 * Base directory for file uploads.
 * Defaults to ./uploads relative to server working directory.
 * Can be overridden via UPLOAD_DIR environment variable.
 */
export function getUploadDir(): string {
	return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

/**
 * Ensures the upload directory exists.
 */
function ensureUploadDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Resolves a storage key to an absolute file path.
 * Storage keys use forward slashes: documents/{requestId}/{timestamp}-{random}-{filename}
 */
export function resolveStoragePath(storageKey: string): string {
	// Normalize path separators and join with upload dir
	const normalizedKey = storageKey.replace(/\\/g, "/");
	return join(getUploadDir(), normalizedKey);
}

/**
 * Writes a file to disk at the storage key path.
 * Creates parent directories as needed.
 * 
 * @param storageKey - The storage key path (e.g., "documents/req-123/1234567890-abc123-file.pdf")
 * @param content - The file content as a Buffer
 * @returns The absolute path where the file was written
 */
export function storeFile(storageKey: string, content: Buffer): string {
	const absolutePath = resolveStoragePath(storageKey);
	const dir = absolutePath.substring(0, absolutePath.lastIndexOf("/"));

	// Ensure directory exists
	ensureUploadDir(dir);

	// Write file
	writeFileSync(absolutePath, content);

	logger.info(
		{
			storageKey,
			absolutePath,
			sizeBytes: content.length,
		},
		"File stored to disk",
	);

	return absolutePath;
}

/**
 * Reads a file from disk by storage key.
 * 
 * @param storageKey - The storage key path
 * @returns The file content as a Buffer
 * @throws if file does not exist
 */
export function readFile(storageKey: string): Buffer {
	const absolutePath = resolveStoragePath(storageKey);

	if (!existsSync(absolutePath)) {
		logger.warn({ storageKey, absolutePath }, "File not found on disk");
		throw new Error(`File not found: ${storageKey}`);
	}

	return readFileSync(absolutePath);
}

/**
 * Deletes a file from disk by storage key.
 * 
 * @param storageKey - The storage key path
 * @returns true if file was deleted, false if it didn't exist
 */
export function deleteFile(storageKey: string): boolean {
	const absolutePath = resolveStoragePath(storageKey);

	if (!existsSync(absolutePath)) {
		return false;
	}

	unlinkSync(absolutePath);
	logger.info({ storageKey }, "File deleted from disk");

	return true;
}

/**
 * Checks if a file exists on disk.
 */
export function fileExists(storageKey: string): boolean {
	const absolutePath = resolveStoragePath(storageKey);
	return existsSync(absolutePath);
}
