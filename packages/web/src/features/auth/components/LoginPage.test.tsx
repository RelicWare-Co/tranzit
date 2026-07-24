import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import LoginPage from "./LoginPage";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	fetchOnboardingStatus: vi.fn(),
	bootstrapAdmin: vi.fn(),
	sendVerificationOtp: vi.fn(),
	signInEmailOtp: vi.fn(),
	refreshUser: vi.fn(),
	isAuthenticated: false,
	isLoading: false,
	roles: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useNavigate: () => mocks.navigate,
}));

vi.mock("#/features/auth/components/AuthContext", () => ({
	useAuth: () => ({
		sendVerificationOtp: mocks.sendVerificationOtp,
		signInEmailOtp: mocks.signInEmailOtp,
		refreshUser: mocks.refreshUser,
		hasRole: (role: string) => mocks.roles.includes(role),
		isAuthenticated: mocks.isAuthenticated,
		isLoading: mocks.isLoading,
	}),
}));

vi.mock("#/shared/lib/orpc-client", () => ({
	orpc: {
		admin: {
			onboarding: {
				status: {
					queryOptions: ({
						enabled,
						retry,
					}: {
						enabled: boolean;
						retry: boolean;
					}) => ({
						queryKey: ["admin", "onboarding", "status"],
						queryFn: mocks.fetchOnboardingStatus,
						enabled,
						retry,
					}),
				},
				bootstrap: {
					mutationOptions: () => ({
						mutationFn: mocks.bootstrapAdmin,
					}),
				},
			},
		},
	},
}));

const onboardingStatusQueryKey = ["admin", "onboarding", "status"];

function renderLoginPage() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	const result = renderWithProviders(
		<QueryClientProvider client={queryClient}>
			<LoginPage />
		</QueryClientProvider>,
	);

	return { ...result, queryClient };
}

beforeEach(() => {
	mocks.isAuthenticated = false;
	mocks.isLoading = false;
	mocks.roles = [];
	mocks.navigate.mockReset();
	mocks.fetchOnboardingStatus.mockReset();
	mocks.bootstrapAdmin.mockReset();
	mocks.sendVerificationOtp.mockReset();
	mocks.signInEmailOtp.mockReset();
	mocks.refreshUser.mockReset();
	mocks.fetchOnboardingStatus.mockResolvedValue({ adminExists: true });
	mocks.bootstrapAdmin.mockResolvedValue({ success: true, role: "admin" });
	mocks.sendVerificationOtp.mockResolvedValue(undefined);
	mocks.signInEmailOtp.mockResolvedValue(undefined);
	mocks.refreshUser.mockResolvedValue(undefined);
});

describe("LoginPage OTP", () => {
	it("keeps OTP available without querying onboarding before authentication", () => {
		renderLoginPage();

		expect(mocks.fetchOnboardingStatus).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Enviar código OTP" }),
		).toBeEnabled();
	});

	it("sends and validates the same email OTP flow for every account", async () => {
		const user = userEvent.setup();
		renderLoginPage();

		await user.type(screen.getByLabelText("Nombre (opcional)"), "Ana Pérez");
		await user.type(
			screen.getByLabelText("Correo electrónico"),
			"ADMIN@Example.com",
		);
		await user.click(screen.getByRole("button", { name: "Enviar código OTP" }));

		await waitFor(() => {
			expect(mocks.sendVerificationOtp).toHaveBeenCalledWith(
				"admin@example.com",
				"sign-in",
			);
		});
		await screen.findByText("Ingresa el código enviado a admin@example.com");

		const otpInputs = Array.from(
			document.querySelectorAll('input[inputmode="numeric"]'),
		);
		expect(otpInputs).toHaveLength(6);
		for (const [index, digit] of [..."123456"].entries()) {
			await user.type(otpInputs[index] as HTMLInputElement, digit);
		}
		await user.click(
			screen.getByRole("button", { name: "Validar e ingresar" }),
		);

		await waitFor(() => {
			expect(mocks.signInEmailOtp).toHaveBeenCalledWith(
				"admin@example.com",
				"123456",
				"Ana Pérez",
			);
		});
	});

	it("handles send, resend, and verification errors without rejected UI promises", async () => {
		const user = userEvent.setup();
		mocks.sendVerificationOtp.mockRejectedValueOnce(
			new Error("No se pudo enviar"),
		);
		renderLoginPage();

		await user.type(
			screen.getByLabelText("Correo electrónico"),
			"persona@example.com",
		);
		await user.click(screen.getByRole("button", { name: "Enviar código OTP" }));
		expect(await screen.findByText("No se pudo enviar")).toBeInTheDocument();

		mocks.sendVerificationOtp.mockResolvedValueOnce(undefined);
		await user.click(screen.getByRole("button", { name: "Enviar código OTP" }));
		await screen.findByText("Ingresa el código enviado a persona@example.com");

		mocks.sendVerificationOtp.mockRejectedValueOnce(
			new Error("No se pudo reenviar"),
		);
		await user.click(screen.getByRole("button", { name: "Reenviar" }));
		expect(await screen.findByText("No se pudo reenviar")).toBeInTheDocument();

		mocks.signInEmailOtp.mockRejectedValueOnce(new Error("Código inválido"));
		const otpInputs = Array.from(
			document.querySelectorAll('input[inputmode="numeric"]'),
		);
		for (const [index, digit] of [..."123456"].entries()) {
			await user.type(otpInputs[index] as HTMLInputElement, digit);
		}
		await user.click(
			screen.getByRole("button", { name: "Validar e ingresar" }),
		);
		expect(await screen.findByText("Código inválido")).toBeInTheDocument();
	});
});

describe("LoginPage destinations", () => {
	it.each([
		"admin",
		"staff",
		"auditor",
	])("redirects an active %s session to the backoffice", async (role) => {
		mocks.isAuthenticated = true;
		mocks.roles = [role];
		renderLoginPage();

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/admin",
				replace: true,
			});
		});
		expect(mocks.fetchOnboardingStatus).not.toHaveBeenCalled();
	});

	it("redirects an active common-user session to the citizen profile", async () => {
		mocks.isAuthenticated = true;
		mocks.fetchOnboardingStatus.mockResolvedValue({ adminExists: true });
		renderLoginPage();

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/mi-perfil",
				replace: true,
			});
		});
	});

	it("activates the first administrator and refreshes the session", async () => {
		const user = userEvent.setup();
		mocks.isAuthenticated = true;
		mocks.fetchOnboardingStatus.mockResolvedValue({ adminExists: false });
		const { queryClient } = renderLoginPage();

		await user.click(
			await screen.findByRole("button", {
				name: "Activar como administrador",
			}),
		);

		await waitFor(() => {
			expect(mocks.bootstrapAdmin).toHaveBeenCalledOnce();
			expect(mocks.refreshUser).toHaveBeenCalledOnce();
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/admin",
				replace: true,
			});
		});
		expect(mocks.navigate).not.toHaveBeenCalledWith({
			to: "/mi-perfil",
			replace: true,
		});
		expect(queryClient.getQueryData(onboardingStatusQueryKey)).toEqual({
			adminExists: true,
		});
		expect(
			queryClient.getQueryState(onboardingStatusQueryKey)?.isInvalidated,
		).toBe(true);
	});

	it("shows a retry state instead of assuming onboarding on status errors", async () => {
		const user = userEvent.setup();
		mocks.isAuthenticated = true;
		mocks.fetchOnboardingStatus
			.mockRejectedValueOnce(new Error("network error"))
			.mockResolvedValueOnce({ adminExists: true });
		renderLoginPage();

		expect(
			await screen.findByText("No pudimos verificar el acceso"),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Activar como administrador" }),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Reintentar" }));
		await waitFor(() => {
			expect(mocks.fetchOnboardingStatus).toHaveBeenCalledTimes(2);
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/mi-perfil",
				replace: true,
			});
		});
	});
});
