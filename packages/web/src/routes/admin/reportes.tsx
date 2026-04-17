import { createFileRoute } from "@tanstack/react-router";
import { AdminReportesPage } from "./reportes/-AdminReportesPage";

export const Route = createFileRoute("/admin/reportes")({
	component: AdminReportesPage,
});
