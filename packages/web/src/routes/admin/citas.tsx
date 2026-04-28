import { createFileRoute } from "@tanstack/react-router";
import { AdminCitasPage } from "#/features/admin/components/citas/-AdminCitasPage";

export const Route = createFileRoute("/admin/citas")({
	component: AdminCitasPage,
});
