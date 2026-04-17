import { createFileRoute } from "@tanstack/react-router";
import { AdminAuditoriaPage } from "./auditoria/-AdminAuditoriaPage";

export const Route = createFileRoute("/admin/auditoria")({
	component: AdminAuditoriaPage,
});
