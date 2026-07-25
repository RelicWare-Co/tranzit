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
	CalendarRange,
	Check,
} from "lucide-react";
import { useMemo, useState } from "react";
import classes from "../Reportes.module.css";
import type { ReservationInstance } from "../types";

interface InstanceTableProps {
	instances: ReservationInstance[];
	selectedInstanceId: string | null;
	onSelectInstance: (id: string) => void;
	isLoading: boolean;
}

const columnHelper = createColumnHelper<ReservationInstance>();

const STATUS_LABELS: Record<string, string> = {
	confirmed: "Confirmada",
	held: "Hold temporal",
	pending: "Pendiente",
	cancelled: "Cancelada",
	expired: "Expirada",
	attended: "Atendida",
};

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
	if (isSorted === "asc") return <ArrowUp size={13} aria-hidden="true" />;
	if (isSorted === "desc") return <ArrowDown size={13} aria-hidden="true" />;
	return (
		<ArrowUpDown size={13} className={classes.sortIcon} aria-hidden="true" />
	);
}

export function InstanceTable({
	instances,
	selectedInstanceId,
	onSelectInstance,
	isLoading,
}: InstanceTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "slotDate", desc: false },
	]);

	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "select",
				header: "",
				size: 44,
				cell: ({ row }) => {
					const isSelected = row.original.id === selectedInstanceId;
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
							{row.original.slot?.slotDate || "Sin fecha"}
						</span>
						<span className={classes.secondaryValue}>
							{row.original.slot?.startTime && row.original.slot?.endTime
								? `${row.original.slot.startTime} – ${row.original.slot.endTime}`
								: "Sin horario"}
						</span>
					</div>
				),
			}),
			columnHelper.accessor("status", {
				header: "Estado",
				size: 130,
				cell: (info) => (
					<Badge
						color={info.row.original.isActive ? "teal" : "gray"}
						variant="light"
						size="sm"
						radius="sm"
					>
						{STATUS_LABELS[info.getValue()] ?? info.getValue()}
					</Badge>
				),
			}),
			columnHelper.accessor("staffUserId", {
				header: "Funcionario",
				size: 170,
				cell: (info) => (
					<span className={classes.reference}>
						{info.getValue()?.slice(0, 12) ?? "Sin asignar"}
					</span>
				),
			}),
			columnHelper.accessor("notes", {
				header: "Notas",
				size: 190,
				cell: (info) => (
					<span className={classes.secondaryValue}>
						{info.getValue() || "Sin notas"}
					</span>
				),
			}),
		],
		[selectedInstanceId],
	);

	const table = useReactTable({
		data: instances,
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
					aria-label="Cargando instancias"
				>
					<div className={classes.loadingRows}>
						<Skeleton height={34} radius="sm" />
						<Skeleton height={54} radius="sm" />
						<Skeleton height={54} radius="sm" />
					</div>
				</div>
			</div>
		);
	}

	if (instances.length === 0) {
		return (
			<div className={classes.tableFrame}>
				<div className={classes.emptyState}>
					<EmptyState
						icon={<CalendarRange size={28} />}
						title="Esta serie no tiene instancias activas"
						description="Las instancias aparecerán aquí cuando existan reservas vigentes asociadas."
						size="sm"
						withIndicatorBackground
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={classes.tableFrame}>
			<Table.ScrollContainer minWidth={720} type="native">
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
							const isSelected = row.original.id === selectedInstanceId;
							return (
								<Table.Tr
									key={row.id}
									className={classes.tableRow}
									data-selected={isSelected || undefined}
									aria-selected={isSelected}
									tabIndex={0}
									onClick={() => onSelectInstance(row.original.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectInstance(row.original.id);
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
