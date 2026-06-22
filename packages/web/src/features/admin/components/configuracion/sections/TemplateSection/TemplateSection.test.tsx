import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { TemplateSection } from "./index";
import { renderWithProviders } from "#/test/render";

vi.mock("#/features/admin/components/hooks/useConfigMutations", () => ({
	useConfigMutations: () => ({
		createTemplate: vi.fn().mockResolvedValue(undefined),
		updateTemplate: vi.fn().mockResolvedValue(undefined),
		removeTemplate: vi.fn().mockResolvedValue(undefined),
	}),
}));

const templates: ScheduleTemplate[] = [
	{
		id: "template-1",
		weekday: 1,
		slotDurationMinutes: 20,
		bufferMinutes: 0,
		slotCapacityLimit: null,
		isEnabled: true,
		morningStart: "08:00",
		morningEnd: "12:00",
		afternoonStart: "14:00",
		afternoonEnd: "17:00",
		notes: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
];

describe("TemplateSection", () => {
	it("opens an empty create modal from Crear plantilla", async () => {
		const user = userEvent.setup();

		renderWithProviders(
			<TemplateSection
				templates={[]}
				isLoading={false}
				onRefresh={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		await user.click(
			screen.getAllByRole("button", { name: "Crear plantilla" })[0],
		);

		await waitFor(() => {
			expect(screen.getByText("Crear plantilla de agenda")).toBeInTheDocument();
		});
	});

	it("opens edit modal with the selected template title", async () => {
		const user = userEvent.setup();

		renderWithProviders(
			<TemplateSection
				templates={templates}
				isLoading={false}
				onRefresh={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Editar" }));

		await waitFor(() => {
			expect(screen.getByText("Editar plantilla — Lunes")).toBeInTheDocument();
		});
	});
});
