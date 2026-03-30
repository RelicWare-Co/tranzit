import type { RecordModel } from "pocketbase";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import pb from "./pb";

interface AuthContextValue {
	user: RecordModel | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
	refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<RecordModel | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const checkAuth = useCallback(async () => {
		setIsLoading(true);
		try {
			if (pb.authStore.isValid) {
				// Refresh the auth to ensure it's still valid
				await pb.collection("users").authRefresh();
				setUser(pb.authStore.record as RecordModel);
			} else {
				setUser(null);
			}
		} catch {
			setUser(null);
			pb.authStore.clear();
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		checkAuth();

		// Subscribe to auth state changes
		const unsubscribe = pb.authStore.onChange((token, model) => {
			// Use token to satisfy the callback signature
			if (token && model && "collectionId" in model) {
				setUser(model as RecordModel);
			} else {
				setUser(null);
			}
		});

		return () => {
			unsubscribe();
		};
	}, [checkAuth]);

	const login = useCallback(async (email: string, password: string) => {
		const authData = await pb
			.collection("users")
			.authWithPassword(email, password);
		setUser(authData.record);
	}, []);

	const logout = useCallback(() => {
		pb.authStore.clear();
		setUser(null);
	}, []);

	const refreshUser = useCallback(async () => {
		if (pb.authStore.isValid && user) {
			const freshUser = await pb.collection("users").getOne(user.id);
			setUser(freshUser);
		}
	}, [user]);

	const value = useMemo(
		() => ({
			user,
			isAuthenticated: !!user,
			isLoading,
			login,
			logout,
			refreshUser,
		}),
		[user, isLoading, login, logout, refreshUser],
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
