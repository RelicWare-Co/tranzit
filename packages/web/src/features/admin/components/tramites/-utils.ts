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
