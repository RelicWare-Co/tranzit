import { createFileRoute } from "@tanstack/react-router";
import { StaffDeskPage } from "#/features/staff-desk/components/StaffDeskPage";

export const Route = createFileRoute("/atencion")({
	component: StaffDeskPage,
});
