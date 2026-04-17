import { createFileRoute } from "@tanstack/react-router";
import { TramitesPage } from "./tramites/-TramitesPage";

export const Route = createFileRoute("/admin/tramites")({
	component: TramitesPage,
});
