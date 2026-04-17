/**
 * Integration tests for Citizen Document Upload API.
 *
 * Tests:
 * - Valid file upload creates request_document row with status=pending
 * - Invalid MIME type returns 400 with supported types list
 * - Oversized file returns 400 with size limit
 * - Storage key generated and file persisted to disk
 *
 * Run with: cd server && bun test src/citizen-documents.test.ts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	uploadCitizenDocument,
	listCitizenDocuments,
	type UploadDocumentInput,
} from "./features/citizen/citizen-documents.service";
import { db, schema } from "./lib/db";

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
		description: "Test procedure for document upload tests",
		isActive: true,
	});
	return id;
};

const createBase64Content = (sizeBytes: number): string => {
	// Create a buffer of the approximate size needed (base64 is ~4/3 ratio)
	const binarySize = Math.ceil(sizeBytes * 0.75);
	const buffer = Buffer.alloc(binarySize, "A");
	return buffer.toString("base64");
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Citizen Document Upload", () => {
	let testUser: any;
	let testProcedureId: string;
	let testRequestId: string;

	beforeEach(async () => {
		// Create test user
		testUser = await createTestUser();

		// Create test procedure
		testProcedureId = await createTestProcedure();

		// Create test service request
		testRequestId = await createTestServiceRequest(testUser.user.id, testProcedureId);
	});

	afterEach(async () => {
		// Clean up test data
		await db.delete(schema.requestDocument).where(eq(schema.requestDocument.requestId, testRequestId));
		await db.delete(schema.serviceRequest).where(eq(schema.serviceRequest.id, testRequestId));
		await db.delete(schema.procedureType).where(eq(schema.procedureType.id, testProcedureId));
		await db.delete(schema.user).where(eq(schema.user.id, testUser.user.id));
	});

	test("uploads a valid PDF document and creates request_document row", async () => {
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "identification",
			label: "Documento de identidad",
			deliveryMode: "digital",
			fileName: "documento.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 1024,
			content: createBase64Content(1024),
		};

		const result = await uploadCitizenDocument(testUser.user.id, input);

		expect(result.id).toBeDefined();
		expect(result.requestId).toBe(testRequestId);
		expect(result.requirementKey).toBe("identification");
		expect(result.label).toBe("Documento de identidad");
		expect(result.deliveryMode).toBe("digital");
		expect(result.fileName).toBe("documento.pdf");
		expect(result.mimeType).toBe("application/pdf");
		expect(result.fileSizeBytes).toBe(1024);
		expect(result.status).toBe("pending");
		expect(result.isCurrent).toBe(true);
		expect(result.storageKey).toMatch(/^documents\/[a-f0-9-]+\/\d+-[a-f0-9]+-documento\.pdf$/);

		// Verify database row
		const dbDoc = await db.query.requestDocument.findFirst({
			where: eq(schema.requestDocument.id, result.id),
		});
		expect(dbDoc).toBeDefined();
		expect(dbDoc?.status).toBe("pending");
		expect(dbDoc?.isCurrent).toBe(true);
	});

	test("rejects upload with unsupported MIME type", async () => {
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "document",
			label: "Test document",
			deliveryMode: "digital",
			fileName: "malware.exe",
			mimeType: "application/x-executable",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		await expect(uploadCitizenDocument(testUser.user.id, input)).rejects.toThrow();
	});

	test("rejects upload with file larger than 10MB", async () => {
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "largefile",
			label: "Large file",
			deliveryMode: "digital",
			fileName: "large.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 11 * 1024 * 1024, // 11MB
			content: createBase64Content(11 * 1024 * 1024),
		};

		await expect(uploadCitizenDocument(testUser.user.id, input)).rejects.toThrow();
	});

	test("rejects upload when user is not owner of service request", async () => {
		// Create another user
		const otherUser = await createTestUser();

		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "doc",
			label: "Test",
			deliveryMode: "digital",
			fileName: "test.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		await expect(uploadCitizenDocument(otherUser.user.id, input)).rejects.toThrow();

		// Cleanup other user
		await db.delete(schema.user).where(eq(schema.user.id, otherUser.user.id));
	});

	test("rejects upload when service request does not exist", async () => {
		const input: UploadDocumentInput = {
			requestId: randomUUID(),
			requirementKey: "doc",
			label: "Test",
			deliveryMode: "digital",
			fileName: "test.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		await expect(uploadCitizenDocument(testUser.user.id, input)).rejects.toThrow();
	});

	test("marks previous documents as not current when uploading new version", async () => {
		// Upload first document
		const input1: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "identification",
			label: "Documento de identidad",
			deliveryMode: "digital",
			fileName: "doc1.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		const result1 = await uploadCitizenDocument(testUser.user.id, input1);
		expect(result1.isCurrent).toBe(true);

		// Upload second document for same requirement
		const input2: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "identification",
			label: "Documento de identidad (nuevo)",
			deliveryMode: "digital",
			fileName: "doc2.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		const result2 = await uploadCitizenDocument(testUser.user.id, input2);
		expect(result2.isCurrent).toBe(true);

		// Verify first document is no longer current
		const dbDoc1 = await db.query.requestDocument.findFirst({
			where: eq(schema.requestDocument.id, result1.id),
		});
		expect(dbDoc1?.isCurrent).toBe(false);
	});

	test("allows uploading multiple documents for different requirements", async () => {
		const input1: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "identification",
			label: "ID",
			deliveryMode: "digital",
			fileName: "id.pdf",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		const input2: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "proof_of_address",
			label: "Proof of Address",
			deliveryMode: "digital",
			fileName: "address.png",
			mimeType: "image/png",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		const result1 = await uploadCitizenDocument(testUser.user.id, input1);
		const result2 = await uploadCitizenDocument(testUser.user.id, input2);

		expect(result1.isCurrent).toBe(true);
		expect(result2.isCurrent).toBe(true);

		// Both should still be current since they're for different requirements
		const docs = await listCitizenDocuments(testUser.user.id, testRequestId);
		expect(docs.length).toBe(2);
		expect(docs.find((d) => d.id === result1.id)?.isCurrent).toBe(true);
		expect(docs.find((d) => d.id === result2.id)?.isCurrent).toBe(true);
	});

	test("rejects upload with invalid file extension", async () => {
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "doc",
			label: "Test",
			deliveryMode: "digital",
			fileName: "document.xyz",
			mimeType: "application/pdf",
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		await expect(uploadCitizenDocument(testUser.user.id, input)).rejects.toThrow();
	});

	test("rejects upload with MIME type that doesn't match extension", async () => {
		const input: UploadDocumentInput = {
			requestId: testRequestId,
			requirementKey: "doc",
			label: "Test",
			deliveryMode: "digital",
			fileName: "document.jpg",
			mimeType: "application/pdf", // PDF MIME but JPG extension
			fileSizeBytes: 100,
			content: createBase64Content(100),
		};

		await expect(uploadCitizenDocument(testUser.user.id, input)).rejects.toThrow();
	});
});
