import { config as loadEnv } from "dotenv";

import { defineConfig } from "drizzle-kit";

loadEnv({ path: "../.env" });

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "turso",
	dbCredentials: {
		url: process.env.TURSO_DATABASE_URL as string,
	},
});
