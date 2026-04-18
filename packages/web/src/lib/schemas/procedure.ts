import { z } from "zod";

// Validaciones alineadas con procedures.router.ts
// - name: requerido, trim, no vacío
// - slug: requerido, sanitize (lowercase, trim, reemplaza caracteres inválidos)
// - description: opcional
// - booleans: opcionales con defaults en backend

export function sanitizeProcedureSlug(slug: string): string {
	return slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

export const procedureCreateSchema = z.object({
	name: z
		.string()
		.transform((val) => val.trim())
		.pipe(
			z
				.string()
				.min(1, "El nombre es obligatorio")
				.max(120, "El nombre no puede exceder 120 caracteres"),
		),
	slug: z
		.string()
		.transform((val) => sanitizeProcedureSlug(val))
		.pipe(
			z
				.string()
				.min(1, "El slug no puede quedar vacío después de sanitizar")
				.max(60, "El slug no puede exceder 60 caracteres"),
		),
	description: z
		.string()
		.optional()
		.transform((val) => val?.trim() ?? "")
		.pipe(z.string().max(500, "La descripción no puede exceder 500 caracteres"))
		.transform((val) => (val.length > 0 ? val : undefined)),
	requiresVehicle: z.boolean().default(false),
	allowsPhysicalDocuments: z.boolean().default(true),
	allowsDigitalDocuments: z.boolean().default(false),
});

export type ProcedureCreateFormValues = z.infer<typeof procedureCreateSchema>;
