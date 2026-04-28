import { createFileRoute } from "@tanstack/react-router";
import { AdminReportesPage } from "#/features/admin/components/reportes/AdminReportesPage";

export const Route = createFileRoute("/admin/reportes")({
	component: AdminReportesPage,
});
