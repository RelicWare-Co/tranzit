import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "#/features/citizen/components/ProfilePage";

export const Route = createFileRoute("/mi-perfil")({
	component: ProfilePage,
});
