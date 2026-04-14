import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";

const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyCheckResult =
	| {
			exists: true;
			response?: { status: number; body: unknown };
			conflict?: boolean;
	  }
	| { exists: false };

export function parseBooleanLike(value: unknown): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

export function hashPayload(payload: unknown): string {
	const value =
		payload && typeof payload === "object" ? payload : { value: payload };
	const normalized = JSON.stringify(
		value,
		Object.keys(value as Record<string, unknown>).sort(),
	);
	return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function parseIdempotencyKey(
	header: string | null | undefined,
): string | null {
	if (!header) return null;
	if (header.length < 8 || header.length > 128) return null;
	if (!/^[a-zA-Z0-9-]+$/.test(header)) return null;
	return header;
}

export async function checkIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
): Promise<IdempotencyCheckResult> {
	const now = new Date();
	const existing = await db.query.idempotencyKey.findFirst({
		where: eq(schema.idempotencyKey.key, key),
	});

	if (!existing) {
		return { exists: false };
	}

	if (existing.expiresAt && existing.expiresAt < now) {
		await db
			.delete(schema.idempotencyKey)
			.where(eq(schema.idempotencyKey.id, existing.id));
		return { exists: false };
	}

	if (existing.operation !== operation || existing.targetId !== targetId) {
		return { exists: true, conflict: true };
	}

	if (existing.payloadHash !== payloadHash) {
		return { exists: true, conflict: true };
	}

	return {
		exists: true,
		response: {
			status: existing.responseStatus,
			body: existing.responseBody,
		},
	};
}

export async function storeIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
	responseStatus: number,
	responseBody: unknown,
): Promise<void> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + IDEMPOTENCY_KEY_TTL_MS);

	await db
		.delete(schema.idempotencyKey)
		.where(eq(schema.idempotencyKey.key, key));

	await db.insert(schema.idempotencyKey).values({
		id: crypto.randomUUID(),
		key,
		operation,
		targetId,
		payloadHash,
		responseStatus,
		responseBody: (responseBody ?? {}) as Record<string, unknown>,
		createdAt: now,
		expiresAt,
	});
}
