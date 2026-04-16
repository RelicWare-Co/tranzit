import { createFileRoute } from "@tanstack/react-router";
import { AdminCitasPage } from "./citas/AdminCitasPage";

export const Route = createFileRoute("/admin/citas")({
	component: AdminCitasPage,
});
