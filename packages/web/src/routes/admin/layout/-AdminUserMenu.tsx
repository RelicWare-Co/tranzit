import { Avatar, Box, Menu, UnstyledButton } from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";

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
			offset={8}
			withArrow
			arrowPosition="center"
			styles={{
				dropdown: {
					backgroundColor: "rgba(255, 255, 255, 0.96)",
					backdropFilter: "blur(16px)",
					border: "1px solid rgba(24, 24, 27, 0.08)",
					borderRadius: 16,
					padding: 8,
					boxShadow:
						"0 24px 48px -20px rgba(9, 9, 11, 0.28), inset 0 1px 0 rgba(255,255,255,0.7)",
					minWidth: 228,
				},
				arrow: {
					backgroundColor: "rgba(255, 255, 255, 0.96)",
					border: "1px solid rgba(24, 24, 27, 0.08)",
				},
			}}
		>
			<Menu.Target>
				<UnstyledButton className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-white py-1 pl-1.5 pr-2.5 text-left font-sans shadow-none outline-none transition-[background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-zinc-100 active:bg-zinc-200">
					<Avatar
						size="sm"
						radius="md"
						classNames={{ root: "border-0 bg-zinc-100" }}
						styles={{
							root: {
								fontWeight: 600,
								fontSize: 11,
								color: "#3f3f46",
							},
						}}
					>
						{initials}
					</Avatar>
					<span className="hidden max-w-[140px] truncate text-sm font-medium leading-normal text-zinc-700 sm:inline">
						{user?.name || "Administrador"}
					</span>
					<ChevronDown
						size={15}
						className="shrink-0 text-zinc-500"
						strokeWidth={1.5}
					/>
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={
						<Box className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-zinc-100">
							<Shield size={16} className="text-zinc-600" strokeWidth={1.75} />
						</Box>
					}
					className="rounded-xl font-semibold text-zinc-900"
					styles={{
						item: {
							borderRadius: 12,
							padding: "10px 12px",
						},
					}}
				>
					Ver mi perfil
				</Menu.Item>
				<Menu.Divider className="border-zinc-200/90" />
				<Menu.Item
					leftSection={
						<Box className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-red-50">
							<LogOut size={16} className="text-red-700" strokeWidth={1.75} />
						</Box>
					}
					onClick={handleLogout}
					className="rounded-xl font-semibold text-red-700"
					styles={{
						item: {
							borderRadius: 12,
							padding: "10px 12px",
						},
					}}
				>
					Cerrar sesión
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
