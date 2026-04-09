import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

interface MockUser {
	id: string;
	email: string;
	name: string;
	phone?: string;
}

interface AuthContextValue {
	user: MockUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
	refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "mock_auth_user";

// Mock user data
const MOCK_USERS: MockUser[] = [
	{
		id: "1",
		email: "usuario@test.com",
		name: "Juan Carlos Pérez",
		phone: "+57 321 456 7890",
	},
	{
		id: "2",
		email: "admin@test.com",
		name: "Admin Usuario",
		phone: "+57 300 123 4567",
	},
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<MockUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const checkAuth = useCallback(() => {
		setIsLoading(true);
		try {
			const storedUser = localStorage.getItem(STORAGE_KEY);
			if (storedUser) {
				const parsedUser = JSON.parse(storedUser) as MockUser;
				setUser(parsedUser);
			} else {
				setUser(null);
			}
		} catch {
			setUser(null);
			localStorage.removeItem(STORAGE_KEY);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	const login = useCallback(async (email: string, password: string) => {
		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Accept any non-empty email/password, or find a mock user
		if (!email || !password) {
			throw new Error("Credenciales requeridas");
		}

		// Try to find existing mock user by email, or create a new one
		let foundUser = MOCK_USERS.find(
			(u) => u.email.toLowerCase() === email.toLowerCase(),
		);

		if (!foundUser) {
			// Create a generic user for any email
			foundUser = {
				id: Date.now().toString(),
				email: email,
				name: email.split("@")[0],
				phone: undefined,
			};
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify(foundUser));
		setUser(foundUser);
	}, []);

	const logout = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setUser(null);
	}, []);

	const refreshUser = useCallback(async () => {
		// No-op for mock auth
	}, []);

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
