export function getErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (err && typeof err === "object" && "message" in err) {
		const message = (err as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

export function isUniqueConstraintError(err: unknown): boolean {
	const message = getErrorMessage(err).toLowerCase();
	return (
		message.includes("sqlite_constraint") &&
		message.includes("unique constraint")
	);
}

export function slotFitsWindow(
	slotStartTime: string,
	slotEndTime: string,
	windowStart: string,
	windowEnd: string,
): boolean {
	return slotStartTime >= windowStart && slotEndTime <= windowEnd;
}
