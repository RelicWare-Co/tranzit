import { createFileRoute } from "@tanstack/react-router";
import { TramitesPage } from "#/features/admin/components/tramites/-TramitesPage";

export const Route = createFileRoute("/admin/tramites")({
	component: TramitesPage,
});
