/**
 * Integration tests for Email Notification System.
 *
 * Tests VAL-NOTIF-004: Booking confirmation email sent
 * Tests VAL-NOTIF-005: Confirmation email has booking details
 * Tests VAL-NOTIF-006: Cancellation notification sent
 * Tests VAL-NOTIF-007: Notification status tracked
 * Tests VAL-NOTIF-009: Hold notification record created
 * Tests VAL-NOTIF-010: Correct template keys used
 *
 * Run with: cd server && bun test src/notification-emails.test.ts
 */
import { randomUUID } from "node:crypto";
import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	sendBookingCancellationEmail,
	sendBookingConfirmationEmail,
	sendHoldExpirationEmail,
	sendOtpNotification,
} from "./features/notifications/notification.service";
import type { TemplateContext } from "./features/notifications/notification-templates";
import { db, schema } from "./lib/db";

// ---------------------------------------------------------------------------
// Test Auth Setup
// ---------------------------------------------------------------------------

function createEmptyDb(): Record<string, unknown[]> {
	return {
		user: [],
		session: [],
		account: [],
		verification: [],
		rateLimit: [],
	};
}

function createTestAuth() {
	const memDb = createEmptyDb();
	const otpStore: Record<string, Record<string, string>> = {};

	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "test-secret-that-is-at-least-32-chars-long-xxxxxxxxxxxx",
		database: memoryAdapter(memDb) as any,
		rateLimit: { enabled: false },
		plugins: [
			admin(),
			emailOTP({
				otpLength: 6,
				expiresIn: 300,
				allowedAttempts: 3,
				storeOTP: "hashed",
				async sendVerificationOTP({ email, otp, type }) {
					if (!otpStore[type]) otpStore[type] = {};
					otpStore[type][email] = otp;
				},
			}),
		],
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
		advanced: { cookies: {} },
	});

	return { auth, memDb, otpStore };
}

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestApp(auth: any) {
	type AppVariables = {
		user: typeof auth.$Infer.Session.user | null;
		session: typeof auth.$Infer.Session.session | null;
	};

	const app = new Hono<{ Variables: AppVariables }>();

	app.use(
		"/api/*",
		cors({
			origin: "http://localhost:3000",
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
		}),
	);

	app.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		c.set("user", session?.user ?? null);
		c.set("session", session?.session ?? null);
		await next();
	});

	app.get("/api/health", (c) => c.json({ status: "ok" }));

	return app;
}

// ---------------------------------------------------------------------------
// Test Data Setup
// ---------------------------------------------------------------------------

async function setupTestData() {
	const bookingId = randomUUID();
	const procedureName = "Certificado de Tradición y Libertad";
	const appointmentDate = "2025-06-15";
	const appointmentTime = "09:00";
	const appointmentEndTime = "09:30";
	const staffName = "Juan Pérez";
	const citizenName = "María González";
	const citizenEmail = `test-${randomUUID()}@example.com`;

	const context: TemplateContext = {
		procedureName,
		appointmentDate,
		appointmentTime,
		appointmentEndTime,
		staffName,
		citizenName,
		bookingId,
		serviceRequest: {
			applicantName: citizenName,
			applicantDocument: "123456789",
			plate: "ABC-123",
		},
	};

	return { bookingId, procedureName, appointmentDate, appointmentTime, staffName, citizenName, citizenEmail, context };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Notification Email System", () => {
	let auth: ReturnType<typeof createTestAuth>["auth"];

	beforeEach(async () => {
		const testAuth = createTestAuth();
		auth = testAuth.auth;
		createTestApp(auth);

		// Clean up notification_delivery table
		await db.delete(schema.notificationDelivery);
	});

	afterEach(async () => {
		// Clean up after each test
		await db.delete(schema.notificationDelivery);
	});

	describe("sendBookingConfirmationEmail", () => {
		test("VAL-NOTIF-004: sends confirmation email and creates notification record", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			// Send the confirmation email
			await sendBookingConfirmationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			// Verify notification_delivery record was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBeGreaterThan(0);

			const notification = notifications.find(
				(n) => n.templateKey === "booking-confirmation",
			);
			expect(notification).toBeDefined();
			expect(notification?.recipient).toBe(citizenEmail);
			expect(notification?.status).toBe("sent");
			expect(notification?.attemptCount).toBe(1);
			expect(notification?.sentAt).toBeDefined();
		});

		test("VAL-NOTIF-005: confirmation email contains booking details", async () => {
			const { bookingId, citizenEmail, context, procedureName, staffName } = await setupTestData();

			await sendBookingConfirmationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			// Verify the payload stored in notification_delivery contains the details
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			const notification = notifications.find(
				(n) => n.templateKey === "booking-confirmation",
			);

			expect(notification?.payload).toBeDefined();
			const payload = notification?.payload as Record<string, unknown>;
			expect(payload.procedureName).toBe(procedureName);
			expect(payload.staffName).toBe(staffName);
			expect(payload.appointmentDate).toBe(context.appointmentDate);
			expect(payload.appointmentTime).toBe(context.appointmentTime);
		});

		test("VAL-NOTIF-010: uses correct template key for confirmation", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			await sendBookingConfirmationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			const confirmationNotification = notifications.find(
				(n) => n.templateKey === "booking-confirmation",
			);
			expect(confirmationNotification).toBeDefined();
		});
	});

	describe("sendBookingCancellationEmail", () => {
		test("VAL-NOTIF-006: sends cancellation email and creates notification record", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			await sendBookingCancellationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			// Verify notification_delivery record was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBeGreaterThan(0);

			const notification = notifications.find(
				(n) => n.templateKey === "booking-cancellation",
			);
			expect(notification).toBeDefined();
			expect(notification?.recipient).toBe(citizenEmail);
			expect(notification?.status).toBe("sent");
		});

		test("VAL-NOTIF-010: uses correct template key for cancellation", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			await sendBookingCancellationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			const cancellationNotification = notifications.find(
				(n) => n.templateKey === "booking-cancellation",
			);
			expect(cancellationNotification).toBeDefined();
		});
	});

	describe("sendHoldExpirationEmail", () => {
		test("sends hold expiration email and creates notification record", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			await sendHoldExpirationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			// Verify notification_delivery record was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBeGreaterThan(0);

			const notification = notifications.find(
				(n) => n.templateKey === "booking-hold-expired",
			);
			expect(notification).toBeDefined();
			expect(notification?.recipient).toBe(citizenEmail);
			expect(notification?.status).toBe("sent");
		});

		test("VAL-NOTIF-010: uses correct template key for hold expiration", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			await sendHoldExpirationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			const expirationNotification = notifications.find(
				(n) => n.templateKey === "booking-hold-expired",
			);
			expect(expirationNotification).toBeDefined();
		});
	});

	describe("Notification status tracking", () => {
		test("VAL-NOTIF-007: notification status is tracked correctly", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			// Send confirmation email
			await sendBookingConfirmationEmail({
				bookingId,
				recipient: citizenEmail,
				context,
			});

			// Verify status is 'sent'
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			for (const notification of notifications) {
				expect(["pending", "sent", "failed"].includes(notification.status)).toBe(true);
			}

			const sentNotification = notifications.find(
				(n) => n.templateKey === "booking-confirmation",
			);
			expect(sentNotification?.status).toBe("sent");
			expect(sentNotification?.sentAt).toBeDefined();
			expect(sentNotification?.attemptCount).toBe(1);
		});

		test("VAL-NOTIF-009: notification record created for booking events", async () => {
			const { bookingId, citizenEmail, context } = await setupTestData();

			// Simulate all three notification types
			await sendBookingConfirmationEmail({ bookingId, recipient: citizenEmail, context });
			await sendBookingCancellationEmail({ bookingId, recipient: citizenEmail, context });
			await sendHoldExpirationEmail({ bookingId, recipient: citizenEmail, context });

			// Verify all notification records exist
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBe(3);

			const templateKeys = notifications.map((n) => n.templateKey);
			expect(templateKeys).toContain("booking-confirmation");
			expect(templateKeys).toContain("booking-cancellation");
			expect(templateKeys).toContain("booking-hold-expired");
		});
	});

	describe("sendOtpNotification", () => {
		test("VAL-NOTIF-003: OTP notification creates notification_delivery record", async () => {
			const email = `test-${randomUUID()}@example.com`;
			const otp = "123456";

			// Send OTP notification
			await sendOtpNotification({
				email,
				otp,
				type: "sign-in",
			});

			// Verify notification_delivery record was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.recipient, email),
			});

			expect(notifications.length).toBeGreaterThan(0);

			const notification = notifications.find(
				(n) => n.templateKey === "otp-sign-in",
			);
			expect(notification).toBeDefined();
			expect(notification?.recipient).toBe(email);
			expect(notification?.status).toBe("sent");
			expect(notification?.attemptCount).toBe(1);
			expect(notification?.sentAt).toBeDefined();
		});

		test("VAL-NOTIF-003: OTP notification stores OTP in payload", async () => {
			const email = `test-${randomUUID()}@example.com`;
			const otp = "654321";

			await sendOtpNotification({
				email,
				otp,
				type: "sign-in",
			});

			// Verify the OTP is stored in the payload
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.recipient, email),
			});

			const notification = notifications.find(
				(n) => n.templateKey === "otp-sign-in",
			);

			expect(notification?.payload).toBeDefined();
			const payload = notification?.payload as Record<string, unknown>;
			expect(payload.otp).toBe(otp);
		});

		test("VAL-NOTIF-003: OTP notification uses correct template key for each type", async () => {
			const email = `test-${randomUUID()}@example.com`;
			const otp = "111111";

			// Test all OTP types
			await sendOtpNotification({ email, otp, type: "sign-in" });
			await sendOtpNotification({ email, otp, type: "email-verification" });
			await sendOtpNotification({ email, otp, type: "forget-password" });
			await sendOtpNotification({ email, otp, type: "change-email" });

			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.recipient, email),
			});

			expect(notifications.length).toBe(4);

			const templateKeys = notifications.map((n) => n.templateKey);
			expect(templateKeys).toContain("otp-sign-in");
			expect(templateKeys).toContain("otp-email-verification");
			expect(templateKeys).toContain("otp-forget-password");
			expect(templateKeys).toContain("otp-change-email");
		});

		test("VAL-NOTIF-003: OTP notification entityType is 'user'", async () => {
			const email = `test-${randomUUID()}@example.com`;
			const otp = "222222";

			await sendOtpNotification({
				email,
				otp,
				type: "sign-in",
			});

			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.recipient, email),
			});

			const notification = notifications.find(
				(n) => n.templateKey === "otp-sign-in",
			);

			expect(notification?.entityType).toBe("user");
		});
	});
});
