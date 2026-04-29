export function buildDuplicateSlug(
	baseSlug: string,
	existing: Set<string>,
): string {
	let next = `${baseSlug}-copia`;
	let index = 2;
	while (existing.has(next)) {
		next = `${baseSlug}-copia-${index}`;
		index += 1;
	}
	return next;
}

export function sanitizeSlug(slug: string): string {
	return slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function generateSlugFromName(name: string): string {
	return sanitizeSlug(
		name
			.toLowerCase()
			.replace(/[áàäâ]/g, "a")
			.replace(/[éèëê]/g, "e")
			.replace(/[íìïî]/g, "i")
			.replace(/[óòöô]/g, "o")
			.replace(/[úùüû]/g, "u")
			.replace(/[ñ]/g, "n")
			.replace(/[^a-z0-9\s-]/g, ""),
	);
}

export function generateId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
