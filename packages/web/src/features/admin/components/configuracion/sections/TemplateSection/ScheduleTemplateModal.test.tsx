import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { ScheduleTemplateModal } from "./ScheduleTemplateModal";
import { renderWithProviders } from "#/test/render";

const sampleTemplate: ScheduleTemplate = {
	id: "template-1",
	weekday: 1,
	slotDurationMinutes: 20,
	bufferMinutes: 5,
	slotCapacityLimit: 10,
	isEnabled: true,
	morningStart: "08:00",
	morningEnd: "12:00",
	afternoonStart: "14:00",
	afternoonEnd: "17:00",
	notes: "Notas de prueba",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ScheduleTemplateModal", () => {
	const defaultProps = {
		opened: true,
		onClose: vi.fn(),
		onCreate: vi.fn().mockResolvedValue(undefined),
		onUpdate: vi.fn().mockResolvedValue(undefined),
	};

	it("opens create mode with empty time fields", () => {
		renderWithProviders(
			<ScheduleTemplateModal {...defaultProps} mode="create" />,
		);

		expect(screen.getByText("Crear plantilla de agenda")).toBeInTheDocument();
		expect(screen.getByLabelText("Inicio mañana")).toBeInTheDocument();
	});

	it("opens edit mode with template values and weekday title", () => {
		renderWithProviders(
			<ScheduleTemplateModal
				{...defaultProps}
				mode="edit"
				template={sampleTemplate}
			/>,
		);

		expect(screen.getByText("Editar plantilla — Lunes")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Notas de prueba")).toBeInTheDocument();
	});

	it("calls onUpdate with id and payload when saving an edit", async () => {
		const onUpdate = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		renderWithProviders(
			<ScheduleTemplateModal
				{...defaultProps}
				mode="edit"
				template={sampleTemplate}
				onUpdate={onUpdate}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

		await waitFor(() => {
			expect(onUpdate).toHaveBeenCalledTimes(1);
		});

		expect(onUpdate).toHaveBeenCalledWith("template-1", {
			slotDurationMinutes: 20,
			bufferMinutes: 5,
			slotCapacityLimit: 10,
			isEnabled: true,
			morningStart: "08:00",
			morningEnd: "12:00",
			afternoonStart: "14:00",
			afternoonEnd: "17:00",
			notes: "Notas de prueba",
		});
	});

	it("blocks save and shows errors for inverted time windows", async () => {
		const onUpdate = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		renderWithProviders(
			<ScheduleTemplateModal
				{...defaultProps}
				mode="edit"
				template={{
					...sampleTemplate,
					morningStart: "10:00",
					morningEnd: "09:00",
				}}
				onUpdate={onUpdate}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

		expect(
			await screen.findByText("El fin de mañana debe ser posterior al inicio"),
		).toBeInTheDocument();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("keeps the modal open when the API returns an error", async () => {
		const onUpdate = vi
			.fn()
			.mockRejectedValue(new Error("Error de servidor"));
		const onClose = vi.fn();
		const user = userEvent.setup();

		renderWithProviders(
			<ScheduleTemplateModal
				opened={true}
				onClose={onClose}
				onCreate={vi.fn()}
				onUpdate={onUpdate}
				mode="edit"
				template={sampleTemplate}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

		expect(await screen.findByText("Error de servidor")).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Guardar cambios" }),
		).toBeEnabled();
	});
});

describe("ScheduleTemplateModal create interactions", () => {
	it("shows weekday selector in create mode", () => {
		renderWithProviders(
			<ScheduleTemplateModal
				opened={true}
				onClose={vi.fn()}
				onCreate={vi.fn()}
				onUpdate={vi.fn()}
				mode="create"
			/>,
		);

		const weekdayField = screen.getByRole("combobox", { name: "Día de la semana" });
		expect(weekdayField).toBeInTheDocument();
		expect(weekdayField).toHaveValue("Lunes");
	});
});
