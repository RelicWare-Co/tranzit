import { createFileRoute } from "@tanstack/react-router";
import { UsuariosPage } from "./usuarios/UsuariosPage";

export const Route = createFileRoute("/admin/usuarios")({
	component: UsuariosPage,
});
