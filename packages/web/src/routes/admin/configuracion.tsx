import { createFileRoute } from "@tanstack/react-router";
import { AdminConfiguracionPage } from "#/features/admin/components/configuracion/AdminConfiguracionPage";

export const Route = createFileRoute("/admin/configuracion")({
	component: AdminConfiguracionPage,
});
