import { createFileRoute } from "@tanstack/react-router";
import { AdminAuditoriaPage } from "#/features/admin/components/auditoria/AdminAuditoriaPage";

export const Route = createFileRoute("/admin/auditoria")({
	component: AdminAuditoriaPage,
});
