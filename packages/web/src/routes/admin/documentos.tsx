import { createFileRoute } from "@tanstack/react-router";
import { AdminDocumentosPage } from "./-AdminDocumentosPage";

export const Route = createFileRoute("/admin/documentos")({
	component: AdminDocumentosPage,
});
