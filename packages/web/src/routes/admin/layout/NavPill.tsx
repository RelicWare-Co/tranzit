import { Link } from "@tanstack/react-router";

export function NavPill({
	label,
	to,
	isActive,
}: {
	label: string;
	to: string;
	isActive: boolean;
}) {
	return (
		<Link
			to={to}
			style={{
				textDecoration: "none",
				padding: "10px 20px",
				borderRadius: "9999px",
				fontWeight: 600,
				fontSize: "14px",
				letterSpacing: "-0.2px",
				color: isActive ? "#111827" : "#6b7280",
				backgroundColor: isActive ? "#f3f4f6" : "transparent",
				transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
				display: "inline-block",
			}}
			onMouseEnter={(e) => {
				if (!isActive) {
					e.currentTarget.style.backgroundColor = "#f9fafb";
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
			{label}
		</Link>
	);
}
