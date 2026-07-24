import path from "node:path";
import { createClient } from "@libsql/client/node";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "../db/schema";
import { resolveTestDatabase, SERVER_ROOT } from "./test-database";

loadEnv({ path: path.resolve(SERVER_ROOT, "../../.env") });

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const url = isTest ? resolveTestDatabase().url : process.env.TURSO_DATABASE_URL;

if (!url) {
	throw new Error("Missing TURSO_DATABASE_URL in environment variables.");
}

const authToken = isTest
	? undefined
	: process.env.TURSO_AUTH_TOKEN || undefined;

export const client = createClient({
	url,
	authToken,
});

export const db = drizzle({
	client,
	schema,
});

export { schema };
