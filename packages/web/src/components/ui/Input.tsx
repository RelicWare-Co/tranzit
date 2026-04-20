/**
 * Input Component
 * Unified input system for TRAZIT
 */

import { AlertCircle } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	label?: string;
	hint?: string;
	error?: string;
	size?: "sm" | "md" | "lg";
	fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			label,
			hint,
			error,
			size = "md",
			fullWidth = true,
			className = "",
			id,
			...props
		},
		ref,
	) => {
		const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

		const sizeClasses = {
			sm: "input-sm",
			md: "",
			lg: "input-lg",
		};

		const inputClasses = [
			"input",
			sizeClasses[size],
			error ? "input-error" : "",
			className,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div className={fullWidth ? "w-full" : ""}>
				{label && (
					<label htmlFor={inputId} className="form-label">
						{label}
					</label>
				)}
				<input ref={ref} id={inputId} className={inputClasses} {...props} />
				{error && (
					<div className="form-error">
						<AlertCircle size={12} />
						{error}
					</div>
				)}
				{hint && !error && <p className="form-hint">{hint}</p>}
			</div>
		);
	},
);

Input.displayName = "Input";
