import { notifications } from "@mantine/notifications";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { getErrorMessage } from "#/features/admin/components/errors";

interface UseConfigMutationsOptions {
	onSuccess?: () => void | Promise<void>;
}

export function useConfigMutations(options?: UseConfigMutationsOptions) {
	const handleSuccess = useCallback(
		async (title: string, message: string) => {
			notifications.show({
				title,
				message,
				color: "teal",
				icon: <CheckCircle2 size={16} />,
			});
			await options?.onSuccess?.();
		},
		[options],
	);

	const handleError = useCallback(
		(error: unknown, title: string, fallback: string) => {
			notifications.show({
				title,
				message: getErrorMessage(error, fallback),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		},
		[],
	);

	// Template mutations
	const createTemplate = useCallback(
		async (payload: Parameters<typeof orpcClient.admin.schedule.templates.create>[0]) => {
			try {
				await orpcClient.admin.schedule.templates.create(payload);
				await handleSuccess(
					"Template creado",
					"Nueva configuración de agenda guardada",
				);
			} catch (error) {
				handleError(error, "Error al guardar", "No se pudo guardar el template");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const updateTemplate = useCallback(
		async (
			id: string,
			payload: Omit<Parameters<typeof orpcClient.admin.schedule.templates.update>[0], "id">,
		) => {
			try {
				await orpcClient.admin.schedule.templates.update({ id, ...payload });
				await handleSuccess(
					"Template actualizado",
					"La configuración del día ha sido actualizada correctamente",
				);
			} catch (error) {
				handleError(error, "Error al guardar", "No se pudo actualizar el template");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const removeTemplate = useCallback(
		async (id: string) => {
			try {
				await orpcClient.admin.schedule.templates.remove({ id });
				await handleSuccess("Template eliminado", "La configuración ha sido eliminada");
			} catch (error) {
				handleError(error, "Error al eliminar", "No se pudo eliminar el template");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	// Override mutations
	const createOverride = useCallback(
		async (payload: Parameters<typeof orpcClient.admin.schedule.overrides.create>[0]) => {
			try {
				await orpcClient.admin.schedule.overrides.create(payload);
				await handleSuccess(
					"Override creado",
					"Nueva excepción de calendario guardada",
				);
			} catch (error) {
				handleError(error, "Error al guardar", "No se pudo guardar el override");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const updateOverride = useCallback(
		async (
			id: string,
			payload: Omit<Parameters<typeof orpcClient.admin.schedule.overrides.update>[0], "id">,
		) => {
			try {
				await orpcClient.admin.schedule.overrides.update({ id, ...payload });
				await handleSuccess(
					"Override actualizado",
					"La excepción de calendario ha sido actualizada",
				);
			} catch (error) {
				handleError(error, "Error al guardar", "No se pudo actualizar el override");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const removeOverride = useCallback(
		async (id: string) => {
			try {
				await orpcClient.admin.schedule.overrides.remove({ id });
				await handleSuccess(
					"Override eliminado",
					"La excepción de calendario ha sido eliminada",
				);
			} catch (error) {
				handleError(error, "Error al eliminar", "No se pudo eliminar el override");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	// Slot generation
	const generateSlots = useCallback(
		async (payload: Parameters<typeof orpcClient.admin.schedule.slots.generate>[0]) => {
			try {
				const response = await orpcClient.admin.schedule.slots.generate(payload);
				const result = response as { generated?: number; errors?: string[] };
				await handleSuccess(
					"Slots generados",
					`${result.generated || 0} slots creados correctamente`,
				);
				return result;
			} catch (error) {
				handleError(error, "Error al generar", "No se pudieron generar los slots");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	// Staff override mutations
	const createStaffOverride = useCallback(
		async (
			userId: string,
			payload: {
				overrideDate: string;
				isAvailable: boolean;
				capacityOverride?: number | undefined;
				availableStartTime?: string | null;
				availableEndTime?: string | null;
				notes?: string | null;
			},
		) => {
			try {
				await orpcClient.admin.staff.dateOverrides.create({ userId, ...payload });
				await handleSuccess(
					"Disponibilidad creada",
					"Nueva excepción de funcionario guardada",
				);
			} catch (error) {
				handleError(error, "Error al guardar", "No se pudo guardar la disponibilidad");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const updateStaffOverride = useCallback(
		async (
			userId: string,
			overrideId: string,
			payload: {
				overrideDate: string;
				isAvailable: boolean;
				capacityOverride?: number | undefined;
				availableStartTime?: string | null;
				availableEndTime?: string | null;
				notes?: string | null;
			},
		) => {
			try {
				await orpcClient.admin.staff.dateOverrides.update({
					userId,
					overrideId,
					...payload,
				});
				await handleSuccess(
					"Disponibilidad actualizada",
					"La excepción del funcionario ha sido actualizada",
				);
			} catch (error) {
				handleError(
					error,
					"Error al guardar",
					"No se pudo actualizar la disponibilidad",
				);
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	const removeStaffOverride = useCallback(
		async (userId: string, overrideId: string) => {
			try {
				await orpcClient.admin.staff.dateOverrides.remove({
					userId,
					overrideId,
				});
				await handleSuccess(
					"Override eliminado",
					"La excepción del funcionario ha sido eliminada",
				);
			} catch (error) {
				handleError(error, "Error al eliminar", "No se pudo eliminar el override");
				throw error;
			}
		},
		[handleSuccess, handleError],
	);

	return {
		createTemplate,
		updateTemplate,
		removeTemplate,
		createOverride,
		updateOverride,
		removeOverride,
		generateSlots,
		createStaffOverride,
		updateStaffOverride,
		removeStaffOverride,
	};
}
