import { Avatar, Box, Menu, Text, UnstyledButton } from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { ADMIN_ACCENT } from "../_shared/admin-ui";

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
				<UnstyledButton className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-zinc-200/90 bg-white py-1.5 pl-1.5 pr-4 shadow-[0_8px_22px_-14px_rgba(9,9,11,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:shadow-[0_14px_28px_-16px_rgba(9,9,11,0.4)] active:translate-y-0 active:scale-[0.99]">
					<Avatar
						size="md"
						radius="xl"
						style={{
							backgroundColor: "#fff1f2",
							border: `2px solid ${ADMIN_ACCENT}`,
							fontWeight: 700,
							fontSize: 13,
							color: ADMIN_ACCENT,
							boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
						}}
					>
						{initials}
					</Avatar>
					<Text
						className="hidden text-sm font-semibold tracking-tight text-zinc-600 sm:block"
						lineClamp={1}
						maw={140}
					>
						{user?.name || "Administrador"}
					</Text>
					<ChevronDown
						size={16}
						className="shrink-0 text-zinc-400"
						strokeWidth={1.75}
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
