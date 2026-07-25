import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { OperationResult } from "./OperationResult";

describe("OperationResult", () => {
	it("translates capacity data into operational labels", () => {
		renderWithProviders(
			<OperationResult
				result={{
					actionId: "booking-capacity",
					message: "Capacidad consultada para la cita seleccionada.",
					response: {
						available: true,
						globalCapacity: 12,
						globalUsed: 7,
						globalRemaining: 5,
					},
				}}
				onClose={() => undefined}
			/>,
		);

		expect(screen.getByText("Operación completada")).toBeInTheDocument();
		expect(screen.getByText("Disponible")).toBeInTheDocument();
		expect(screen.getByText("Capacidad total")).toBeInTheDocument();
		expect(screen.getByText("12")).toBeInTheDocument();
		expect(screen.queryByText(/"globalCapacity"/)).not.toBeInTheDocument();
	});

	it("exposes a clear close action", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		renderWithProviders(
			<OperationResult
				result={{
					actionId: "booking-confirm",
					message: "Cita confirmada.",
					response: { success: true },
				}}
				onClose={onClose}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Cerrar resultado de la operación",
			}),
		);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
