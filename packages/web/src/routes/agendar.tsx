import { createFileRoute } from "@tanstack/react-router";
import AgendarPage from "#/features/citizen/components/AgendarPage";

export const Route = createFileRoute("/agendar")({
	component: AgendarPage,
});
