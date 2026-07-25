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
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Repeat2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getErrorMessage } from "#/features/admin/components/errors";
import classes from "../Reportes.module.css";

interface SeriesItem {
	id: string;
	isActive: boolean;
	activeInstanceCount?: number | null;
	notes?: string | null;
}

interface SeriesTableProps {
	series: SeriesItem[];
	selectedSeriesId: string | null;
	onSelectSeries: (id: string) => void;
	isLoading: boolean;
	isError: boolean;
	error: unknown;
}

const columnHelper = createColumnHelper<SeriesItem>();

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
	if (isSorted === "asc") return <ArrowUp size={13} aria-hidden="true" />;
	if (isSorted === "desc") return <ArrowDown size={13} aria-hidden="true" />;
	return (
		<ArrowUpDown size={13} className={classes.sortIcon} aria-hidden="true" />
	);
}

export function SeriesTable({
	series,
	selectedSeriesId,
	onSelectSeries,
	isLoading,
	isError,
	error,
}: SeriesTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "select",
				header: "",
				size: 44,
				cell: ({ row }) => {
					const isSelected = row.original.id === selectedSeriesId;
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
			columnHelper.accessor("id", {
				header: "Serie",
				size: 130,
				cell: (info) => (
					<div className={classes.primaryCell}>
						<span className={classes.primaryValue}>
							{info.getValue().slice(0, 8)}
						</span>
						<span className={classes.secondaryValue}>Reserva recurrente</span>
					</div>
				),
			}),
			columnHelper.accessor("activeInstanceCount", {
				header: "Instancias",
				size: 105,
				cell: (info) => info.getValue() ?? 0,
			}),
			columnHelper.accessor("isActive", {
				header: "Estado",
				size: 100,
				cell: (info) => (
					<Badge
						color={info.getValue() ? "teal" : "gray"}
						variant="light"
						size="sm"
						radius="sm"
					>
						{info.getValue() ? "Activa" : "Inactiva"}
					</Badge>
				),
			}),
			columnHelper.accessor("notes", {
				header: "Contexto",
				size: 190,
				cell: (info) => (
					<span className={classes.secondaryValue}>
						{info.getValue() || "Sin notas internas"}
					</span>
				),
			}),
		],
		[selectedSeriesId],
	);

	const table = useReactTable({
		data: series,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (isError) {
		return (
			<div className={classes.emptyState}>
				<EmptyState
					icon={<Repeat2 size={28} />}
					title="No se pudieron cargar las series"
					description={getErrorMessage(error, "Intenta actualizar los datos.")}
					size="sm"
					color="red"
					variant="light"
				/>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div
				className={classes.loadingState}
				role="status"
				aria-label="Cargando series"
			>
				<div className={classes.loadingRows}>
					<Skeleton height={34} radius="sm" />
					<Skeleton height={58} radius="sm" />
					<Skeleton height={58} radius="sm" />
					<Skeleton height={58} radius="sm" />
				</div>
			</div>
		);
	}

	if (series.length === 0) {
		return (
			<div className={classes.emptyState}>
				<EmptyState
					icon={<Repeat2 size={28} />}
					title="No hay series para mostrar"
					description="Cambia el filtro de estado o crea una nueva reserva recurrente."
					size="sm"
					withIndicatorBackground
				/>
			</div>
		);
	}

	return (
		<div className={classes.tableFrame}>
			<Table.ScrollContainer minWidth={620} type="native">
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
							const isSelected = row.original.id === selectedSeriesId;
							return (
								<Table.Tr
									key={row.id}
									className={classes.tableRow}
									data-selected={isSelected || undefined}
									aria-selected={isSelected}
									tabIndex={0}
									onClick={() => onSelectSeries(row.original.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectSeries(row.original.id);
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
