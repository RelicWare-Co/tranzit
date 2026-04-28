import { z } from "zod";

// Validaciones alineadas con staff.router.ts
// - defaultDailyCapacity: entero positivo (>= 1)
// El backend valida: Number.isInteger(capacity) && capacity > 0

export const staffCreateSchema = z.object({
	name: z
		.string()
		.transform((val) => val.trim())
		.pipe(
			z
				.string()
				.min(1, "El nombre es obligatorio")
				.max(100, "El nombre no puede exceder 100 caracteres"),
		),
	email: z
		.string()
		.transform((val) => val.trim().toLowerCase())
		.pipe(
			z
				.string()
				.min(1, "El correo electrónico es obligatorio")
				.email("Ingresa un correo electrónico válido")
				.max(255, "El correo no puede exceder 255 caracteres"),
		),
	capacity: z
		.number()
		.int("La capacidad debe ser un número entero")
		.min(1, "La capacidad debe ser al menos 1"),
	// No hay máximo definido en el backend, pero podemos poner un límite práctico
});

export type StaffCreateFormValues = z.infer<typeof staffCreateSchema>;
