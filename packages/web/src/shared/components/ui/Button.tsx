/**
 * Button Component
 * Unified button system for TRAZIT
 */

import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			variant = "primary",
			size = "md",
			isLoading = false,
			leftIcon,
			rightIcon,
			fullWidth = false,
			disabled,
			className = "",
			...props
		},
		ref,
	) => {
		const baseClasses = "btn";
		const variantClasses = {
			primary: "btn-primary",
			secondary: "btn-secondary",
			ghost: "btn-ghost",
			success: "btn-success",
			danger: "btn-danger",
		};
		const sizeClasses = {
			sm: "btn-sm",
			md: "",
			lg: "btn-lg",
		};

		const classes = [
			baseClasses,
			variantClasses[variant],
			sizeClasses[size],
			fullWidth ? "w-full" : "",
			className,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<button
				ref={ref}
				className={classes}
				disabled={disabled || isLoading}
				{...props}
			>
				{isLoading ? (
					<>
						<Loader2
							size={size === "sm" ? 14 : size === "lg" ? 20 : 16}
							className="animate-spin"
						/>
						{children}
					</>
				) : (
					<>
						{leftIcon}
						{children}
						{rightIcon}
					</>
				)}
			</button>
		);
	},
);

Button.displayName = "Button";
