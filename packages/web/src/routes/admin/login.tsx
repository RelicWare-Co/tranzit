import { createFileRoute } from "@tanstack/react-router";
import AdminLoginPage from "#/features/admin/components/AdminLoginPage";

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});
