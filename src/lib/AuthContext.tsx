import { createContext, useCallback, useContext, useMemo } from "react";

import { authClient, type AuthUser } from "./auth-client";

interface AuthContextValue {
	user: AuthUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (name: string, email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const { data: session, isPending, refetch } = authClient.useSession();

	const login = useCallback(
		async (email: string, password: string) => {
			if (!email || !password) {
				throw new Error("Credenciales requeridas.");
			}

			const { error } = await authClient.signIn.email({ email, password });

			if (error) {
				throw new Error(error.message);
			}

			await refetch();
		},
		[refetch],
	);

	const register = useCallback(
		async (name: string, email: string, password: string) => {
			if (!name || !email || !password) {
				throw new Error("Completa nombre, correo y contraseña.");
			}

			const { error } = await authClient.signUp.email({
				name,
				email,
				password,
			});

			if (error) {
				throw new Error(error.message);
			}

			await refetch();
		},
		[refetch],
	);

	const logout = useCallback(async () => {
		const { error } = await authClient.signOut();

		if (error) {
			throw new Error(error.message);
		}

		await refetch();
	}, [refetch]);

	const refreshUser = useCallback(async () => {
		await refetch();
	}, [refetch]);

	const value = useMemo(
		() => ({
			user: session?.user ? (session.user as AuthUser) : null,
			isAuthenticated: !!session?.user,
			isLoading: isPending,
			login,
			register,
			logout,
			refreshUser,
		}),
		[session, isPending, login, register, logout, refreshUser],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
