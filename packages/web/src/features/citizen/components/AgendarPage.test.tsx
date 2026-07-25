import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import AgendarPage from "./AgendarPage";

const mocks = vi.hoisted(() => ({
	listProcedures: vi.fn(),
	navigate: vi.fn(),
	sendVerificationOtp: vi.fn(),
	signInEmailOtp: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("#/features/auth/components/AuthContext", () => ({
	useAuth: () => ({
		user: null,
		isAuthenticated: false,
		sendVerificationOtp: mocks.sendVerificationOtp,
		signInEmailOtp: mocks.signInEmailOtp,
	}),
}));

vi.mock("#/shared/lib/orpc-client", () => ({
	orpcClient: {
		citizen: {
			procedures: {
				list: mocks.listProcedures,
			},
			slots: {
				range: vi.fn(),
			},
			bookings: {
				mine: vi.fn(),
				hold: vi.fn(),
				confirm: vi.fn(),
				cancel: vi.fn(),
			},
			vehicles: {
				validatePlate: vi.fn(),
			},
		},
	},
}));

function renderAgendarPage() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return renderWithProviders(
		<QueryClientProvider client={queryClient}>
			<AgendarPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mocks.listProcedures.mockReset();
	mocks.navigate.mockReset();
	mocks.sendVerificationOtp.mockReset();
	mocks.signInEmailOtp.mockReset();
	mocks.listProcedures.mockResolvedValue([]);
});

describe("AgendarPage", () => {
	it("mounts without entering a form synchronization update loop", async () => {
		renderAgendarPage();

		expect(
			await screen.findByRole("heading", { name: "¿Qué trámite necesitas?" }),
		).toBeInTheDocument();
		expect(mocks.listProcedures).toHaveBeenCalledTimes(1);
	});
});
