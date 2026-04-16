import { Avatar, Box, Menu, Text, UnstyledButton } from "@mantine/core";
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
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					backdropFilter: "blur(20px)",
					border: "1px solid rgba(0, 0, 0, 0.08)",
					borderRadius: "20px",
					padding: "8px",
					boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)",
					minWidth: "220px",
				},
				arrow: {
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					border: "1px solid rgba(0, 0, 0, 0.08)",
				},
			}}
		>
			<Menu.Target>
				<UnstyledButton
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "10px",
						padding: "6px 20px 6px 6px",
						borderRadius: "9999px",
						backgroundColor: "#ffffff",
						border: "1.5px solid rgba(0, 0, 0, 0.08)",
						boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
						transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
						cursor: "pointer",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
						e.currentTarget.style.transform = "translateY(-1px)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
						e.currentTarget.style.transform = "translateY(0)";
					}}
				>
					<Avatar
						size="md"
						radius="xl"
						color="#e03131"
						style={{
							backgroundColor: "#fef2f2",
							border: "2px solid #e03131",
							fontWeight: 700,
							fontSize: "13px",
							boxShadow: "0 2px 4px rgba(224, 49, 49, 0.1)",
						}}
					>
						{initials}
					</Avatar>
					<Text
						style={{
							fontSize: "14px",
							fontWeight: 600,
							color: "#4b5563",
							letterSpacing: "-0.2px",
						}}
					>
						Administrador
					</Text>
					<ChevronDown
						size={16}
						color="#9ca3af"
						style={{
							transition: "transform 300ms ease",
						}}
						className="chevron-icon"
					/>
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={
						<Box
							style={{
								width: "32px",
								height: "32px",
								borderRadius: "10px",
								backgroundColor: "#f3f4f6",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Shield size={16} color="#6b7280" />
						</Box>
					}
					style={{
						borderRadius: "12px",
						fontWeight: 600,
						fontSize: "14px",
						padding: "12px 16px",
						color: "#111827",
						transition: "all 200ms ease",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "#f9fafb";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
					}}
				>
					Ver mi perfil
				</Menu.Item>
				<Menu.Divider
					style={{
						margin: "6px 8px",
						borderColor: "rgba(0, 0, 0, 0.06)",
					}}
				/>
				<Menu.Item
					leftSection={
						<Box
							style={{
								width: "32px",
								height: "32px",
								borderRadius: "10px",
								backgroundColor: "#fef2f2",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<LogOut size={16} color="#e03131" />
						</Box>
					}
					onClick={handleLogout}
					style={{
						borderRadius: "12px",
						fontWeight: 600,
						fontSize: "14px",
						padding: "12px 16px",
						color: "#e03131",
						transition: "all 200ms ease",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "#fef2f2";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
					}}
				>
					Cerrar sesión
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
