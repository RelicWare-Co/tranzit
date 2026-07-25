import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { TramitesPage } from "./TramitesPage";
import type { ProcedureType } from "./types";

const procedureApi = vi.hoisted(() => ({
	list: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
}));

vi.mock("#/shared/lib/orpc-client", () => ({
	orpcClient: {
		admin: {
			procedures: procedureApi,
		},
	},
}));

const procedure = {
	id: "procedure-1",
	name: "Renovación de licencia",
	slug: "renovacion-licencia",
	description: "Renueva una licencia de conducción vigente.",
	isActive: true,
	requiresVehicle: false,
	allowsPhysicalDocuments: true,
	instructions: null,
	documentSchema: {
		requirements: [
			{
				id: "requirement-1",
				name: "Documento de identidad",
				isRequired: true,
				order: 0,
			},
		],
	},
	formSchema: { fields: [] },
	eligibilitySchema: null,
	policySchema: null,
} as unknown as ProcedureType;

describe("TramitesPage", () => {
	beforeEach(() => {
		procedureApi.list.mockReset().mockResolvedValue([procedure]);
		procedureApi.create.mockReset().mockResolvedValue(undefined);
		procedureApi.update.mockReset().mockResolvedValue(undefined);
		procedureApi.remove
			.mockReset()
			.mockResolvedValue({ message: "Trámite eliminado correctamente." });
	});

	it("presents the catalog as one searchable workspace", async () => {
		renderWithProviders(<TramitesPage />);

		expect(
			await screen.findByRole("heading", { name: "Catálogo ciudadano" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("searchbox", { name: "Buscar trámites" }),
		).toBeVisible();
		expect(screen.getByText("Renovación de licencia")).toBeVisible();
		expect(screen.getByText("1 requisito")).toBeVisible();
	});

	it("uses an explicit destructive confirmation instead of a native confirm", async () => {
		const user = userEvent.setup();
		renderWithProviders(<TramitesPage />);

		await screen.findByText("Renovación de licencia");
		await user.click(
			screen.getByRole("button", {
				name: "Más acciones para Renovación de licencia",
			}),
		);
		await user.click(await screen.findByRole("menuitem", { name: "Eliminar" }));

		expect(
			screen.getByRole("heading", { name: /Eliminar trámite/ }),
		).toBeInTheDocument();
		expect(procedureApi.remove).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Eliminar trámite" }));
		await waitFor(() =>
			expect(procedureApi.remove).toHaveBeenCalledWith({ id: "procedure-1" }),
		);
	});
});
