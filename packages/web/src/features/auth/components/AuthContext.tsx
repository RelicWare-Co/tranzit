import { createContext, useCallback, useContext, useMemo } from "react";

import { type AuthUser, authClient } from "#/shared/lib/auth-client";

type PermissionMap = Record<string, string[]>;
type AdminRole = "admin" | "staff" | "auditor";

interface AuthContextValue {
	user: AuthUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (name: string, email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
	sendVerificationOtp: (
		email: string,
		type?: "sign-in" | "email-verification" | "forget-password",
	) => Promise<void>;
	signInEmailOtp: (email: string, otp: string, name?: string) => Promise<void>;
	hasPermission: (permissions: PermissionMap) => Promise<boolean>;
	checkRolePermission: (params: {
		permissions: PermissionMap;
		role: AdminRole;
	}) => boolean;
	hasRole: (role: string) => boolean;
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

	const sendVerificationOtp = useCallback(
		async (
			email: string,
			type: "sign-in" | "email-verification" | "forget-password" = "sign-in",
		) => {
			if (!email) {
				throw new Error("Correo electrónico requerido.");
			}

			const { error } = await authClient.emailOtp.sendVerificationOtp({
				email,
				type,
			});

			if (error) {
				throw new Error(error.message);
			}
		},
		[],
	);

	const signInEmailOtp = useCallback(
		async (email: string, otp: string, name?: string) => {
			if (!email || !otp) {
				throw new Error("Correo y código OTP requeridos.");
			}

			const { error } = await authClient.signIn.emailOtp({
				email,
				otp,
				name,
			});

			if (error) {
				throw new Error(error.message);
			}

			await refetch();
		},
		[refetch],
	);

	const hasPermission = useCallback(async (permissions: PermissionMap) => {
		const result = await authClient.admin.hasPermission({
			permissions,
		});
		return result.data?.success ?? false;
	}, []);

	const checkRolePermission = useCallback(
		(params: { permissions: PermissionMap; role: AdminRole }) => {
			return authClient.admin.checkRolePermission(params);
		},
		[],
	);

	const hasRole = useCallback(
		(role: string) => {
			const user = session?.user;
			if (!user?.role) return false;
			return user.role
				.split(",")
				.map((r) => r.trim())
				.includes(role);
		},
		[session],
	);

	const value = useMemo(
		() => ({
			user: session?.user ? (session.user as AuthUser) : null,
			isAuthenticated: !!session?.user,
			isLoading: isPending,
			login,
			register,
			logout,
			refreshUser,
			sendVerificationOtp,
			signInEmailOtp,
			hasPermission,
			checkRolePermission,
			hasRole,
		}),
		[
			session,
			isPending,
			login,
			register,
			logout,
			refreshUser,
			sendVerificationOtp,
			signInEmailOtp,
			hasPermission,
			checkRolePermission,
			hasRole,
		],
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
