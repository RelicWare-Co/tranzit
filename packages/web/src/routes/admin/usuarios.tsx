import { createFileRoute } from "@tanstack/react-router";
import { UsuariosPage } from "#/features/admin/components/usuarios/-UsuariosPage";

export const Route = createFileRoute("/admin/usuarios")({
	component: UsuariosPage,
});
