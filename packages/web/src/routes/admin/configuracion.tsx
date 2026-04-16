import { createFileRoute } from "@tanstack/react-router";
import { AdminConfiguracionPage } from "./configuracion/AdminConfiguracionPage";

export const Route = createFileRoute("/admin/configuracion")({
	component: AdminConfiguracionPage,
});
