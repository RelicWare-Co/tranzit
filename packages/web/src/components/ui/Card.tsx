/**
 * Card Component
 * Unified card system for TRAZIT
 */

import type { CSSProperties, ReactNode } from "react";

export interface CardProps {
	children: ReactNode;
	variant?: "default" | "inset" | "elevated";
	padding?: "none" | "sm" | "md" | "lg" | "xl";
	className?: string;
	style?: CSSProperties;
}

export function Card({
	children,
	variant = "default",
	padding = "md",
	className = "",
	style,
}: CardProps) {
	const variantClasses = {
		default: "surface",
		inset: "surface-inset",
		elevated: "surface-elevated",
	};

	const paddingClasses = {
		none: "",
		sm: "p-3",
		md: "p-4",
		lg: "p-6",
		xl: "p-8",
	};

	const classes = [variantClasses[variant], paddingClasses[padding], className]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes} style={style}>
			{children}
		</div>
	);
}

// Card Header subcomponent
export function CardHeader({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={`mb-4 ${className}`}>{children}</div>;
}

// Card Title subcomponent
export function CardTitle({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<h3
			className={`text-lg font-semibold tracking-tight text-[var(--text-primary)] ${className}`}
		>
			{children}
		</h3>
	);
}

// Card Description subcomponent
export function CardDescription({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p className={`mt-1 text-sm text-[var(--text-secondary)] ${className}`}>
			{children}
		</p>
	);
}

// Card Content subcomponent
export function CardContent({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={className}>{children}</div>;
}

// Card Footer subcomponent
export function CardFooter({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4 ${className}`}
		>
			{children}
		</div>
	);
}
