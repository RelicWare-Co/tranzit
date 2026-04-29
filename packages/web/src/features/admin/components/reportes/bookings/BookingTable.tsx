import { Badge, Box, Button, Menu, Table, Text } from "@mantine/core";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowDownUp,
	ArrowUp,
	ArrowUpDown,
	Calendar,
	Check,
	CheckCircle2,
	MoreVertical,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";

interface Booking {
	id: string;
	status: string;
	isActive: boolean;
	slotId: string;
	slot?: {
		slotDate?: string;
		startTime?: string;
		endTime?: string;
	} | null;
	staff?: {
		name?: string | null;
		email?: string | null;
	} | null;
}

interface BookingTableProps {
	bookings: Booking[];
	selectedBookingId: string | null;
	onSelectBooking: (id: string) => void;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	releaseReason: "cancelled" | "expired" | "attended";
	reassignTargetStaffId: string;
}

function getStatusBadgeProps(status: string) {
	const normalized = status.toLowerCase();
	if (normalized === "confirmed")
		return { color: "teal", variant: "light" as const };
	if (normalized === "held" || normalized === "pending")
		return { color: "yellow", variant: "light" as const };
	if (normalized === "cancelled")
		return { color: "red", variant: "light" as const };
	return { color: "gray", variant: "light" as const };
}

const columnHelper = createColumnHelper<Booking>();

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
	if (isSorted === "asc") return <ArrowUp size={12} className="text-red-600" />;
	if (isSorted === "desc")
		return <ArrowDown size={12} className="text-red-600" />;
	return (
		<ArrowUpDown
			size={12}
			className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-50 transition-opacity"
		/>
	);
}

export function BookingTable({
	bookings,
	selectedBookingId,
	onSelectBooking,
	runAction,
	releaseReason,
	reassignTargetStaffId,
}: BookingTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "slotDate", desc: false },
	]);

	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "select",
				header: "",
				size: 48,
				cell: ({ row }) => {
					const isSelected = row.original.id === selectedBookingId;
					return isSelected ? (
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600">
							<Check size={14} className="text-white" strokeWidth={2.5} />
						</div>
					) : (
						<div className="h-6 w-6 rounded-full border-2 border-[var(--border-subtle)]" />
					);
				},
			}),
			columnHelper.accessor("id", {
				header: "ID",
				size: 100,
				cell: (info) => (
					<span className="font-mono text-xs text-[var(--text-secondary)]">
						{info.getValue().slice(0, 8)}…
					</span>
				),
			}),
			columnHelper.accessor((row) => row.slot?.slotDate ?? "", {
				id: "slotDate",
				header: "Fecha",
				size: 120,
				cell: (info) =>
					info.getValue() || (
						<span className="text-[var(--text-secondary)]">-</span>
					),
			}),
			columnHelper.accessor(
				(row) =>
					row.slot?.startTime && row.slot?.endTime
						? `${row.slot.startTime} – ${row.slot.endTime}`
						: "",
				{
					id: "time",
					header: "Hora",
					size: 140,
					cell: (info) =>
						info.getValue() || (
							<span className="text-[var(--text-secondary)]">--</span>
						),
				},
			),
			columnHelper.accessor("status", {
				header: "Estado",
				size: 120,
				cell: (info) => (
					<Badge
						{...getStatusBadgeProps(info.getValue())}
						size="sm"
						radius="sm"
					>
						{info.getValue()}
					</Badge>
				),
			}),
			columnHelper.accessor("isActive", {
				header: "Activo",
				size: 100,
				cell: (info) =>
					info.getValue() ? (
						<Badge color="teal" variant="light" size="sm" radius="sm">
							Activo
						</Badge>
					) : (
						<Badge color="gray" variant="light" size="sm" radius="sm">
							Inactivo
						</Badge>
					),
			}),
			columnHelper.accessor(
				(row) => row.staff?.name || row.staff?.email || "",
				{
					id: "staff",
					header: "Staff",
					size: 180,
					cell: (info) =>
						info.getValue() || (
							<span className="text-[var(--text-secondary)]">Sin asignar</span>
						),
				},
			),
			columnHelper.display({
				id: "actions",
				header: "",
				size: 56,
				cell: ({ row }) => (
					<Menu position="bottom-end">
						<Menu.Target>
							<Button
								variant="subtle"
								size="xs"
								p={0}
								onClick={(e) => e.stopPropagation()}
							>
								<MoreVertical size={14} />
							</Button>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								leftSection={<CheckCircle2 size={14} />}
								onClick={() =>
									void runAction(
										"booking-confirm",
										async () =>
											await orpcClient.admin.bookings.confirm({
												id: row.original.id,
											}),
										"Cita confirmada.",
										"No se pudo confirmar la cita.",
									)
								}
							>
								Confirmar
							</Menu.Item>
							<Menu.Item
								leftSection={<ArrowDownUp size={14} />}
								onClick={() => {
									if (!reassignTargetStaffId) return;
									void runAction(
										"booking-reassign",
										async () =>
											await orpcClient.admin.bookings.reassign({
												id: row.original.id,
												targetStaffUserId: reassignTargetStaffId,
											}),
										"Cita reasignada.",
										"No se pudo reasignar la cita.",
									);
								}}
							>
								Reasignar
							</Menu.Item>
							<Menu.Divider />
							<Menu.Item
								color="red"
								leftSection={<XCircle size={14} />}
								onClick={() =>
									void runAction(
										"booking-release",
										async () =>
											await orpcClient.admin.bookings.release({
												id: row.original.id,
												reason: releaseReason,
											}),
										"Cita liberada.",
										"No se pudo liberar la cita.",
									)
								}
							>
								Liberar
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				),
			}),
		],
		[selectedBookingId, releaseReason, reassignTargetStaffId, runAction],
	);

	const table = useReactTable({
		data: bookings,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (bookings.length === 0) {
		return (
			<div className={`${adminUi.surfaceMuted} text-center py-12`}>
				<div className="flex flex-col items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
						<Calendar size={22} className="text-zinc-400" strokeWidth={1.5} />
					</div>
					<Text className="text-base font-semibold text-[var(--text-primary)]">
						No hay citas para mostrar
					</Text>
					<Text
						size="sm"
						className="max-w-sm leading-relaxed text-[var(--text-secondary)]"
					>
						No se encontraron citas con los filtros actuales. Ajustá los filtros
						o creá una nueva cita.
					</Text>
				</div>
			</div>
		);
	}

	return (
		<Box>
			<Table.ScrollContainer minWidth={900}>
				<Table
					highlightOnHover
					highlightOnHoverColor="var(--neutral-50)"
					withRowBorders
					borderColor="var(--border-subtle)"
					verticalSpacing="sm"
					horizontalSpacing="md"
					stripedColor="var(--bg-primary)"
					striped="odd"
					className="rounded-xl overflow-hidden"
				>
					<Table.Thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<Table.Tr
								key={headerGroup.id}
								className="bg-[var(--bg-secondary)]"
							>
								{headerGroup.headers.map((header) => {
									const canSort = header.column.getCanSort();
									return (
										<Table.Th
											key={header.id}
											className={
												canSort
													? `${adminUi.tableHeader} cursor-pointer select-none group`
													: adminUi.tableHeader
											}
											onClick={
												canSort
													? header.column.getToggleSortingHandler()
													: undefined
											}
											style={{ width: header.getSize() }}
										>
											<div className="flex items-center gap-1.5">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{canSort && (
													<SortIcon isSorted={header.column.getIsSorted()} />
												)}
											</div>
										</Table.Th>
									);
								})}
							</Table.Tr>
						))}
					</Table.Thead>
					<Table.Tbody>
						{table.getRowModel().rows.map((row) => {
							const isSelected = row.original.id === selectedBookingId;
							return (
								<Table.Tr
									key={row.id}
									className={
										isSelected
											? "bg-red-50/60 cursor-pointer transition-colors"
											: "cursor-pointer transition-colors"
									}
									onClick={() => onSelectBooking(row.original.id)}
								>
									{row.getVisibleCells().map((cell) => (
										<Table.Td key={cell.id} className={adminUi.tableCell}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</Table.Td>
									))}
								</Table.Tr>
							);
						})}
					</Table.Tbody>
				</Table>
			</Table.ScrollContainer>
		</Box>
	);
}
