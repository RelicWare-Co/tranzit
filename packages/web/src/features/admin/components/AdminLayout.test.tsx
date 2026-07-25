import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { AdminLayout } from "./AdminLayout";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	isAuthenticated: false,
	isLoading: false,
	roles: [] as string[],
	pathname: "/admin",
}));

vi.mock("@tanstack/react-router", () => ({
	Outlet: () => <div data-testid="admin-outlet">Admin content</div>,
	useLocation: () => ({ pathname: mocks.pathname }),
	useNavigate: () => mocks.navigate,
}));

vi.mock("#/features/auth/components/AuthContext", () => ({
	useAuth: () => ({
		isAuthenticated: mocks.isAuthenticated,
		isLoading: mocks.isLoading,
		hasRole: (role: string) => mocks.roles.includes(role),
	}),
}));

vi.mock("./AdminNavbar", () => ({
	AdminNavbar: () => <div data-testid="admin-navbar" />,
}));

vi.mock("./AdminSidebar", () => ({
	AdminSidebar: () => <div data-testid="admin-sidebar" />,
}));

beforeEach(() => {
	mocks.navigate.mockReset();
	mocks.isAuthenticated = false;
	mocks.isLoading = false;
	mocks.roles = [];
	mocks.pathname = "/admin";
});

describe("AdminLayout guard", () => {
	it("redirects unauthenticated visitors to the unified login", async () => {
		const { container } = renderWithProviders(<AdminLayout />);

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/login",
				replace: true,
			});
		});
		expect(container.querySelector("div")).toBeNull();
	});

	it("redirects authenticated common users to their profile", async () => {
		mocks.isAuthenticated = true;
		const { container } = renderWithProviders(<AdminLayout />);

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/mi-perfil",
				replace: true,
			});
		});
		expect(container.querySelector("div")).toBeNull();
	});

	it.each([
		"admin",
		"staff",
		"auditor",
	])("renders the backoffice for the %s role", async (role) => {
		mocks.isAuthenticated = true;
		mocks.roles = [role];
		renderWithProviders(<AdminLayout />);

		expect(await screen.findByTestId("admin-outlet")).toBeInTheDocument();
		expect(screen.getByTestId("admin-navbar")).toBeInTheDocument();
		expect(screen.getByTestId("admin-sidebar")).toBeInTheDocument();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});
