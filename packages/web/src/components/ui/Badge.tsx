/**
 * Badge Component
 * Unified badge system for TRAZIT
 */

import type { ReactNode } from "react";

export interface BadgeProps {
	children: ReactNode;
	variant?: "neutral" | "brand" | "success" | "warning" | "error" | "info";
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function Badge({
	children,
	variant = "neutral",
	size = "md",
	className = "",
}: BadgeProps) {
	const baseClasses = "badge";
	const variantClasses = {
		neutral: "badge-neutral",
		brand: "badge-brand",
		success: "badge-success",
		warning: "badge-warning",
		error: "badge-error",
		info: "badge-info",
	};
	const sizeClasses = {
		sm: "badge-sm",
		md: "",
		lg: "badge-lg",
	};

	const classes = [
		baseClasses,
		variantClasses[variant],
		sizeClasses[size],
		className,
	]
		.filter(Boolean)
		.join(" ");

	return <span className={classes}>{children}</span>;
}
