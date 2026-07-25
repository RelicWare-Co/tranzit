import {
	Badge,
	EmptyState,
	Skeleton,
	Table,
	UnstyledButton,
} from "@mantine/core";
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
	ArrowUp,
	ArrowUpDown,
	CalendarSearch,
	Check,
} from "lucide-react";
import { useMemo, useState } from "react";
import classes from "../Reportes.module.css";

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
	request?: {
		email?: string | null;
		procedureType?: {
			name?: string | null;
		} | null;
		citizen?: {
			name?: string | null;
			email?: string | null;
		} | null;
	} | null;
}

interface BookingTableProps {
	bookings: Booking[];
	selectedBookingId: string | null;
	onSelectBooking: (id: string) => void;
	isLoading: boolean;
}

const STATUS_CONFIG: Record<
	string,
	{ label: string; color: string; description: string }
> = {
	confirmed: {
		label: "Confirmada",
		color: "teal",
		description: "Consume capacidad",
	},
	held: {
		label: "Hold temporal",
		color: "yellow",
		description: "Pendiente de confirmar",
	},
	cancelled: {
		label: "Cancelada",
		color: "gray",
		description: "No consume capacidad",
	},
	expired: {
		label: "Expirada",
		color: "gray",
		description: "No consume capacidad",
	},
	attended: {
		label: "Atendida",
		color: "blue",
		description: "Atención registrada",
	},
};

const columnHelper = createColumnHelper<Booking>();

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
	if (isSorted === "asc") return <ArrowUp size={13} aria-hidden="true" />;
	if (isSorted === "desc") return <ArrowDown size={13} aria-hidden="true" />;
	return (
		<ArrowUpDown size={13} className={classes.sortIcon} aria-hidden="true" />
	);
}

export function BookingTable({
	bookings,
	selectedBookingId,
	onSelectBooking,
	isLoading,
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
					return (
						<span
							className={classes.selectionMark}
							data-selected={isSelected || undefined}
							aria-hidden="true"
						>
							<Check size={13} />
						</span>
					);
				},
			}),
			columnHelper.accessor((row) => row.slot?.slotDate ?? "", {
				id: "slotDate",
				header: "Fecha y hora",
				size: 190,
				cell: ({ row }) => (
					<div className={classes.primaryCell}>
						<span className={classes.primaryValue}>
							{row.original.slot?.slotDate || "Fecha no disponible"}
						</span>
						<span className={classes.secondaryValue}>
							{row.original.slot?.startTime && row.original.slot?.endTime
								? `${row.original.slot.startTime} – ${row.original.slot.endTime}`
								: "Horario no disponible"}
						</span>
					</div>
				),
			}),
			columnHelper.accessor(
				(row) => row.request?.procedureType?.name ?? "Reserva administrativa",
				{
					id: "procedure",
					header: "Trámite y ciudadano",
					size: 240,
					cell: ({ row }) => (
						<div className={classes.primaryCell}>
							<span className={classes.primaryValue}>
								{row.original.request?.procedureType?.name ??
									"Reserva administrativa"}
							</span>
							<span className={classes.secondaryValue}>
								{row.original.request?.citizen?.name ||
									row.original.request?.citizen?.email ||
									row.original.request?.email ||
									"Sin ciudadano asociado"}
							</span>
						</div>
					),
				},
			),
			columnHelper.accessor(
				(row) => row.staff?.name || row.staff?.email || "Sin asignar",
				{
					id: "staff",
					header: "Funcionario",
					size: 180,
					cell: (info) => info.getValue(),
				},
			),
			columnHelper.accessor("status", {
				header: "Estado",
				size: 155,
				cell: ({ row }) => {
					const config = STATUS_CONFIG[row.original.status] ?? {
						label: row.original.status,
						color: "gray",
						description: row.original.isActive
							? "Consume capacidad"
							: "No consume capacidad",
					};
					return (
						<div className={classes.primaryCell}>
							<Badge color={config.color} variant="light" size="sm" radius="sm">
								{config.label}
							</Badge>
							<span className={classes.secondaryValue}>
								{config.description}
							</span>
						</div>
					);
				},
			}),
			columnHelper.accessor("id", {
				header: "Referencia",
				size: 110,
				cell: (info) => (
					<span className={classes.reference}>
						{info.getValue().slice(0, 8)}
					</span>
				),
			}),
		],
		[selectedBookingId],
	);

	const table = useReactTable({
		data: bookings,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (isLoading) {
		return (
			<div className={classes.tableFrame}>
				<div
					className={classes.loadingState}
					role="status"
					aria-label="Cargando citas"
				>
					<div className={classes.loadingRows}>
						<Skeleton height={34} radius="sm" />
						<Skeleton height={54} radius="sm" />
						<Skeleton height={54} radius="sm" />
						<Skeleton height={54} radius="sm" />
						<Skeleton height={54} radius="sm" />
					</div>
				</div>
			</div>
		);
	}

	if (bookings.length === 0) {
		return (
			<div className={classes.tableFrame}>
				<div className={classes.emptyState}>
					<EmptyState
						icon={<CalendarSearch size={30} />}
						title="No hay citas en esta consulta"
						description="Ajusta el rango de fechas o restablece los filtros para ampliar los resultados."
						size="sm"
						withIndicatorBackground
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={classes.tableFrame}>
			<Table.ScrollContainer minWidth={880} type="native">
				<Table className={classes.table} withRowBorders={false}>
					<Table.Thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<Table.Tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const canSort = header.column.getCanSort();
									return (
										<Table.Th
											key={header.id}
											style={{ width: header.getSize() }}
										>
											{canSort ? (
												<UnstyledButton
													className={classes.sortButton}
													onClick={header.column.getToggleSortingHandler()}
													aria-label={`Ordenar por ${String(
														header.column.columnDef.header,
													)}`}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													<SortIcon isSorted={header.column.getIsSorted()} />
												</UnstyledButton>
											) : (
												flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)
											)}
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
									className={classes.tableRow}
									data-selected={isSelected || undefined}
									aria-selected={isSelected}
									tabIndex={0}
									onClick={() => onSelectBooking(row.original.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectBooking(row.original.id);
										}
									}}
								>
									{row.getVisibleCells().map((cell) => (
										<Table.Td key={cell.id}>
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
		</div>
	);
}
