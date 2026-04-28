import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { AuditFilterBar, defaultFilters } from "./AuditFilterBar";
import { AuditPagination } from "./AuditPagination";
import { AuditTable } from "./AuditTable";
import type { AuditFilters } from "./AuditFilterBar";

export function AdminAuditoriaPage() {
	const [appliedFilters, setAppliedFilters] =
		useState<AuditFilters>(defaultFilters);
	const [currentPage, setCurrentPage] = useState(0);
	const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
	const pageSize = 20;

	const fetchAuditEvents = useCallback(async () => {
		const payload: Parameters<typeof orpcClient.admin.audit.list>[0] = {};
		if (appliedFilters.entityType) payload.entityType = appliedFilters.entityType;
		if (appliedFilters.actorUserId)
			payload.actorUserId = appliedFilters.actorUserId;
		if (appliedFilters.action) payload.action = appliedFilters.action;
		if (appliedFilters.dateFrom) payload.dateFrom = appliedFilters.dateFrom;
		if (appliedFilters.dateTo) payload.dateTo = appliedFilters.dateTo;
		payload.limit = pageSize;
		payload.offset = currentPage * pageSize;
		payload.orderBy = "createdAt";
		payload.orderDir = "desc";

		return await orpcClient.admin.audit.list(payload);
	}, [appliedFilters, currentPage]);

	const auditQuery = useQuery({
		queryKey: ["admin", "auditoria", "list", appliedFilters, currentPage],
		queryFn: fetchAuditEvents,
	});

	const activeFiltersCount = Object.values(appliedFilters).filter(
		(v) => v !== "",
	).length;

	const totalPages = auditQuery.data
		? Math.ceil(auditQuery.data.total / pageSize)
		: 0;

	const handleApplyFilters = (filters: AuditFilters) => {
		setAppliedFilters(filters);
		setCurrentPage(0);
		setExpandedRowId(null);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		setExpandedRowId(null);
	};

	const handleToggleRow = (id: string) => {
		setExpandedRowId((current) => (current === id ? null : id));
	};

	const handleRefresh = () => {
		setCurrentPage(0);
		setExpandedRowId(null);
	};

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Auditoría"
				description="Consulta y filtra el registro de auditoría de todas las operaciones del sistema."
				actions={
					<Group>
						{activeFiltersCount > 0 ? (
							<Badge color="blue" variant="light" size="sm">
								{activeFiltersCount} filtro(s) activo(s)
							</Badge>
						) : null}
						<Button
							leftSection={<RefreshCw size={16} />}
							onClick={() => void handleRefresh()}
							variant="light"
							size="sm"
						>
							Refrescar
						</Button>
					</Group>
				}
			/>

			<AuditFilterBar
				appliedFilters={appliedFilters}
				onApply={handleApplyFilters}
			/>

			<Paper withBorder radius="lg" p="md" shadow="sm">
				<Stack gap="md">
					<Group justify="space-between" wrap="nowrap">
						<Title
							order={5}
							className="text-sm font-semibold text-zinc-900"
						>
							Registros de auditoría
							{auditQuery.data ? (
								<Text component="span" c="dimmed" size="sm" ml="xs">
									({auditQuery.data.total} total)
								</Text>
							) : null}
						</Title>
					</Group>

					<AuditTable
						entries={(auditQuery.data?.entries ?? []) as Array<{
							id: string;
							createdAt: string;
							actorType: string;
							actorUserId: string | null;
							entityType: string;
							entityId: string;
							action: string;
							summary: string;
							payload: Record<string, unknown>;
							ipAddress: string | null;
							userAgent: string | null;
						}>}
						total={auditQuery.data?.total ?? 0}
						isLoading={auditQuery.isPending}
						isError={auditQuery.isError}
						error={auditQuery.error}
						expandedRowId={expandedRowId}
						onToggleRow={handleToggleRow}
					/>

					{auditQuery.data && auditQuery.data.entries.length > 0 && (
						<AuditPagination
							currentPage={currentPage}
							totalPages={totalPages}
							entriesCount={auditQuery.data.entries.length}
							total={auditQuery.data.total}
							onPageChange={handlePageChange}
						/>
					)}
				</Stack>
			</Paper>
		</Stack>
	);
}
