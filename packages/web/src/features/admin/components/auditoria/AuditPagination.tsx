import { Button, Group, Text } from "@mantine/core";

interface AuditPaginationProps {
	currentPage: number;
	totalPages: number;
	entriesCount: number;
	total: number;
	onPageChange: (page: number) => void;
}

export function AuditPagination({
	currentPage,
	totalPages,
	entriesCount,
	total,
	onPageChange,
}: AuditPaginationProps) {
	return (
		<Group justify="space-between" align="center" wrap="nowrap">
			<Text size="sm" c="dimmed">
				Mostrando {entriesCount} de {total} registros
			</Text>
			<Group gap="sm">
				<Button
					variant="light"
					size="sm"
					disabled={currentPage === 0}
					onClick={() => onPageChange(currentPage - 1)}
				>
					Anterior
				</Button>
				<Text size="sm" className="font-mono">
					{currentPage + 1} / {totalPages || 1}
				</Text>
				<Button
					variant="light"
					size="sm"
					disabled={currentPage >= totalPages - 1}
					onClick={() => onPageChange(currentPage + 1)}
				>
					Siguiente
				</Button>
			</Group>
		</Group>
	);
}
