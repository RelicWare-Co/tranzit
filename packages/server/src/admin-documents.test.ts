/**
 * Integration tests for Admin Documents API.
 *
 * Tests:
 * - Admin can list documents for any request
 * - Admin can get document details
 * - Admin can download document file with correct content
 * - Download fails for non-existent document
 * - Download fails for physical documents without stored file
 *
 * Run with: cd server && bun test src/admin-documents.test.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { uploadCitizenDocument, type UploadDocumentInput } from "./features/citizen/citizen-documents.service";
import {
	listAdminDocuments,
	getAdminDocument,
	downloadAdminDocument,
} from "./features/admin/admin-documents.service";
import { getUploadDir } from "./lib/file-storage";
import { db, schema } from "./lib/db";

// Use the configured upload dir
const configuredUploadDir = getUploadDir();
const originalUploadDir = process.env.UPLOAD_DIR;

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const createTestUser = async () => {
	const userId = randomUUID();
	const email = `test_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test User",
		emailVerified: false,
	});

	return { user: { id: userId, email, name: "Test User" } };
};

const createTestServiceRequest = async (userId: string, procedureTypeId: string) => {
	const requestId = randomUUID();
	await db.insert(schema.serviceRequest).values({
		id: requestId,
		procedureTypeId,
		citizenUserId: userId,
		email: `test_${randomUUID()}@example.com`,
		documentType: "CC",
		documentNumber: randomUUID(),
		status: "draft",
	});
	return requestId;
};

const createTestProcedure = async () => {
	const id = randomUUID();
	await db.insert(schema.procedureType).values({
		id,
		slug: `test-proc-${randomUUID()}`,
		name: "Test Procedure",
		description: "Test procedure for document tests",
		isActive: true,
	});
	return id;
};

const createBase64Content = (sizeBytes: number): string => {
	const binarySize = Math.ceil(sizeBytes * 0.75);
	const buffer = Buffer.alloc(binarySize, "X");
	return buffer.toString("base64");
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Admin Documents", () => {
	let testUser: any;
	let testProcedureId: string;
	let testRequestId: string;
	let uploadedDocumentId: string;

	beforeEach(async () => {
		// Use the configured upload dir (tests use same dir as app)
		process.env.UPLOAD_DIR = configuredUploadDir;

		// Create test user
		testUser = await createTestUser();

		// Create test procedure
		testProcedureId = await createTestProcedure();

		// Create test service request
		testRequestId = await createTestServiceRequest(testUser.user.id, testProcedureId);

		// Upload a document
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "identification",
			label: "Documento de identidad",
			deliveryMode: "digital",
			fileName: "test-doc.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		const result = await uploadCitizenDocument(testUser.user.id, input);
		uploadedDocumentId = result.id;
	});

	afterEach(async () => {
		// Clean up test data
		await db.delete(schema.requestDocument).where(eq(schema.requestDocument.requestId, testRequestId));
		await db.delete(schema.serviceRequest).where(eq(schema.serviceRequest.id, testRequestId));
		await db.delete(schema.procedureType).where(eq(schema.procedureType.id, testProcedureId));
		await db.delete(schema.user).where(eq(schema.user.id, testUser.user.id));
	});

	describe("listAdminDocuments", () => {
		test("lists all documents for a request with review fields", async () => {
			const documents = await listAdminDocuments(testRequestId);

			expect(documents).toHaveLength(1);
			const doc = documents[0];
			expect(doc.id).toBe(uploadedDocumentId);
			expect(doc.requestId).toBe(testRequestId);
			expect(doc.requirementKey).toBe("identification");
			expect(doc.label).toBe("Documento de identidad");
			expect(doc.deliveryMode).toBe("digital");
			expect(doc.fileName).toBe("test-doc.pdf");
			expect(doc.mimeType).toBe("application/pdf");
			expect(doc.status).toBe("pending");
			expect(doc.isCurrent).toBe(true);
			expect(doc.replacesDocumentId).toBeNull();
			expect(doc.reviewedByUserId).toBeNull();
			expect(doc.reviewedAt).toBeNull();
			expect(doc.notes).toBeNull();
		});

		test("returns 404 for non-existent request", async () => {
			await expect(listAdminDocuments(randomUUID())).rejects.toThrow();
		});
	});

	describe("getAdminDocument", () => {
		test("gets document details by ID", async () => {
			const document = await getAdminDocument(uploadedDocumentId);

			expect(document.id).toBe(uploadedDocumentId);
			expect(document.requestId).toBe(testRequestId);
			expect(document.fileName).toBe("test-doc.pdf");
			expect(document.mimeType).toBe("application/pdf");
			expect(document.storageKey).toBeDefined();
		});

		test("returns 404 for non-existent document", async () => {
			await expect(getAdminDocument(randomUUID())).rejects.toThrow();
		});
	});

	describe("downloadAdminDocument", () => {
		test("downloads file content with correct metadata", async () => {
			const fileContent = "Hello, this is test file content!";
			const base64Content = Buffer.from(fileContent).toString("base64");

			// Upload a document with known content
			const input: UploadDocumentInput = {
				requestId: testRequestId,
				requirementKey: "download-test",
				label: "Download Test",
				deliveryMode: "digital",
				fileName: "download-test.pdf",
				mimeType: "application/pdf",
				fileSizeBytes: fileContent.length,
				content: base64Content,
			};

			const result = await uploadCitizenDocument(testUser.user.id, input);

			// Download the file
			const download = await downloadAdminDocument(result.id);

			expect(download.fileName).toBe("download-test.pdf");
			expect(download.mimeType).toBe("application/pdf");
			expect(download.content.toString("utf-8")).toBe(fileContent);
		});

		test("returns 404 for non-existent document", async () => {
			await expect(downloadAdminDocument(randomUUID())).rejects.toThrow();
		});

		test("fails for physical document without stored file", async () => {
			// Create a physical delivery document directly in DB
			const docId = randomUUID();
			await db.insert(schema.requestDocument).values({
				id: docId,
				requestId: testRequestId,
				requirementKey: "physical-doc",
				label: "Physical Document",
				deliveryMode: "physical",
				status: "marked_as_physical",
				isCurrent: true,
				// No storageKey for physical documents
			});

			await expect(downloadAdminDocument(docId)).rejects.toThrow();
		});
	});
});
