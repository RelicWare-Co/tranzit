import { createClient } from "@libsql/client/node";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "../db/schema";

loadEnv({ path: "../../.env" });

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
	throw new Error("Missing TURSO_DATABASE_URL in environment variables.");
}

const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const client = createClient({
	url,
	authToken,
});

export const db = drizzle({
	client,
	schema,
});

export { schema };
