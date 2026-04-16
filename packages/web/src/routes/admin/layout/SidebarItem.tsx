import { UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

export function SidebarItem({
	icon: Icon,
	label,
	isActive,
	to,
}: {
	icon: ComponentType<{ size?: number; color?: string }>;
	label: string;
	isActive: boolean;
	to: string;
}) {
	return (
		<UnstyledButton
			component={Link}
			to={to}
			style={{
				display: "flex",
				alignItems: "center",
				gap: "12px",
				padding: "12px 16px",
				borderRadius: "12px",
				width: "100%",
				backgroundColor: isActive ? "#111827" : "transparent",
				color: isActive ? "#ffffff" : "#6b7280",
				transition: "all 200ms ease",
				fontWeight: isActive ? 600 : 500,
				fontSize: "14px",
				textDecoration: "none",
			}}
			onMouseEnter={(e) => {
				if (!isActive) {
					e.currentTarget.style.backgroundColor = "#f3f4f6";
					e.currentTarget.style.color = "#111827";
				}
			}}
			onMouseLeave={(e) => {
				if (!isActive) {
					e.currentTarget.style.backgroundColor = "transparent";
					e.currentTarget.style.color = "#6b7280";
				}
			}}
		>
			<Icon size={20} color={isActive ? "#ffffff" : "#9ca3af"} />
			{label}
		</UnstyledButton>
	);
}
