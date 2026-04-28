import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "#/features/admin/components/AdminDashboard";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});
