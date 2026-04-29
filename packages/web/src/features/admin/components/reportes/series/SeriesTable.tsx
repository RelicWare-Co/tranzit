import { Badge, Group, Loader, Table, Text } from "@mantine/core";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";

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
				size: 48,
				cell: ({ row }) => {
					const isSelected = row.original.id === selectedSeriesId;
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
			columnHelper.accessor("isActive", {
				header: "Estado",
				size: 120,
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
			columnHelper.accessor("activeInstanceCount", {
				header: "Instancias",
				size: 120,
				cell: (info) =>
					info.getValue() ?? (
						<span className="text-[var(--text-secondary)]">-</span>
					),
			}),
			columnHelper.accessor("notes", {
				header: "Notas",
				size: 300,
				cell: (info) => (
					<Text size="sm" c="dimmed" truncate maw={280}>
						{info.getValue() ?? (
							<span className="text-[var(--text-secondary)]">Sin notas</span>
						)}
					</Text>
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
			<div className={`${adminUi.surfaceMuted} text-center py-8`}>
				<Text size="sm" c="red">
					Error cargando series
				</Text>
				<Text component="pre" size="xs" c="dimmed" className="mt-2">
					{JSON.stringify(error, null, 2)}
				</Text>
			</div>
		);
	}

	if (isLoading) {
		return (
			<Group justify="center" py="xl">
				<Loader size="sm" />
			</Group>
		);
	}

	if (series.length === 0) {
		return (
			<div className={`${adminUi.surfaceMuted} text-center py-10`}>
				<Text size="sm" c="dimmed">
					No hay series de reserva activas.
				</Text>
			</div>
		);
	}

	return (
		<Table.ScrollContainer minWidth={800}>
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
						<Table.Tr key={headerGroup.id} className="bg-[var(--bg-secondary)]">
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
						const isSelected = row.original.id === selectedSeriesId;
						return (
							<Table.Tr
								key={row.id}
								className={
									isSelected
										? "bg-red-50/60 cursor-pointer transition-colors"
										: "cursor-pointer transition-colors"
								}
								onClick={() => onSelectSeries(row.original.id)}
							>
								{row.getVisibleCells().map((cell) => (
									<Table.Td key={cell.id} className={adminUi.tableCell}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</Table.Td>
								))}
							</Table.Tr>
						);
					})}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
