import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const onboardingStatusQueryKey = ["admin", "onboarding", "status"];

const mocks = vi.hoisted(() => ({
	signOut: vi.fn(),
	refetchSession: vi.fn(),
}));

vi.mock("#/shared/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({
			data: {
				user: {
					id: "user-1",
					name: "Persona",
					email: "persona@example.com",
					role: "user",
				},
			},
			isPending: false,
			refetch: mocks.refetchSession,
		}),
		signOut: mocks.signOut,
	},
}));

vi.mock("#/shared/lib/orpc-client", () => ({
	orpc: {
		admin: {
			onboarding: {
				status: {
					queryOptions: () => ({
						queryKey: ["admin", "onboarding", "status"],
					}),
				},
			},
		},
	},
}));

function LogoutProbe() {
	const { logout } = useAuth();

	return (
		<button
			type="button"
			onClick={() => {
				void logout();
			}}
		>
			Cerrar sesión
		</button>
	);
}

beforeEach(() => {
	mocks.signOut.mockReset();
	mocks.refetchSession.mockReset();
	mocks.signOut.mockResolvedValue({ error: null });
	mocks.refetchSession.mockResolvedValue(undefined);
});

describe("AuthProvider logout", () => {
	it("removes the cached onboarding status after signing out", async () => {
		const user = userEvent.setup();
		const queryClient = new QueryClient();
		queryClient.setQueryData(onboardingStatusQueryKey, { adminExists: false });

		renderAuthProvider(queryClient);
		await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

		await waitFor(() => {
			expect(mocks.signOut).toHaveBeenCalledOnce();
			expect(mocks.refetchSession).toHaveBeenCalledOnce();
			expect(
				queryClient.getQueryData(onboardingStatusQueryKey),
			).toBeUndefined();
		});
	});
});

function renderAuthProvider(queryClient: QueryClient) {
	return render(
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<LogoutProbe />
			</AuthProvider>
		</QueryClientProvider>,
	);
}
