import {
	Alert,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Skeleton,
	Stack,
	Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AlertCircle, CheckCircle2, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../../../lib/auth-client";
import { orpcClient } from "../../../lib/orpc-client";
import { AdminPageHeader } from "../_shared/AdminPageHeader";
import { adminUi } from "../_shared/admin-ui";
import { formatDateLocal } from "../_shared/dates";
import { getErrorMessage } from "../_shared/errors";
import { AddStaffModal } from "./AddStaffModal";
import { mapBookingsByStaff } from "./booking-utils";
import { ReassignModal } from "./ReassignModal";
import { StaffCard } from "./StaffCard";
import { StaffDetailEmptyState, StaffDetailPanel } from "./StaffDetailPanel";
import type { BookingByStaff, CreateStaffPayload, StaffProfile } from "./types";

export function UsuariosPage() {
	const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
	const [staffList, setStaffList] = useState<StaffProfile[]>([]);
	const [bookingsByStaff, setBookingsByStaff] = useState<BookingByStaff>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isUpdating, setIsUpdating] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [reassignModalOpened, { open: openReassign, close: closeReassign }] =
		useDisclosure(false);
	const [addModalOpened, { open: openAdd, close: closeAdd }] =
		useDisclosure(false);

	const loadData = useCallback(async () => {
		const today = formatDateLocal(new Date());
		const [staff, bookings] = await Promise.all([
			orpcClient.admin.staff.list({}),
			orpcClient.admin.bookings.list({
				isActive: true,
				dateFrom: today,
				dateTo: today,
			}),
		]);

		setStaffList(staff);
		setBookingsByStaff(mapBookingsByStaff(bookings));
		setSelectedStaffId((current) => {
			if (current && staff.some((item) => item.userId === current)) {
				return current;
			}
			return staff[0]?.userId ?? null;
		});
	}, []);

	useEffect(() => {
		let mounted = true;
		setIsLoading(true);
		setError(null);
		void loadData()
			.catch((loadError) => {
				if (!mounted) return;
				setError(
					getErrorMessage(
						loadError,
						"No se pudo cargar la gestión de usuarios.",
					),
				);
			})
			.finally(() => {
				if (mounted) {
					setIsLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, [loadData]);

	const selectedStaff = useMemo(
		() => staffList.find((staff) => staff.userId === selectedStaffId) ?? null,
		[staffList, selectedStaffId],
	);

	const selectedBookings = selectedStaff
		? bookingsByStaff[selectedStaff.userId] || []
		: [];

	const assignableStaff = staffList.filter(
		(staff) => staff.isActive && staff.isAssignable,
	);
	const totalDailyCapacity = assignableStaff.reduce(
		(total, staff) => total + staff.defaultDailyCapacity,
		0,
	);

	const refreshData = async () => {
		setError(null);
		await loadData();
	};

	const handleCreateStaff = async (payload: CreateStaffPayload) => {
		setError(null);
		setNotice(null);

		const createUserResult = await authClient.admin.createUser({
			email: payload.email,
			name: payload.name,
			role: "staff",
		});

		if (createUserResult.error) {
			throw new Error(createUserResult.error.message);
		}

		const createdUserId =
			(createUserResult.data as { user?: { id?: string } } | null)?.user?.id ??
			null;

		if (!createdUserId) {
			throw new Error("No se pudo obtener el usuario creado.");
		}

		await orpcClient.admin.staff.create({
			userId: createdUserId,
			defaultDailyCapacity: payload.capacity,
			isActive: true,
			isAssignable: true,
		});

		await refreshData();
		setNotice("Encargado creado correctamente.");
	};

	const handleToggleStaffState = (
		staff: StaffProfile,
		field: "isActive" | "isAssignable",
		nextValue: boolean,
	) => {
		void (async () => {
			setIsUpdating(staff.userId);
			setError(null);
			setNotice(null);
			try {
				await orpcClient.admin.staff.update({
					userId: staff.userId,
					[field]: nextValue,
				});
				await refreshData();
			} catch (updateError) {
				setError(
					getErrorMessage(updateError, "No se pudo actualizar el encargado."),
				);
			} finally {
				setIsUpdating(null);
			}
		})();
	};

	const handleRemoveStaff = async (staff: StaffProfile) => {
		if (
			!window.confirm(
				`¿Eliminar perfil operativo de ${staff.user?.name || staff.userId}?`,
			)
		) {
			return;
		}

		setIsUpdating(staff.userId);
		setError(null);
		setNotice(null);
		try {
			await orpcClient.admin.staff.remove({ userId: staff.userId });
			await refreshData();
			setNotice("Perfil operativo eliminado.");
		} catch (removeError) {
			setError(
				getErrorMessage(removeError, "No se pudo eliminar el encargado."),
			);
		} finally {
			setIsUpdating(null);
		}
	};

	const handleReassign = async (
		targetStaffUserId: string,
		bookingCount: number,
	) => {
		if (!selectedStaff) {
			throw new Error("No hay encargado seleccionado.");
		}

		const reassignments = selectedBookings
			.slice(0, bookingCount)
			.map((booking) => ({
				bookingId: booking.id,
				targetStaffUserId,
			}));

		if (reassignments.length === 0) {
			throw new Error("No hay citas para mover.");
		}

		const preview = await orpcClient.admin.bookings.reassignmentsPreview({
			reassignments,
		});
		await orpcClient.admin.bookings.reassignmentsApply({
			reassignments,
			previewToken: preview.previewToken,
			executionMode: "best_effort",
		});

		await refreshData();
		setNotice("Reasignación completada.");
	};

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Skeleton height={40} width="min(100%, 380px)" radius="md" mb="xs" />
				<Skeleton height={220} radius="xl" />
			</Stack>
		);
	}

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Gestión de encargados"
				description="Administrá auxiliares, disponibilidad y reasignación de citas con límites de capacidad por día."
				actions={
					<Button
						color="red"
						onClick={openAdd}
						radius="md"
						leftSection={<Plus size={18} strokeWidth={1.75} />}
						className="font-semibold"
					>
						Nuevo encargado
					</Button>
				}
			/>

			{error && (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{error}
				</Alert>
			)}
			{notice && (
				<Alert color="teal" icon={<CheckCircle2 size={16} />}>
					{notice}
				</Alert>
			)}

			{assignableStaff.length > 0 ? (
				<Card className={adminUi.callout} radius="xl" p="lg" shadow="none">
					<Group gap="md" align="flex-start">
						<Box className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-zinc-200/90">
							<Users size={20} className="text-red-700" strokeWidth={1.75} />
						</Box>
						<Stack gap={4}>
							<Text className="text-lg font-semibold text-zinc-900">
								Capacidad distribuida
							</Text>
							<Text size="sm" className="leading-relaxed text-zinc-600">
								<span className="font-mono tabular-nums font-semibold text-zinc-800">
									{assignableStaff.length}
								</span>{" "}
								encargados activos. Cupo combinado:{" "}
								<span className="font-mono tabular-nums font-semibold text-zinc-800">
									{totalDailyCapacity}
								</span>{" "}
								citas por día.
							</Text>
						</Stack>
					</Group>
				</Card>
			) : null}

			{staffList.length === 0 ? (
				<Card
					className={`${adminUi.surface} text-center`}
					radius="xl"
					p={48}
					shadow="none"
				>
					<Stack align="center" gap="lg">
						<Box className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/90">
							<Users size={26} className="text-zinc-500" strokeWidth={1.5} />
						</Box>
						<Text className="text-lg font-semibold text-zinc-900">
							No hay encargados registrados
						</Text>
						<Button
							color="red"
							onClick={openAdd}
							radius="md"
							leftSection={<Plus size={18} strokeWidth={1.75} />}
							className="font-semibold"
						>
							Crear primer encargado
						</Button>
					</Stack>
				</Card>
			) : (
				<Grid gap="xl">
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="md">
							{staffList.map((profile) => (
								<StaffCard
									key={profile.userId}
									profile={profile}
									isSelected={selectedStaffId === profile.userId}
									onClick={() => setSelectedStaffId(profile.userId)}
									currentBookings={bookingsByStaff[profile.userId]?.length || 0}
								/>
							))}
						</Stack>
					</Grid.Col>

					<Grid.Col span={{ base: 12, md: 7 }}>
						{selectedStaff ? (
							<StaffDetailPanel
								selectedStaff={selectedStaff}
								selectedBookings={selectedBookings}
								isStaffUpdating={isUpdating === selectedStaff.userId}
								onToggleStaffState={handleToggleStaffState}
								onRemoveStaff={handleRemoveStaff}
								onOpenReassign={openReassign}
							/>
						) : (
							<StaffDetailEmptyState />
						)}
					</Grid.Col>
				</Grid>
			)}

			<ReassignModal
				opened={reassignModalOpened}
				onClose={closeReassign}
				staffList={staffList}
				sourceStaff={selectedStaff}
				sourceBookings={selectedBookings}
				onReassign={handleReassign}
			/>

			<AddStaffModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateStaff}
			/>
		</Stack>
	);
}
