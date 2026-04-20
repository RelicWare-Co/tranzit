/**
 * Alert Component
 * Unified alert system for TRAZIT
 */

import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface AlertProps {
	title?: string;
	children: ReactNode;
	variant?: "success" | "warning" | "error" | "info";
	className?: string;
}

export function Alert({
	title,
	children,
	variant = "info",
	className = "",
}: AlertProps) {
	const baseClasses = "alert";
	const variantClasses = {
		success: "alert-success",
		warning: "alert-warning",
		error: "alert-error",
		info: "alert-info",
	};

	const icons = {
		success: <CheckCircle size={18} />,
		warning: <AlertTriangle size={18} />,
		error: <XCircle size={18} />,
		info: <Info size={18} />,
	};

	const classes = [baseClasses, variantClasses[variant], className]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes} role="alert">
			{title && (
				<div className="alert-title">
					{icons[variant]}
					{title}
				</div>
			)}
			<div className={title ? "alert-message" : ""}>{children}</div>
		</div>
	);
}
