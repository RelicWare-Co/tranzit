import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { AddProcedureModal } from "./AddProcedureModal";

describe("AddProcedureModal", () => {
	const defaultProps = {
		opened: true,
		onClose: vi.fn(),
		onCreate: vi.fn().mockResolvedValue(undefined),
	};

	it("calls onCreate when clicking Crear trámite", async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		renderWithProviders(
			<AddProcedureModal {...defaultProps} onCreate={onCreate} />,
		);

		await user.type(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
			"Renovación de licencia",
		);

		await user.click(screen.getByRole("button", { name: "Crear trámite" }));

		await waitFor(() => {
			expect(onCreate).toHaveBeenCalledTimes(1);
		});

		expect(onCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Renovación de licencia",
				slug: "renovacion-de-licencia",
			}),
		);
	});

	it("submits the form when pressing Enter in the name field", async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		renderWithProviders(
			<AddProcedureModal {...defaultProps} onCreate={onCreate} />,
		);

		const nameInput = screen.getByPlaceholderText(
			"Ingresa el nombre del trámite",
		);
		await user.type(nameInput, "Trámite de prueba{Enter}");

		await waitFor(() => {
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	it("generates slug from name while typing", async () => {
		const user = userEvent.setup();

		renderWithProviders(<AddProcedureModal {...defaultProps} />);

		await user.type(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
			"Mi Trámite Nuevo",
		);

		expect(screen.getByPlaceholderText("renovacion-licencia")).toHaveValue(
			"mi-tramite-nuevo",
		);
	});

	it("does not overwrite a manually edited slug when the name changes", async () => {
		const user = userEvent.setup();

		renderWithProviders(<AddProcedureModal {...defaultProps} />);

		await user.type(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
			"Nombre original",
		);

		const slugInput = screen.getByPlaceholderText("renovacion-licencia");
		fireEvent.change(slugInput, { target: { value: "slug-manual" } });

		await user.clear(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
		);
		await user.type(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
			"Nombre cambiado",
		);

		expect(slugInput).toHaveValue("slug-manual");
	});

	it("shows API error and keeps the modal open", async () => {
		const onCreate = vi.fn().mockRejectedValue(new Error("Slug duplicado"));
		const onClose = vi.fn();
		const user = userEvent.setup();

		renderWithProviders(
			<AddProcedureModal opened={true} onClose={onClose} onCreate={onCreate} />,
		);

		await user.type(
			screen.getByPlaceholderText("Ingresa el nombre del trámite"),
			"Trámite duplicado",
		);
		await user.click(screen.getByRole("button", { name: "Crear trámite" }));

		expect(await screen.findByText("Slug duplicado")).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Crear trámite" })).toBeEnabled();
	});
});
