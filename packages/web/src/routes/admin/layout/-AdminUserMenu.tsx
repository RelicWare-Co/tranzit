import { Menu, UnstyledButton } from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";

/**
 * Menú de usuario en navbar administrativa.
 * Muestra avatar con iniciales, nombre y dropdown con opciones.
 */
export function AdminUserMenu() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const initials = user?.name
		? user.name
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: user?.email?.[0].toUpperCase() || "U";

	const handleLogout = () => {
		void logout()
			.then(() => {
				navigate({ to: "/" });
			})
			.catch(() => {});
	};

	return (
		<Menu
			position="bottom-end"
			offset={6}
			withArrow
			arrowPosition="center"
			styles={{
				dropdown: {
					backgroundColor: "var(--bg-elevated)",
					border: "1px solid var(--border-subtle)",
					borderRadius: 8,
					padding: 4,
					boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.12)",
					minWidth: 200,
				},
				arrow: {
					backgroundColor: "var(--bg-elevated)",
					border: "1px solid var(--border-subtle)",
				},
			}}
		>
			<Menu.Target>
				<UnstyledButton className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border-0 bg-[var(--bg-secondary)] px-2 py-1 text-left text-sm font-medium shadow-none outline-none transition-all duration-150 hover:bg-[var(--bg-tertiary)]">
					<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--brand-200)] font-['Public_Sans'] text-xs font-semibold text-[var(--brand-700)]">
						{initials}
					</div>
					<span className="hidden max-w-[120px] truncate text-[var(--text-secondary)] sm:inline">
						{user?.name || "Administrador"}
					</span>
					<ChevronDown
						size={14}
						className="shrink-0 text-[var(--text-tertiary)]"
						strokeWidth={1.75}
					/>
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={
						<div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--bg-secondary)]">
							<Shield
								size={14}
								className="text-[var(--text-secondary)]"
								strokeWidth={1.75}
							/>
						</div>
					}
					className="rounded-md py-2 text-sm font-medium text-[var(--text-primary)]"
					styles={{
						item: {
							borderRadius: 6,
							padding: "8px 10px",
						},
					}}
				>
					Ver mi perfil
				</Menu.Item>
				<Menu.Divider className="border-[var(--border-subtle)]" />
				<Menu.Item
					leftSection={
						<div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--brand-100)]">
							<LogOut
								size={14}
								className="text-[var(--brand-700)]"
								strokeWidth={1.75}
							/>
						</div>
					}
					onClick={handleLogout}
					className="rounded-md py-2 text-sm font-medium text-[var(--brand-700)]"
					styles={{
						item: {
							borderRadius: 6,
							padding: "8px 10px",
						},
					}}
				>
					Cerrar sesión
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
