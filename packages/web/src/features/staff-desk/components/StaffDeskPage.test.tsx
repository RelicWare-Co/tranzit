import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { orpcClient } from "#/shared/lib/orpc-client";
import { renderWithProviders } from "#/test/render";
import { StaffDeskPage } from "./StaffDeskPage";
import { getBogotaIsoDate } from "./staff-desk-utils";

vi.mock("#/features/auth/components/AuthContext", () => ({
	useAuth: () => ({
		user: { id: "staff-1", name: "Mariana Ríos", role: "staff" },
		isAuthenticated: true,
		isLoading: false,
		hasRole: (role: string) => role === "staff",
	}),
}));

vi.mock("#/shared/lib/orpc-client", () => ({
	orpcClient: {
		staffDesk: {
			queue: vi.fn(),
			checkIn: vi.fn(),
			review: vi.fn(),
			complete: vi.fn(),
			cancel: vi.fn(),
		},
	},
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, ...props }: { children: ReactNode }) => (
		<a {...props}>{children}</a>
	),
	useNavigate: () => vi.fn(),
}));

const deskApi = orpcClient.staffDesk as {
	queue: ReturnType<typeof vi.fn>;
	checkIn: ReturnType<typeof vi.fn>;
	review: ReturnType<typeof vi.fn>;
	complete: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
};

const queueResponse = {
	date: getBogotaIsoDate(),
	cases: [
		{
			id: "booking-1",
			status: "confirmed",
			isActive: true,
			confirmedAt: "2032-06-01T15:00:00.000Z",
			attendedAt: null,
			cancelledAt: null,
			statusReason: null,
			notes: null,
			slot: {
				id: "slot-1",
				slotDate: getBogotaIsoDate(),
				startTime: "09:00",
				endTime: "09:30",
			},
			request: {
				id: "request-1",
				status: "confirmed",
				email: "ciudadana@example.com",
				phone: "3000000000",
				documentType: "CC",
				documentNumber: "123456789",
				applicantName: "Lucía Moreno",
				plate: "ABC123",
				procedure: {
					id: "procedure-1",
					name: "Traspaso de vehículo",
					description: null,
					instructions: "Presenta los documentos originales.",
					requiresVehicle: true,
				},
				requirements: [
					{
						id: "identity",
						name: "Documento de identidad",
						description: "Original vigente",
						isRequired: true,
					},
				],
				eligibilityResult: {},
				verifiedAt: null,
				confirmedAt: null,
				cancelledAt: null,
			},
		},
	],
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return renderWithProviders(
		<QueryClientProvider client={queryClient}>
			<StaffDeskPage />
		</QueryClientProvider>,
	);
}

describe("StaffDeskPage", () => {
	beforeEach(() => {
		deskApi.queue.mockReset().mockResolvedValue(queueResponse);
		deskApi.checkIn.mockReset().mockResolvedValue({
			action: "checked_in",
			alreadyProcessed: false,
			bookingId: "booking-1",
			requestId: "request-1",
		});
		deskApi.review.mockReset();
		deskApi.complete.mockReset();
		deskApi.cancel.mockReset();
	});

	it("shows only the assigned work queue and opens a reception case", async () => {
		const user = userEvent.setup();
		renderPage();

		expect(
			await screen.findByRole("heading", { name: "Agenda asignada" }),
		).toBeInTheDocument();
		expect(await screen.findByText("Lucía Moreno")).toBeVisible();
		expect(screen.getByText("Traspaso de vehículo")).toBeVisible();

		await user.click(screen.getByRole("button", { name: /Lucía Moreno/ }));

		expect(
			await screen.findByRole("heading", { name: "Atención del ciudadano" }),
		).toBeInTheDocument();
		expect(screen.getByText("1. Recibir al ciudadano")).toBeVisible();
		expect(screen.getAllByText("CC 123456789").length).toBeGreaterThan(0);
	});

	it("registers reception from the case instead of using the global scheduling actions", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByText("Lucía Moreno");
		await user.click(screen.getByRole("button", { name: /Lucía Moreno/ }));
		await user.click(
			screen.getByRole("button", { name: "Registrar recepción" }),
		);

		await waitFor(() =>
			expect(deskApi.checkIn).toHaveBeenCalledWith({ bookingId: "booking-1" }),
		);
	});

	it("keeps appointments from other dates in read-only mode", async () => {
		const user = userEvent.setup();
		deskApi.queue.mockResolvedValue({
			...queueResponse,
			date: "2032-06-15",
			cases: queueResponse.cases.map((deskCase) => ({
				...deskCase,
				slot: { ...deskCase.slot, slotDate: "2032-06-15" },
			})),
		});
		renderPage();

		await screen.findByText("Lucía Moreno");
		await user.click(screen.getByRole("button", { name: /Lucía Moreno/ }));

		expect(await screen.findByText("Consulta de solo lectura")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Registrar recepción" }),
		).not.toBeInTheDocument();
	});
});
