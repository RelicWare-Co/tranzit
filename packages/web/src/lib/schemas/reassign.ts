import { z } from "zod";

// Alineado con MAX_BATCH_SIZE en backend (bookings-reassign.service.ts)
export const MAX_REASSIGNMENTS_BATCH_SIZE = 100;

export const reassignBookingsSchema = z.object({
	targetStaffUserId: z
		.string()
		.transform((value) => value.trim())
		.pipe(z.string().min(1, "Debes seleccionar un encargado destino")),
	bookingCount: z
		.number()
		.int("La cantidad debe ser un número entero")
		.min(1, "Debes mover al menos 1 cita")
		.max(
			MAX_REASSIGNMENTS_BATCH_SIZE,
			`La cantidad máxima es ${MAX_REASSIGNMENTS_BATCH_SIZE}`,
		),
});

export type ReassignBookingsFormValues = z.infer<typeof reassignBookingsSchema>;
