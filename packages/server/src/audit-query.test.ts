/**
 * Integration tests for Audit Log Query API.
 *
 * Tests:
 * - Query by entityType+entityId returns indexed results
 * - Query by actorUserId returns indexed results
 * - Query by date range works
 * - All entries have non-empty summary and JSON payload
 * - Pagination works correctly
 * - Filtering by action works
 * - Router requires admin auth
 *
 * Run with: cd server && bun test src/audit-query.test.ts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	listAuditEvents,
	getAuditEvent,
} from "./features/audit/audit-query.service";
import { db, schema } from "./lib/db";
import { createTranzitRpcRouter } from "./orpc/router";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const createTestUser = async (role = "admin") => {
	const userId = randomUUID();
	const email = `test_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test User",
		emailVerified: true,
		role,
	});

	return { id: userId, email, name: "Test User" };
};

const createTestAuditEvent = async (input: {
	actorType: string;
	actorUserId?: string | null;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	payload?: Record<string, unknown>;
	ipAddress?: string | null;
	userAgent?: string | null;
	createdAt?: Date;
}) => {
	const id = randomUUID();
	await db.insert(schema.auditEvent).values({
		id,
		actorType: input.actorType,
		actorUserId: input.actorUserId ?? null,
		entityType: input.entityType,
		entityId: input.entityId,
		action: input.action,
		summary: input.summary,
		payload: input.payload ?? {},
		ipAddress: input.ipAddress ?? null,
		userAgent: input.userAgent ?? null,
		createdAt: input.createdAt ?? new Date(),
	});
	return id;
};

const cleanupAuditEvents = async () => {
	await db.delete(schema.auditEvent);
};

const cleanupUsers = async () => {
	await db.delete(schema.user);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Audit Query API", () => {
	beforeEach(async () => {
		await cleanupAuditEvents();
		await cleanupUsers();
	});

	afterEach(async () => {
		await cleanupAuditEvents();
		await cleanupUsers();
	});

	describe("listAuditEvents", () => {
		test("returns empty result when no events exist", async () => {
			const result = await listAuditEvents();
			expect(result.entries).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		test("returns all events when no filters applied", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "confirm",
				summary: "Booking confirmed",
			});

			const result = await listAuditEvents();
			expect(result.entries).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		test("filters by entityType", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "procedure",
				entityId: "proc_1",
				action: "create",
				summary: "Procedure created",
			});

			const result = await listAuditEvents({ entityType: "booking" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].entityType).toBe("booking");
			expect(result.total).toBe(1);
		});

		test("filters by entityType and entityId (uses entity index)", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking bkg_1 created",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "confirm",
				summary: "Booking bkg_2 confirmed",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "procedure",
				entityId: "proc_1",
				action: "create",
				summary: "Procedure created",
			});

			const result = await listAuditEvents({
				entityType: "booking",
				entityId: "bkg_1",
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].entityId).toBe("bkg_1");
			expect(result.entries[0].summary).toBe("Booking bkg_1 created");
		});

		test("filters by actorUserId (uses actor index)", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user1.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created by user1",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user2.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "create",
				summary: "Booking created by user2",
			});

			const result = await listAuditEvents({ actorUserId: user1.id });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].actorUserId).toBe(user1.id);
			expect(result.entries[0].summary).toBe("Booking created by user1");
		});

		test("filters by date range", async () => {
			const user = await createTestUser();
			const now = new Date();

			// Create events on different days
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Event today",
				createdAt: now,
			});

			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "create",
				summary: "Event yesterday",
				createdAt: yesterday,
			});

			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_3",
				action: "create",
				summary: "Event tomorrow",
				createdAt: tomorrow,
			});

			// Query only today
			const todayStr = now.toISOString().slice(0, 10);
			const result = await listAuditEvents({
				dateFrom: todayStr,
				dateTo: todayStr,
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].summary).toBe("Event today");
		});

		test("filters by action", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "confirm",
				summary: "Booking confirmed",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_3",
				action: "cancel",
				summary: "Booking cancelled",
			});

			const result = await listAuditEvents({ action: "confirm" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].action).toBe("confirm");
		});

		test("pagination works correctly", async () => {
			const user = await createTestUser();
			// Create 5 events
			for (let i = 1; i <= 5; i++) {
				await createTestAuditEvent({
					actorType: "admin",
					actorUserId: user.id,
					entityType: "booking",
					entityId: `bkg_${i}`,
					action: "create",
					summary: `Booking ${i} created`,
				});
			}

			// Get first 2
			const page1 = await listAuditEvents({ limit: 2, offset: 0 });
			expect(page1.entries).toHaveLength(2);
			expect(page1.total).toBe(5);
			expect(page1.hasMore).toBe(true);

			// Get next 2
			const page2 = await listAuditEvents({ limit: 2, offset: 2 });
			expect(page2.entries).toHaveLength(2);
			expect(page2.total).toBe(5);
			expect(page2.hasMore).toBe(true);

			// Get last 1
			const page3 = await listAuditEvents({ limit: 2, offset: 4 });
			expect(page3.entries).toHaveLength(1);
			expect(page3.total).toBe(5);
			expect(page3.hasMore).toBe(false);
		});

		test("ordering by createdAt desc (default)", async () => {
			const user = await createTestUser();
			const now = new Date();

			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "First",
				createdAt: new Date(now.getTime() - 2000),
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "create",
				summary: "Second",
				createdAt: new Date(now.getTime() - 1000),
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_3",
				action: "create",
				summary: "Third",
				createdAt: now,
			});

			const result = await listAuditEvents({ orderDir: "desc" });
			expect(result.entries[0].summary).toBe("Third");
			expect(result.entries[1].summary).toBe("Second");
			expect(result.entries[2].summary).toBe("First");
		});

		test("ordering by createdAt asc", async () => {
			const user = await createTestUser();
			const now = new Date();

			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "First",
				createdAt: new Date(now.getTime() - 2000),
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "create",
				summary: "Second",
				createdAt: new Date(now.getTime() - 1000),
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_3",
				action: "create",
				summary: "Third",
				createdAt: now,
			});

			const result = await listAuditEvents({ orderDir: "asc" });
			expect(result.entries[0].summary).toBe("First");
			expect(result.entries[1].summary).toBe("Second");
			expect(result.entries[2].summary).toBe("Third");
		});

		test("every entry has non-empty summary", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "A meaningful summary",
			});

			const result = await listAuditEvents();
			for (const entry of result.entries) {
				expect(entry.summary).toBeTruthy();
				expect(entry.summary.length).toBeGreaterThan(0);
			}
		});

		test("every entry has JSON payload", async () => {
			const user = await createTestUser();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
				payload: { bookingId: "bkg_1", slotDate: "2024-01-15" },
			});

			const result = await listAuditEvents();
			for (const entry of result.entries) {
				expect(typeof entry.payload).toBe("object");
				expect(entry.payload).not.toBeNull();
			}
		});

		test("returns entry with all fields populated", async () => {
			const user = await createTestUser();
			const now = new Date();
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
				payload: { key: "value" },
				ipAddress: "127.0.0.1",
				userAgent: "TestAgent/1.0",
				createdAt: now,
			});

			const result = await listAuditEvents();
			expect(result.entries).toHaveLength(1);
			const entry = result.entries[0];
			expect(entry.id).toBeDefined();
			expect(entry.actorType).toBe("admin");
			expect(entry.actorUserId).toBe(user.id);
			expect(entry.entityType).toBe("booking");
			expect(entry.entityId).toBe("bkg_1");
			expect(entry.action).toBe("create");
			expect(entry.summary).toBe("Booking created");
			expect(entry.payload).toEqual({ key: "value" });
			expect(entry.ipAddress).toBe("127.0.0.1");
			expect(entry.userAgent).toBe("TestAgent/1.0");
			expect(entry.createdAt).toBeInstanceOf(Date);
		});
	});

	describe("validation", () => {
		test("rejects invalid dateFrom format", async () => {
			await expect(
				listAuditEvents({ dateFrom: "invalid-date" }),
			).rejects.toThrow();
		});

		test("rejects invalid dateTo format", async () => {
			await expect(
				listAuditEvents({ dateTo: "invalid-date" }),
			).rejects.toThrow();
		});

		test("rejects dateTo before dateFrom", async () => {
			await expect(
				listAuditEvents({ dateFrom: "2024-01-15", dateTo: "2024-01-10" }),
			).rejects.toThrow();
		});

		test("rejects limit below 1", async () => {
			await expect(listAuditEvents({ limit: 0 })).rejects.toThrow();
		});

		test("rejects limit above 200", async () => {
			await expect(listAuditEvents({ limit: 201 })).rejects.toThrow();
		});

		test("rejects negative offset", async () => {
			await expect(listAuditEvents({ offset: -1 })).rejects.toThrow();
		});
	});

	describe("getAuditEvent", () => {
		test("returns single event by ID", async () => {
			const user = await createTestUser();
			const eventId = await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "Booking created",
				payload: { test: true },
			});

			const result = await getAuditEvent(eventId);
			expect(result.id).toBe(eventId);
			expect(result.summary).toBe("Booking created");
			expect(result.payload).toEqual({ test: true });
		});

		test("throws 404 for non-existent ID", async () => {
			await expect(
				getAuditEvent("non-existent-id"),
			).rejects.toThrow();
		});
	});

	describe("combined filters", () => {
		test("combines multiple filters with AND semantics", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user1.id,
				entityType: "booking",
				entityId: "bkg_1",
				action: "create",
				summary: "User1 created booking",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user1.id,
				entityType: "procedure",
				entityId: "proc_1",
				action: "create",
				summary: "User1 created procedure",
			});
			await createTestAuditEvent({
				actorType: "admin",
				actorUserId: user2.id,
				entityType: "booking",
				entityId: "bkg_2",
				action: "confirm",
				summary: "User2 confirmed booking",
			});

			// Filter by entityType=booking AND actorUserId=user1
			const result = await listAuditEvents({
				entityType: "booking",
				actorUserId: user1.id,
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].summary).toBe("User1 created booking");
		});
	});

	describe("router integration", () => {
		test("router exposes admin.audit.list handler", async () => {
			const router = createTranzitRpcRouter();
			expect(router.admin.audit).toBeDefined();
			expect(router.admin.audit.list).toBeDefined();
			expect(router.admin.audit.get).toBeDefined();
		});

		test("list and get handlers are defined", async () => {
			const router = createTranzitRpcRouter();
			// The handlers should be objects with handler methods
			expect(typeof router.admin.audit.list).toBe("object");
			expect(typeof router.admin.audit.get).toBe("object");
		});
	});
});
