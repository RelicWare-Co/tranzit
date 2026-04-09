import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { db, schema } from "./db";

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
  throw new Error("Missing BETTER_AUTH_SECRET in environment variables.");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
  },
});
