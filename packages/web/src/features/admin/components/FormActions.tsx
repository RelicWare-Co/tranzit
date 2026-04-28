import { Button, type ButtonProps } from "@mantine/core";
import { cx } from "#/shared/lib/cx";

interface FormActionButtonProps extends Omit<ButtonProps, "onClick"> {
	variant?: "primary" | "secondary" | "danger" | "ghost";
	isLoading?: boolean;
	onClick?: () => void;
	children: React.ReactNode;
}

export function FormActionButton({
	variant = "primary",
	isLoading,
	children,
	className,
	...props
}: FormActionButtonProps) {
	const variantConfig = {
		primary: {
			color: "dark" as const,
			variant: "filled" as const,
			className:
				"bg-zinc-900 hover:bg-zinc-800 text-white border-transparent active:translate-y-[1px] active:scale-[0.98]",
		},
		secondary: {
			color: "gray" as const,
			variant: "light" as const,
			className:
				"bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-transparent active:translate-y-[1px]",
		},
		danger: {
			color: "red" as const,
			variant: "filled" as const,
			className:
				"bg-red-600 hover:bg-red-700 text-white border-transparent active:translate-y-[1px] active:scale-[0.98]",
		},
		ghost: {
			color: "gray" as const,
			variant: "subtle" as const,
			className:
				"text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50 active:translate-y-[1px]",
		},
	};

	const config = variantConfig[variant];

	return (
		<Button
			{...props}
			loading={isLoading}
			radius="lg"
			size="md"
			color={config.color}
			variant={config.variant}
			className={cx(
				"font-medium transition-all duration-150 ease-out",
				"will-change-transform",
				config.className,
				className,
			)}
			loaderProps={{ type: "dots", size: "sm" }}
		>
			{children}
		</Button>
	);
}

interface FormActionsProps {
	children: React.ReactNode;
	className?: string;
	align?: "left" | "right" | "center" | "between";
}

export function FormActions({
	children,
	className,
	align = "right",
}: FormActionsProps) {
	const alignClasses = {
		left: "justify-start",
		right: "justify-end",
		center: "justify-center",
		between: "justify-between",
	};

	return (
		<div
			className={cx(
				"flex items-center gap-3 pt-4",
				"border-t border-zinc-200/80",
				alignClasses[align],
				className,
			)}
		>
			{children}
		</div>
	);
}
