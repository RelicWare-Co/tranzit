import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./lib/db";

// Ensure schema migrations are applied on the test database
const migrationsFolder = path.resolve(__dirname, "../drizzle");
await migrate(db, { migrationsFolder });
