/**
 * TRAZIT Root Layout
 * Unified navigation and layout shell
 */

import {
	AppShell,
	Box,
	Container,
	Group,
	Menu,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { useWindowScroll } from "@mantine/hooks";
import {
	createRootRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

// ========================================
// NAVIGATION COMPONENTS
// ========================================

interface NavPillProps {
	label: string;
	to: string;
	isActive: boolean;
}

function NavPill({ label, to, isActive }: NavPillProps) {
	return (
		<Link
			to={to}
			className={`px-5 py-2.5 rounded-full text-sm font-semibold tracking-tight transition-all duration-200 ${
				isActive
					? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
					: "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
			}`}
		>
			{label}
		</Link>
	);
}

// ========================================
// USER MENU
// ========================================

function UserMenu() {
	const { user, logout, isAuthenticated } = useAuth();
	const router = useRouterState();
	const isProfileActive = router.location.pathname === "/mi-perfil";

	if (!isAuthenticated || !user) {
		return (
			<Link
				to="/login"
				className={`inline-flex items-center px-6 py-2.5 rounded-full font-semibold text-sm tracking-tight transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
					isProfileActive
						? "bg-[var(--brand-50)] border-2 border-[var(--accent-default)] text-[var(--text-primary)]"
						: "bg-white border-2 border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
				}`}
			>
				Iniciar Sesión
			</Link>
		);
	}

	const initials = user.name
		? user.name
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: user.email?.[0].toUpperCase() || "U";

	return (
		<Menu position="bottom-end" offset={8} withArrow arrowPosition="center">
			<Menu.Target>
				<UnstyledButton
					className={`inline-flex items-center gap-2.5 pl-1.5 pr-5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
						isProfileActive
							? "bg-[var(--brand-50)] border-2 border-[var(--brand-200)]"
							: "bg-white border-2 border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
					} hover:shadow-lg hover:-translate-y-0.5`}
				>
					<div className="w-8 h-8 rounded-full bg-[var(--brand-100)] border-2 border-[var(--accent-default)] flex items-center justify-center text-sm font-bold text-[var(--accent-default)] shadow-sm">
						{initials}
					</div>
					<span
						className={`text-sm font-semibold ${isProfileActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
					>
						Mi Perfil
					</span>
					<ChevronDown size={16} className="text-[var(--text-tertiary)]" />
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown className="bg-white/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-2 shadow-xl min-w-[220px]">
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={
						<div className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center">
							<User size={16} className="text-[var(--text-secondary)]" />
						</div>
					}
					className="rounded-xl font-semibold text-sm py-3 px-4 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
				>
					Ver mi perfil
				</Menu.Item>

				<Menu.Divider className="my-1.5 mx-2 border-[var(--border-subtle)]" />

				<Menu.Item
					leftSection={
						<div className="w-8 h-8 rounded-xl bg-[var(--error-50)] flex items-center justify-center">
							<LogOut size={16} className="text-[var(--error-600)]" />
						</div>
					}
					onClick={() => {
						void logout().catch(() => {});
					}}
					className="rounded-xl font-semibold text-sm py-3 px-4 text-[var(--error-600)] hover:bg-[var(--error-50)]"
				>
					Cerrar sesión
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}

// ========================================
// HEADER
// ========================================

function Header() {
	const router = useRouterState();
	const [scroll] = useWindowScroll();
	const isScrolled = scroll.y > 20;
	const isAdminSection = router.location.pathname.startsWith("/admin");

	const links = [
		{ label: "Inicio", link: "/" },
		{ label: "Agendar", link: "/agendar" },
	];

	// Hidden on admin routes
	if (isAdminSection) return null;

	return (
		<Box
			className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
			style={{
				padding: isScrolled ? 0 : "12px 20px 0",
			}}
		>
			<Box
				className={`mx-auto transition-all duration-300 ${
					isScrolled ? "max-w-[1600px]" : "max-w-[1600px]"
				}`}
			>
				<header
					className={`bg-white/95 backdrop-blur-xl border border-[var(--border-subtle)] transition-all duration-300 ${
						isScrolled
							? "rounded-none border-x-0 border-t-0 px-6 py-3.5 shadow-sm"
							: "rounded-2xl px-6 py-2.5 shadow-lg hover:shadow-xl"
					}`}
				>
					<Container size="xl" style={{ maxWidth: "100%" }}>
						<Group justify="space-between" align="center" wrap="nowrap">
							{/* Logo */}
							<Link
								to="/"
								className="flex items-center gap-3 no-underline group"
							>
								<div>
									<Title
										order={3}
										className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none"
									>
										SIMUT
									</Title>
									<Text className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-[0.15em] uppercase mt-0.5 leading-none">
										Tuluá
									</Text>
								</div>
							</Link>

							{/* Navigation */}
							<Group visibleFrom="sm" gap={8} wrap="nowrap">
								{links.map((link) => {
									const isActive =
										router.location.pathname === link.link ||
										(link.link !== "/" &&
											router.location.pathname.startsWith(link.link));
									return (
										<NavPill
											key={link.label}
											label={link.label}
											to={link.link}
											isActive={isActive}
										/>
									);
								})}
								<Box ml="md">
									<UserMenu />
								</Box>
							</Group>
						</Group>
					</Container>
				</header>
			</Box>
		</Box>
	);
}

// ========================================
// ROOT COMPONENT
// ========================================

function RootComponent() {
	return (
		<AppShell>
			<Header />
			<AppShell.Main className="pt-0">
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}
