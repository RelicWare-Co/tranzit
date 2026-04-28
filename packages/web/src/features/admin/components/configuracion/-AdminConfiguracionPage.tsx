import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Button,
	Checkbox,
	Grid,
	Group,
	Modal,
	NumberInput,
	Paper,
	rem,
	Select,
	Skeleton,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CalendarX,
	CheckCircle2,
	ChevronRight,
	Clock,
	Edit3,
	Hash,
	Plus,
	RefreshCw,
	Settings,
	Trash2,
	User,
	UserX,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/-AdminPageHeader";
import { getErrorMessage } from "#/features/admin/components/-errors";

const CONFIG_SNAPSHOT_QUERY_KEY = [
	"admin",
	"configuracion",
	"snapshot",
] as const;

const weekdayLabels: Record<number, string> = {
	0: "Domingo",
	1: "Lunes",
	2: "Martes",
	3: "Miércoles",
	4: "Jueves",
	5: "Viernes",
	6: "Sábado",
};

const weekdayColors: Record<number, string> = {
	0: "bg-rose-100 text-rose-700 border-rose-200",
	1: "bg-emerald-100 text-emerald-700 border-emerald-200",
	2: "bg-emerald-100 text-emerald-700 border-emerald-200",
	3: "bg-emerald-100 text-emerald-700 border-emerald-200",
	4: "bg-emerald-100 text-emerald-700 border-emerald-200",
	5: "bg-emerald-100 text-emerald-700 border-emerald-200",
	6: "bg-amber-100 text-amber-700 border-amber-200",
};

async function fetchConfigurationSnapshot() {
	const [templates, overrides, staff] = await Promise.all([
		orpcClient.admin.schedule.templates.list(),
		orpcClient.admin.schedule.overrides.list({}),
		orpcClient.admin.staff.list({}),
	]);

	return { templates, overrides, staff };
}

type ConfigSnapshot = Awaited<ReturnType<typeof fetchConfigurationSnapshot>>;
type ScheduleTemplate = ConfigSnapshot["templates"][number];
type CalendarOverride = ConfigSnapshot["overrides"][number];

async function fetchStaffOverrides(userId: string) {
	return await orpcClient.admin.staff.dateOverrides.list({ userId });
}

type StaffDateOverride = Awaited<
	ReturnType<typeof fetchStaffOverrides>
>[number];

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function validateTime(
	value: string | undefined,
	fieldName: string,
): string | null {
	if (!value || value.trim() === "") return null;
	if (!timeRegex.test(value)) return `${fieldName} debe tener formato HH:MM`;
	return null;
}

function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<Box className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<Box className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 mb-4">
				<Icon
					style={{ width: rem(28), height: rem(28) }}
					className="text-zinc-400"
					strokeWidth={1.5}
				/>
			</Box>
			<Text className="text-base font-semibold text-zinc-900 mb-1">
				{title}
			</Text>
			<Text className="text-sm text-zinc-500 max-w-sm">{description}</Text>
			{action && <Box className="mt-4">{action}</Box>}
		</Box>
	);
}

function StatusBadge({
	active,
	activeLabel = "Activo",
	inactiveLabel = "Inactivo",
}: {
	active: boolean;
	activeLabel?: string;
	inactiveLabel?: string;
}) {
	return (
		<Badge
			variant="light"
			color={active ? "teal" : "gray"}
			radius="sm"
			className="font-medium"
		>
			{active ? (
				<Group gap={4}>
					<Box className="w-1.5 h-1.5 rounded-full bg-teal-500" />
					{activeLabel}
				</Group>
			) : (
				<Group gap={4}>
					<Box className="w-1.5 h-1.5 rounded-full bg-gray-400" />
					{inactiveLabel}
				</Group>
			)}
		</Badge>
	);
}

function SectionCard({
	children,
	title,
	subtitle,
	icon: Icon,
	action,
}: {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
	icon?: React.ElementType;
	action?: React.ReactNode;
}) {
	return (
		<Paper withBorder radius="lg" p="md" shadow="sm">
			<Stack gap="md">
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						{Icon && (
							<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
								<Icon
									style={{ width: rem(20), height: rem(20) }}
									className="text-red-700"
									strokeWidth={1.75}
								/>
							</Box>
						)}
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-zinc-900"
							>
								{title}
							</Title>
							{subtitle && (
								<Text size="sm" className="text-zinc-500">
									{subtitle}
								</Text>
							)}
						</Stack>
					</Group>
					{action && <Group gap="xs">{action}</Group>}
				</Group>
				{children}
			</Stack>
		</Paper>
	);
}

function TableSkeleton() {
	return (
		<Table.Tr>
			<Table.Td>
				<Skeleton height={20} width={80} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={40} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={40} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={60} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={120} />
			</Table.Td>
			<Table.Td>
				<Skeleton height={20} width={60} />
			</Table.Td>
			<Table.Td>
				<Group gap={8}>
					<Skeleton height={28} width={60} />
					<Skeleton height={28} width={60} />
				</Group>
			</Table.Td>
		</Table.Tr>
	);
}

export function AdminConfiguracionPage() {
	const queryClient = useQueryClient();
	const [
		deleteModalOpened,
		{ open: openDeleteModal, close: closeDeleteModal },
	] = useDisclosure(false);
	const [itemToDelete, setItemToDelete] = useState<{
		type: "template" | "override" | "staffOverride";
		id: string;
		name: string;
	} | null>(null);

	const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(
		null,
	);

	const templateForm = useForm({
		initialValues: {
			id: "",
			weekday: 1,
			slotDurationMinutes: 20,
			bufferMinutes: 0,
			slotCapacityLimit: undefined as number | undefined,
			isEnabled: true,
			morningStart: "",
			morningEnd: "",
			afternoonStart: "",
			afternoonEnd: "",
			notes: "",
		},
		validate: {
			weekday: (value) =>
				value < 0 || value > 6 ? "Día inválido (0-6)" : null,
			slotDurationMinutes: (value) =>
				value < 5 || value > 240 ? "Debe estar entre 5 y 240 min" : null,
			bufferMinutes: (value) =>
				value < 0 || value > 60 ? "Debe estar entre 0 y 60 min" : null,
			slotCapacityLimit: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			morningStart: (value) => validateTime(value, "Hora inicio mañana"),
			morningEnd: (value) => validateTime(value, "Hora fin mañana"),
			afternoonStart: (value) => validateTime(value, "Hora inicio tarde"),
			afternoonEnd: (value) => validateTime(value, "Hora fin tarde"),
		},
	});

	const overrideForm = useForm({
		initialValues: {
			id: "",
			overrideDate: "",
			isClosed: false,
			morningEnabled: true,
			afternoonEnabled: true,
			morningStart: "",
			morningEnd: "",
			afternoonStart: "",
			afternoonEnd: "",
			slotDurationMinutes: undefined as number | undefined,
			bufferMinutes: undefined as number | undefined,
			slotCapacityLimit: undefined as number | undefined,
			reason: "",
		},
		validate: {
			overrideDate: (value) => (!value ? "La fecha es obligatoria" : null),
			slotDurationMinutes: (value) =>
				value !== undefined && value < 5 ? "Mínimo 5 minutos" : null,
			bufferMinutes: (value) =>
				value !== undefined && value < 0 ? "No puede ser negativo" : null,
			slotCapacityLimit: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			morningStart: (value) => validateTime(value, "Inicio mañana"),
			morningEnd: (value) => validateTime(value, "Fin mañana"),
			afternoonStart: (value) => validateTime(value, "Inicio tarde"),
			afternoonEnd: (value) => validateTime(value, "Fin tarde"),
		},
	});

	const slotGenerationForm = useForm({
		initialValues: {
			dateFrom: "",
			dateTo: "",
			maxDays: 31,
		},
		validate: {
			dateFrom: (value) => (!value ? "Fecha inicial requerida" : null),
			dateTo: (value) => (!value ? "Fecha final requerida" : null),
			maxDays: (value) =>
				value < 1 || value > 365 ? "Debe estar entre 1 y 365" : null,
		},
	});

	const staffOverrideForm = useForm({
		initialValues: {
			overrideId: "",
			overrideDate: "",
			isAvailable: true,
			capacityOverride: undefined as number | undefined,
			availableStartTime: "",
			availableEndTime: "",
			notes: "",
		},
		validate: {
			overrideDate: (value) => (!value ? "La fecha es obligatoria" : null),
			capacityOverride: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			availableStartTime: (value) => validateTime(value, "Hora inicio"),
			availableEndTime: (value) => validateTime(value, "Hora fin"),
		},
	});

	const [availabilityDate, setAvailabilityDate] = useState("");
	const [availabilityResult, setAvailabilityResult] = useState<unknown | null>(
		null,
	);
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

	const snapshotQuery = useQuery({
		queryKey: CONFIG_SNAPSHOT_QUERY_KEY,
		queryFn: fetchConfigurationSnapshot,
	});

	const staffOverridesQuery = useQuery({
		queryKey: [
			"admin",
			"configuracion",
			"staff-overrides",
			selectedStaffUserId,
		],
		enabled: Boolean(selectedStaffUserId),
		queryFn: async () => await fetchStaffOverrides(selectedStaffUserId ?? ""),
	});

	const refreshAll = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: CONFIG_SNAPSHOT_QUERY_KEY }),
			queryClient.invalidateQueries({
				queryKey: [
					"admin",
					"configuracion",
					"staff-overrides",
					selectedStaffUserId,
				],
			}),
		]);
	}, [queryClient, selectedStaffUserId]);

	const staffOptions = useMemo(
		() =>
			(snapshotQuery.data?.staff ?? []).map((staff) => ({
				value: staff.userId,
				label: staff.user?.name || staff.user?.email || staff.userId,
			})),
		[snapshotQuery.data?.staff],
	);

	const isEditingTemplate = !!templateForm.values.id;
	const isEditingOverride = !!overrideForm.values.id;
	const isEditingStaffOverride = !!staffOverrideForm.values.overrideId;

	const resetTemplateForm = () => {
		templateForm.reset();
	};

	const resetOverrideForm = () => {
		overrideForm.reset();
	};

	const resetStaffOverrideForm = () => {
		staffOverrideForm.reset();
	};

	const submitTemplate = async () => {
		const validation = templateForm.validate();
		if (validation.hasErrors) {
			notifications.show({
				title: "Formulario incompleto",
				message: "Por favor revisa los campos marcados en rojo",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		const values = templateForm.values;

		try {
			const payload = {
				weekday: values.weekday,
				slotDurationMinutes: values.slotDurationMinutes,
				bufferMinutes: values.bufferMinutes,
				slotCapacityLimit: values.slotCapacityLimit ?? null,
				isEnabled: values.isEnabled,
				morningStart: values.morningStart || null,
				morningEnd: values.morningEnd || null,
				afternoonStart: values.afternoonStart || null,
				afternoonEnd: values.afternoonEnd || null,
				notes: values.notes || null,
			};

			if (values.id) {
				await orpcClient.admin.schedule.templates.update({
					id: values.id,
					...payload,
				});
				notifications.show({
					title: "Template actualizado",
					message: "La configuración del día ha sido actualizada correctamente",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			} else {
				await orpcClient.admin.schedule.templates.create(payload);
				notifications.show({
					title: "Template creado",
					message: "Nueva configuración de agenda guardada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			}

			resetTemplateForm();
			await refreshAll();
		} catch (error) {
			notifications.show({
				title: "Error al guardar",
				message: getErrorMessage(error, "No se pudo guardar el template"),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		}
	};

	const editTemplate = (template: ScheduleTemplate) => {
		templateForm.setValues({
			id: template.id,
			weekday: template.weekday,
			slotDurationMinutes: template.slotDurationMinutes,
			bufferMinutes: template.bufferMinutes,
			slotCapacityLimit:
				template.slotCapacityLimit === null
					? undefined
					: template.slotCapacityLimit,
			isEnabled: template.isEnabled,
			morningStart: template.morningStart ?? "",
			morningEnd: template.morningEnd ?? "",
			afternoonStart: template.afternoonStart ?? "",
			afternoonEnd: template.afternoonEnd ?? "",
			notes: template.notes ?? "",
		});
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const confirmDelete = (
		type: "template" | "override" | "staffOverride",
		id: string,
		name: string,
	) => {
		setItemToDelete({ type, id, name });
		openDeleteModal();
	};

	const executeDelete = async () => {
		if (!itemToDelete) return;

		const { type, id } = itemToDelete;

		try {
			if (type === "template") {
				await orpcClient.admin.schedule.templates.remove({ id });
				if (templateForm.values.id === id) {
					resetTemplateForm();
				}
				notifications.show({
					title: "Template eliminado",
					message: "La configuración ha sido eliminada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			} else if (type === "override") {
				await orpcClient.admin.schedule.overrides.remove({ id });
				if (overrideForm.values.id === id) {
					resetOverrideForm();
				}
				notifications.show({
					title: "Override eliminado",
					message: "La excepción de calendario ha sido eliminada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			} else if (type === "staffOverride" && selectedStaffUserId) {
				await orpcClient.admin.staff.dateOverrides.remove({
					userId: selectedStaffUserId,
					overrideId: id,
				});
				if (staffOverrideForm.values.overrideId === id) {
					resetStaffOverrideForm();
				}
				notifications.show({
					title: "Override eliminado",
					message: "La excepción del funcionario ha sido eliminada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			}

			await refreshAll();
			closeDeleteModal();
		} catch (error) {
			notifications.show({
				title: "Error al eliminar",
				message: getErrorMessage(error, "No se pudo eliminar el elemento"),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		}
	};

	const submitOverride = async () => {
		const validation = overrideForm.validate();
		if (validation.hasErrors) {
			notifications.show({
				title: "Formulario incompleto",
				message: "Por favor revisa los campos marcados en rojo",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		const values = overrideForm.values;

		try {
			const payload = {
				overrideDate: values.overrideDate,
				isClosed: values.isClosed,
				morningEnabled: values.morningEnabled,
				afternoonEnabled: values.afternoonEnabled,
				morningStart: values.morningStart || null,
				morningEnd: values.morningEnd || null,
				afternoonStart: values.afternoonStart || null,
				afternoonEnd: values.afternoonEnd || null,
				slotDurationMinutes: values.slotDurationMinutes ?? null,
				bufferMinutes: values.bufferMinutes ?? null,
				slotCapacityLimit: values.slotCapacityLimit ?? null,
				reason: values.reason || null,
			};

			if (values.id) {
				await orpcClient.admin.schedule.overrides.update({
					id: values.id,
					...payload,
				});
				notifications.show({
					title: "Override actualizado",
					message: "La excepción de calendario ha sido actualizada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			} else {
				await orpcClient.admin.schedule.overrides.create(payload);
				notifications.show({
					title: "Override creado",
					message: "Nueva excepción de calendario guardada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			}

			resetOverrideForm();
			await refreshAll();
		} catch (error) {
			notifications.show({
				title: "Error al guardar",
				message: getErrorMessage(error, "No se pudo guardar el override"),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		}
	};

	const editOverride = (override: CalendarOverride) => {
		overrideForm.setValues({
			id: override.id,
			overrideDate: override.overrideDate,
			isClosed: override.isClosed,
			morningEnabled: override.morningEnabled,
			afternoonEnabled: override.afternoonEnabled,
			morningStart: override.morningStart ?? "",
			morningEnd: override.morningEnd ?? "",
			afternoonStart: override.afternoonStart ?? "",
			afternoonEnd: override.afternoonEnd ?? "",
			slotDurationMinutes: override.slotDurationMinutes ?? undefined,
			bufferMinutes: override.bufferMinutes ?? undefined,
			slotCapacityLimit: override.slotCapacityLimit ?? undefined,
			reason: override.reason ?? "",
		});
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const generateSlots = async () => {
		const validation = slotGenerationForm.validate();
		if (validation.hasErrors) {
			notifications.show({
				title: "Formulario incompleto",
				message: "Por favor revisa las fechas ingresadas",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		const values = slotGenerationForm.values;

		try {
			const response = await orpcClient.admin.schedule.slots.generate({
				dateFrom: values.dateFrom,
				dateTo: values.dateTo,
				maxDays: values.maxDays,
			});

			const result = response as {
				generated?: number;
				errors?: string[];
			};

			notifications.show({
				title: "Slots generados",
				message: `${result.generated || 0} slots creados correctamente`,
				color: "teal",
				icon: <CheckCircle2 size={16} />,
			});

			await refreshAll();
		} catch (error) {
			notifications.show({
				title: "Error al generar",
				message: getErrorMessage(error, "No se pudieron generar los slots"),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		}
	};

	const submitStaffOverride = async () => {
		if (!selectedStaffUserId) {
			notifications.show({
				title: "Funcionario requerido",
				message: "Selecciona un funcionario primero",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		const validation = staffOverrideForm.validate();
		if (validation.hasErrors) {
			notifications.show({
				title: "Formulario incompleto",
				message: "Por favor revisa los campos marcados en rojo",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		const values = staffOverrideForm.values;

		try {
			const payload = {
				overrideDate: values.overrideDate,
				isAvailable: values.isAvailable,
				capacityOverride: values.capacityOverride,
				availableStartTime: values.availableStartTime || null,
				availableEndTime: values.availableEndTime || null,
				notes: values.notes || null,
			};

			if (values.overrideId) {
				await orpcClient.admin.staff.dateOverrides.update({
					userId: selectedStaffUserId,
					overrideId: values.overrideId,
					...payload,
				});
				notifications.show({
					title: "Disponibilidad actualizada",
					message: "La excepción del funcionario ha sido actualizada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			} else {
				await orpcClient.admin.staff.dateOverrides.create({
					userId: selectedStaffUserId,
					...payload,
				});
				notifications.show({
					title: "Disponibilidad creada",
					message: "Nueva excepción de funcionario guardada",
					color: "teal",
					icon: <CheckCircle2 size={16} />,
				});
			}

			resetStaffOverrideForm();
			await refreshAll();
		} catch (error) {
			notifications.show({
				title: "Error al guardar",
				message: getErrorMessage(error, "No se pudo guardar la disponibilidad"),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		}
	};

	const editStaffOverride = (override: StaffDateOverride) => {
		staffOverrideForm.setValues({
			overrideId: override.id,
			overrideDate: override.overrideDate,
			isAvailable: override.isAvailable,
			capacityOverride: override.capacityOverride ?? undefined,
			availableStartTime: override.availableStartTime ?? "",
			availableEndTime: override.availableEndTime ?? "",
			notes: override.notes ?? "",
		});
	};

	const checkEffectiveAvailability = async () => {
		if (!selectedStaffUserId || !availabilityDate) {
			notifications.show({
				title: "Datos incompletos",
				message: "Selecciona funcionario y fecha para consultar",
				color: "red",
				icon: <AlertCircle size={16} />,
			});
			return;
		}

		setIsCheckingAvailability(true);
		setAvailabilityResult(null);

		try {
			const response = await orpcClient.admin.staff.effectiveAvailability({
				userId: selectedStaffUserId,
				date: availabilityDate,
			});
			setAvailabilityResult(response);
		} catch (error) {
			notifications.show({
				title: "Error al consultar",
				message: getErrorMessage(
					error,
					"No se pudo consultar la disponibilidad",
				),
				color: "red",
				icon: <AlertCircle size={16} />,
			});
		} finally {
			setIsCheckingAvailability(false);
		}
	};

	const selectedStaff = useMemo(
		() =>
			snapshotQuery.data?.staff.find((s) => s.userId === selectedStaffUserId),
		[snapshotQuery.data?.staff, selectedStaffUserId],
	);

	return (
		<Stack gap="xl" className="max-w-[1600px] mx-auto pb-12">
			<AdminPageHeader
				title="Configuración operativa"
				description="Gestiona templates de agenda, excepciones de calendario y disponibilidad de funcionarios"
				actions={
					<Button
						leftSection={<RefreshCw size={16} />}
						onClick={() => void refreshAll()}
						variant="light"
						className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						Refrescar
					</Button>
				}
			/>

			{snapshotQuery.isError && (
				<Alert
					color="red"
					icon={<AlertCircle size={18} />}
					className="rounded-xl border border-red-200"
				>
					<Text className="font-medium">
						{getErrorMessage(
							snapshotQuery.error,
							"No se pudo cargar la configuración",
						)}
					</Text>
				</Alert>
			)}

			<SectionCard
				title="Templates de agenda"
				subtitle="Define horarios base por día de la semana"
				icon={Clock}
				action={
					isEditingTemplate && (
						<Button
							variant="subtle"
							size="sm"
							onClick={resetTemplateForm}
							leftSection={<Plus size={14} />}
						>
							Nuevo template
						</Button>
					)
				}
			>
				<Stack gap="lg">
					<Paper
						withBorder
						className={`p-5 rounded-xl border-zinc-200/60 ${isEditingTemplate ? "bg-amber-50/30 border-amber-200/60" : "bg-zinc-50/50"}`}
					>
						{isEditingTemplate && (
							<Group gap={6} className="mb-4">
								<Badge color="amber" variant="light" radius="sm">
									<Edit3 size={12} className="mr-1" />
									Editando template
								</Badge>
							</Group>
						)}
						<Grid>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<Select
									label="Día de la semana"
									placeholder="Selecciona"
									data={Object.entries(weekdayLabels).map(([value, label]) => ({
										value,
										label,
									}))}
									{...templateForm.getInputProps("weekday")}
									rightSection={<ChevronRight size={14} />}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<NumberInput
									label="Duración del slot (min)"
									placeholder="20"
									min={5}
									max={240}
									{...templateForm.getInputProps("slotDurationMinutes")}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<NumberInput
									label="Buffer (min)"
									placeholder="0"
									min={0}
									max={60}
									{...templateForm.getInputProps("bufferMinutes")}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<NumberInput
									label="Capacidad máxima"
									placeholder="Ilimitada"
									min={1}
									{...templateForm.getInputProps("slotCapacityLimit")}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Inicio mañana"
									{...templateForm.getInputProps("morningStart")}
									error={templateForm.errors.morningStart}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Fin mañana"
									{...templateForm.getInputProps("morningEnd")}
									error={templateForm.errors.morningEnd}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Inicio tarde"
									{...templateForm.getInputProps("afternoonStart")}
									error={templateForm.errors.afternoonStart}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Fin tarde"
									{...templateForm.getInputProps("afternoonEnd")}
									error={templateForm.errors.afternoonEnd}
								/>
							</Grid.Col>
							<Grid.Col span={12}>
								<TextInput
									label="Notas"
									placeholder="Notas opcionales sobre este template..."
									{...templateForm.getInputProps("notes")}
								/>
							</Grid.Col>
							<Grid.Col span={12}>
								<Group justify="space-between" align="center">
									<Checkbox
										label="Habilitado"
										description="Activar este template"
										{...templateForm.getInputProps("isEnabled", {
											type: "checkbox",
										})}
									/>
									<Group>
										{isEditingTemplate && (
											<Button variant="default" onClick={resetTemplateForm}>
												Cancelar
											</Button>
										)}
										<Button
											onClick={() => void submitTemplate()}
											leftSection={
												isEditingTemplate ? (
													<Edit3 size={16} />
												) : (
													<Plus size={16} />
												)
											}
										>
											{isEditingTemplate ? "Actualizar" : "Crear template"}
										</Button>
									</Group>
								</Group>
							</Grid.Col>
						</Grid>
					</Paper>

					<Box>
						<Text className="text-sm font-semibold text-zinc-900 mb-3">
							Templates configurados
						</Text>
						<Table.ScrollContainer minWidth={780}>
							<Table
								withTableBorder
								withColumnBorders
								className="border-zinc-200"
								styles={{
									thead: { backgroundColor: "#f9fafb" },
								}}
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Día
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Duración
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Buffer
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Capacidad
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Horarios
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Estado
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Acciones
										</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{snapshotQuery.isLoading ? (
										<>
											<TableSkeleton />
											<TableSkeleton />
											<TableSkeleton />
										</>
									) : snapshotQuery.data?.templates.length === 0 ? (
										<Table.Tr>
											<Table.Td colSpan={7}>
												<EmptyState
													icon={Settings}
													title="Sin templates"
													description="Crea tu primer template de agenda para comenzar"
												/>
											</Table.Td>
										</Table.Tr>
									) : (
										snapshotQuery.data?.templates.map((template) => (
											<Table.Tr
												key={template.id}
												className="hover:bg-zinc-50/80 transition-colors"
											>
												<Table.Td>
													<Badge
														className={`${weekdayColors[template.weekday]} border font-medium`}
														radius="sm"
													>
														{weekdayLabels[template.weekday]}
													</Badge>
												</Table.Td>
												<Table.Td className="text-sm">
													{template.slotDurationMinutes} min
												</Table.Td>
												<Table.Td className="text-sm">
													{template.bufferMinutes} min
												</Table.Td>
												<Table.Td className="text-sm">
													{template.slotCapacityLimit ?? (
														<span className="text-zinc-400 italic">
															Ilimitada
														</span>
													)}
												</Table.Td>
												<Table.Td className="text-sm">
													<Group gap={8}>
														{template.morningStart && template.morningEnd && (
															<Badge
																variant="light"
																color="blue"
																radius="sm"
																size="sm"
															>
																{template.morningStart} - {template.morningEnd}
															</Badge>
														)}
														{template.afternoonStart &&
															template.afternoonEnd && (
																<Badge
																	variant="light"
																	color="orange"
																	radius="sm"
																	size="sm"
																>
																	{template.afternoonStart} -{" "}
																	{template.afternoonEnd}
																</Badge>
															)}
													</Group>
												</Table.Td>
												<Table.Td>
													<StatusBadge active={template.isEnabled} />
												</Table.Td>
												<Table.Td>
													<Group gap={6}>
														<Tooltip label="Editar">
															<ActionIcon
																variant="light"
																color="blue"
																onClick={() => editTemplate(template)}
																className="transition-transform duration-150 hover:scale-110"
															>
																<Edit3 size={16} />
															</ActionIcon>
														</Tooltip>
														<Tooltip label="Eliminar">
															<ActionIcon
																variant="light"
																color="red"
																onClick={() =>
																	confirmDelete(
																		"template",
																		template.id,
																		weekdayLabels[template.weekday],
																	)
																}
																className="transition-transform duration-150 hover:scale-110"
															>
																<Trash2 size={16} />
															</ActionIcon>
														</Tooltip>
													</Group>
												</Table.Td>
											</Table.Tr>
										))
									)}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					</Box>
				</Stack>
			</SectionCard>

			<SectionCard
				title="Excepciones de calendario"
				subtitle="Define días especiales que anulan los templates"
				icon={CalendarX}
				action={
					isEditingOverride && (
						<Button
							variant="subtle"
							size="sm"
							onClick={resetOverrideForm}
							leftSection={<Plus size={14} />}
						>
							Nueva excepción
						</Button>
					)
				}
			>
				<Stack gap="lg">
					<Paper
						withBorder
						className={`p-5 rounded-xl border-zinc-200/60 ${isEditingOverride ? "bg-amber-50/30 border-amber-200/60" : "bg-zinc-50/50"}`}
					>
						{isEditingOverride && (
							<Group gap={6} className="mb-4">
								<Badge color="amber" variant="light" radius="sm">
									<Edit3 size={12} className="mr-1" />
									Editando excepción
								</Badge>
							</Group>
						)}
						<Grid>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<DatePickerInput
									label="Fecha"
									placeholder="Selecciona una fecha"
									locale="es"
									valueFormat="DD/MM/YYYY"
									clearable
									value={
										overrideForm.values.overrideDate
											? new Date(overrideForm.values.overrideDate)
											: null
									}
									onChange={(value) => {
										const formatted = value
											? value.toString().split("T")[0]
											: "";
										overrideForm.setFieldValue("overrideDate", formatted);
									}}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<NumberInput
									label="Duración slot (min)"
									placeholder="Usar default"
									min={5}
									{...overrideForm.getInputProps("slotDurationMinutes")}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<NumberInput
									label="Capacidad"
									placeholder="Usar default"
									min={1}
									{...overrideForm.getInputProps("slotCapacityLimit")}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Inicio mañana"
									{...overrideForm.getInputProps("morningStart")}
									error={overrideForm.errors.morningStart}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Fin mañana"
									{...overrideForm.getInputProps("morningEnd")}
									error={overrideForm.errors.morningEnd}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Inicio tarde"
									{...overrideForm.getInputProps("afternoonStart")}
									error={overrideForm.errors.afternoonStart}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
								<TimeInput
									label="Fin tarde"
									{...overrideForm.getInputProps("afternoonEnd")}
									error={overrideForm.errors.afternoonEnd}
								/>
							</Grid.Col>
							<Grid.Col span={12}>
								<TextInput
									label="Razón / descripción"
									placeholder="Ej: Feriado, Mantenimiento, etc."
									{...overrideForm.getInputProps("reason")}
								/>
							</Grid.Col>
							<Grid.Col span={12}>
								<Group>
									<Checkbox
										label="Día cerrado"
										description="No habilitar slots este día"
										{...overrideForm.getInputProps("isClosed", {
											type: "checkbox",
										})}
									/>
									<Checkbox
										label="Mañana habilitada"
										{...overrideForm.getInputProps("morningEnabled", {
											type: "checkbox",
										})}
										disabled={overrideForm.values.isClosed}
									/>
									<Checkbox
										label="Tarde habilitada"
										{...overrideForm.getInputProps("afternoonEnabled", {
											type: "checkbox",
										})}
										disabled={overrideForm.values.isClosed}
									/>
								</Group>
							</Grid.Col>
							<Grid.Col span={12}>
								<Group justify="flex-end">
									{isEditingOverride && (
										<Button variant="default" onClick={resetOverrideForm}>
											Cancelar
										</Button>
									)}
									<Button
										onClick={() => void submitOverride()}
										leftSection={
											isEditingOverride ? (
												<Edit3 size={16} />
											) : (
												<Plus size={16} />
											)
										}
									>
										{isEditingOverride ? "Actualizar" : "Crear excepción"}
									</Button>
								</Group>
							</Grid.Col>
						</Grid>
					</Paper>

					<Box>
						<Text className="text-sm font-semibold text-zinc-900 mb-3">
							Excepciones configuradas
						</Text>
						<Table.ScrollContainer minWidth={780}>
							<Table
								withTableBorder
								withColumnBorders
								className="border-zinc-200"
								styles={{
									thead: { backgroundColor: "#f9fafb" },
								}}
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Fecha
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Estado
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Duración
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Capacidad
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Razón
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Acciones
										</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{snapshotQuery.isLoading ? (
										<>
											<TableSkeleton />
											<TableSkeleton />
										</>
									) : snapshotQuery.data?.overrides.length === 0 ? (
										<Table.Tr>
											<Table.Td colSpan={6}>
												<EmptyState
													icon={CalendarX}
													title="Sin excepciones"
													description="No hay excepciones de calendario configuradas"
												/>
											</Table.Td>
										</Table.Tr>
									) : (
										snapshotQuery.data?.overrides.map((override) => (
											<Table.Tr
												key={override.id}
												className="hover:bg-zinc-50/80 transition-colors"
											>
												<Table.Td className="font-medium">
													{new Date(override.overrideDate).toLocaleDateString(
														"es-CO",
														{
															weekday: "short",
															day: "numeric",
															month: "short",
														},
													)}
												</Table.Td>
												<Table.Td>
													{override.isClosed ? (
														<Badge color="red" variant="light" radius="sm">
															Cerrado
														</Badge>
													) : (
														<Badge color="emerald" variant="light" radius="sm">
															Abierto
														</Badge>
													)}
												</Table.Td>
												<Table.Td className="text-sm">
													{override.slotDurationMinutes ? (
														`${override.slotDurationMinutes} min`
													) : (
														<span className="text-zinc-400">Default</span>
													)}
												</Table.Td>
												<Table.Td className="text-sm">
													{override.slotCapacityLimit ?? (
														<span className="text-zinc-400">Default</span>
													)}
												</Table.Td>
												<Table.Td className="text-sm max-w-xs truncate">
													{override.reason || (
														<span className="text-zinc-400 italic">
															Sin descripción
														</span>
													)}
												</Table.Td>
												<Table.Td>
													<Group gap={6}>
														<Tooltip label="Editar">
															<ActionIcon
																variant="light"
																color="blue"
																onClick={() => editOverride(override)}
																className="transition-transform duration-150 hover:scale-110"
															>
																<Edit3 size={16} />
															</ActionIcon>
														</Tooltip>
														<Tooltip label="Eliminar">
															<ActionIcon
																variant="light"
																color="red"
																onClick={() =>
																	confirmDelete(
																		"override",
																		override.id,
																		new Date(
																			override.overrideDate,
																		).toLocaleDateString("es-CO"),
																	)
																}
																className="transition-transform duration-150 hover:scale-110"
															>
																<Trash2 size={16} />
															</ActionIcon>
														</Tooltip>
													</Group>
												</Table.Td>
											</Table.Tr>
										))
									)}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					</Box>
				</Stack>
			</SectionCard>

			<SectionCard
				title="Generación de slots"
				subtitle="Crea slots disponibles para reservas en un rango de fechas"
				icon={Hash}
			>
				<Stack gap="md">
					<Grid>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<DatePickerInput
								label="Fecha inicial"
								placeholder="Selecciona fecha inicial"
								locale="es"
								valueFormat="YYYY-MM-DD"
								clearable
								value={slotGenerationForm.values.dateFrom || null}
								onChange={(value) => {
									slotGenerationForm.setFieldValue("dateFrom", value || "");
								}}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<DatePickerInput
								label="Fecha final"
								placeholder="Selecciona fecha final"
								locale="es"
								valueFormat="YYYY-MM-DD"
								clearable
								value={slotGenerationForm.values.dateTo || null}
								onChange={(value) => {
									slotGenerationForm.setFieldValue("dateTo", value || "");
								}}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<NumberInput
								label="Máximo de días"
								min={1}
								max={365}
								{...slotGenerationForm.getInputProps("maxDays")}
							/>
						</Grid.Col>
					</Grid>
					<Group justify="flex-end">
						<Button
							onClick={() => void generateSlots()}
							leftSection={<Hash size={16} />}
						>
							Generar slots
						</Button>
					</Group>
				</Stack>
			</SectionCard>

			<SectionCard
				title="Disponibilidad por funcionario"
				subtitle="Gestiona excepciones individuales y consulta disponibilidad efectiva"
				icon={User}
			>
				<Stack gap="lg">
					<Select
						label="Funcionario"
						placeholder="Selecciona un funcionario"
						value={selectedStaffUserId}
						onChange={setSelectedStaffUserId}
						data={staffOptions}
						rightSection={<ChevronRight size={14} />}
						className="max-w-md"
					/>

					{selectedStaffUserId ? (
						<>
							<Paper
								withBorder
								className={`p-5 rounded-xl border-zinc-200/60 ${isEditingStaffOverride ? "bg-amber-50/30 border-amber-200/60" : "bg-zinc-50/50"}`}
							>
								{isEditingStaffOverride && (
									<Group gap={6} className="mb-4">
										<Badge color="amber" variant="light" radius="sm">
											<Edit3 size={12} className="mr-1" />
											Editando disponibilidad
										</Badge>
									</Group>
								)}
								<Grid>
									<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
										<DatePickerInput
											label="Fecha de excepción"
											placeholder="Selecciona una fecha"
											locale="es"
											valueFormat="YYYY-MM-DD"
											clearable
											value={staffOverrideForm.values.overrideDate || null}
											onChange={(value) => {
												staffOverrideForm.setFieldValue(
													"overrideDate",
													value || "",
												);
											}}
										/>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
										<NumberInput
											label="Capacidad override"
											placeholder="Sin límite"
											min={1}
											{...staffOverrideForm.getInputProps("capacityOverride")}
										/>
									</Grid.Col>
									<Grid.Col
										span={{ base: 12, sm: 6, md: 4 }}
										className="flex items-center"
									>
										<Checkbox
											label="Disponible este día"
											description="Desmarca para bloquear"
											{...staffOverrideForm.getInputProps("isAvailable", {
												type: "checkbox",
											})}
										/>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
										<TimeInput
											label="Hora inicio disponible"
											{...staffOverrideForm.getInputProps("availableStartTime")}
											error={staffOverrideForm.errors.availableStartTime}
										/>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
										<TimeInput
											label="Hora fin disponible"
											{...staffOverrideForm.getInputProps("availableEndTime")}
											error={staffOverrideForm.errors.availableEndTime}
										/>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
										<TextInput
											label="Notas"
											placeholder="Vacaciones, incapacidad, etc."
											{...staffOverrideForm.getInputProps("notes")}
										/>
									</Grid.Col>
									<Grid.Col span={12}>
										<Group justify="flex-end">
											{isEditingStaffOverride && (
												<Button
													variant="default"
													onClick={resetStaffOverrideForm}
												>
													Cancelar
												</Button>
											)}
											<Button
												onClick={() => void submitStaffOverride()}
												leftSection={
													isEditingStaffOverride ? (
														<Edit3 size={16} />
													) : (
														<Plus size={16} />
													)
												}
											>
												{isEditingStaffOverride
													? "Actualizar"
													: "Crear excepción"}
											</Button>
										</Group>
									</Grid.Col>
								</Grid>
							</Paper>

							<Box>
								<Text className="text-sm font-semibold text-zinc-900 mb-3">
									Excepciones de {selectedStaff?.user?.name || "funcionario"}
								</Text>
								<Table.ScrollContainer minWidth={780}>
									<Table
										withTableBorder
										withColumnBorders
										className="border-zinc-200"
										styles={{
											thead: { backgroundColor: "#f8fafc" },
										}}
									>
										<Table.Thead>
											<Table.Tr>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Fecha
												</Table.Th>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Disponible
												</Table.Th>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Capacidad
												</Table.Th>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Horario
												</Table.Th>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Notas
												</Table.Th>
												<Table.Th className="text-xs font-semibold text-zinc-600">
													Acciones
												</Table.Th>
											</Table.Tr>
										</Table.Thead>
										<Table.Tbody>
											{staffOverridesQuery.isLoading ? (
												<>
													<TableSkeleton />
													<TableSkeleton />
												</>
											) : staffOverridesQuery.data?.length === 0 ? (
												<Table.Tr>
													<Table.Td colSpan={6}>
														<EmptyState
															icon={UserX}
															title="Sin excepciones"
															description={`${selectedStaff?.user?.name || "Este funcionario"} no tiene excepciones de disponibilidad`}
														/>
													</Table.Td>
												</Table.Tr>
											) : (
												staffOverridesQuery.data?.map((override) => (
													<Table.Tr
														key={override.id}
														className="hover:bg-zinc-50/80 transition-colors"
													>
														<Table.Td className="font-medium">
															{new Date(
																override.overrideDate,
															).toLocaleDateString("es-CO", {
																weekday: "short",
																day: "numeric",
																month: "short",
															})}
														</Table.Td>
														<Table.Td>
															<StatusBadge
																active={override.isAvailable}
																activeLabel="Sí"
																inactiveLabel="No"
															/>
														</Table.Td>
														<Table.Td className="text-sm">
															{override.capacityOverride ?? (
																<span className="text-zinc-400">
																	Sin límite
																</span>
															)}
														</Table.Td>
														<Table.Td className="text-sm">
															{override.availableStartTime &&
															override.availableEndTime ? (
																<Badge
																	variant="light"
																	color="blue"
																	radius="sm"
																	size="sm"
																>
																	{override.availableStartTime} -{" "}
																	{override.availableEndTime}
																</Badge>
															) : (
																<span className="text-zinc-400 italic">
																	Horario completo
																</span>
															)}
														</Table.Td>
														<Table.Td className="text-sm max-w-xs truncate">
															{override.notes || (
																<span className="text-zinc-400 italic">
																	Sin notas
																</span>
															)}
														</Table.Td>
														<Table.Td>
															<Group gap={6}>
																<Tooltip label="Editar">
																	<ActionIcon
																		variant="light"
																		color="blue"
																		onClick={() => editStaffOverride(override)}
																		className="transition-transform duration-150 hover:scale-110"
																	>
																		<Edit3 size={16} />
																	</ActionIcon>
																</Tooltip>
																<Tooltip label="Eliminar">
																	<ActionIcon
																		variant="light"
																		color="red"
																		onClick={() =>
																			confirmDelete(
																				"staffOverride",
																				override.id,
																				new Date(
																					override.overrideDate,
																				).toLocaleDateString("es-CO"),
																			)
																		}
																		className="transition-transform duration-150 hover:scale-110"
																	>
																		<Trash2 size={16} />
																	</ActionIcon>
																</Tooltip>
															</Group>
														</Table.Td>
													</Table.Tr>
												))
											)}
										</Table.Tbody>
									</Table>
								</Table.ScrollContainer>
							</Box>

							<Paper withBorder className="p-5 rounded-xl border-zinc-200/60">
								<Text className="text-sm font-semibold text-zinc-900 mb-4">
									Consultar disponibilidad efectiva
								</Text>
								<Group align="flex-end">
									<DatePickerInput
										label="Fecha a consultar"
										placeholder="Selecciona fecha"
										locale="es"
										valueFormat="YYYY-MM-DD"
										clearable
										value={availabilityDate || null}
										onChange={(value) => setAvailabilityDate(value || "")}
									/>
									<Button
										onClick={() => void checkEffectiveAvailability()}
										loading={isCheckingAvailability}
										variant="light"
									>
										Consultar
									</Button>
								</Group>

								{availabilityResult !== null && (
									<Paper
										withBorder
										className="mt-4 p-4 rounded-lg border-zinc-200 bg-zinc-50/50"
									>
										<Text
											component="pre"
											className="text-xs text-slate-700 font-mono whitespace-pre-wrap"
										>
											{JSON.stringify(availabilityResult as object, null, 2)}
										</Text>
									</Paper>
								)}
							</Paper>
						</>
					) : (
						<EmptyState
							icon={User}
							title="Selecciona un funcionario"
							description="Elige un funcionario de la lista para gestionar su disponibilidad"
						/>
					)}
				</Stack>
			</SectionCard>

			<Modal
				opened={deleteModalOpened}
				onClose={closeDeleteModal}
				title="Confirmar eliminación"
				centered
				size="sm"
			>
				<Stack>
					<Alert color="red" icon={<AlertCircle size={18} />}>
						¿Estás seguro de eliminar <strong>{itemToDelete?.name}</strong>?
						<br />
						Esta acción no se puede deshacer.
					</Alert>
					<Group justify="flex-end">
						<Button variant="default" onClick={closeDeleteModal}>
							Cancelar
						</Button>
						<Button color="red" onClick={() => void executeDelete()}>
							Eliminar
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	);
}
