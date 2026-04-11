/**
 * Seed script to bootstrap the first admin user.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=strongpassword bun run scripts/seed-admin.ts
 *
 * This script should be run once during initial deployment when no admin user exists.
 * It inserts the admin user directly into the database, bypassing the normal auth flow.
 */

import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "@better-auth/utils/password";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
	console.error("Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=strongpassword bun run scripts/seed-admin.ts");
	process.exit(1);
}

// TypeScript needs assurance these are strings after the guard
const email = ADMIN_EMAIL as string;
const password = ADMIN_PASSWORD as string;

async function seedAdmin() {
	// Check if admin already exists
	const existingAdmin = await db.query.user.findFirst({
		where: eq(schema.user.email, email),
	});

	if (existingAdmin) {
		console.log(`User with email ${email} already exists.`);
		
		// Update role to admin if not already
		if (existingAdmin.role !== "admin") {
			await db.update(schema.user)
				.set({ role: "admin" })
				.where(eq(schema.user.id, existingAdmin.id));
			console.log(`Updated user role to admin.`);
		} else {
			console.log(`User already has admin role.`);
		}
		
		return;
	}

	// Hash the password using Better Auth's scrypt hasher
	const passwordHash = await hashPassword(password);

	// Generate a unique ID
	const userId = crypto.randomUUID();

	// Insert the admin user
	await db.insert(schema.user).values({
		id: userId,
		name: "Admin",
		email: email,
		emailVerified: true,
		role: "admin",
		status: "active",
	});

	// Insert the account with hashed password
	// Note: Better Auth's email/password sign-in looks for providerId === "credential"
	await db.insert(schema.account).values({
		id: crypto.randomUUID(),
		accountId: email,
		providerId: "credential",
		userId: userId,
		password: passwordHash,
	});

	console.log(`Admin user created successfully:`);
	console.log(`  Email: ${email}`);
	console.log(`  Role: admin`);
	console.log(`\nYou can now log in at /admin/login with these credentials.`);
}

seedAdmin().catch((error) => {
	console.error("Failed to seed admin user:", error);
	process.exit(1);
});
