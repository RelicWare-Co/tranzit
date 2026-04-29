import { Text } from "@mantine/core";
import * as React from "react";
import { cx } from "#/shared/lib/cx";

interface FormSectionProps {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	icon?: React.ReactNode;
}

export function FormSection({
	title,
	description,
	children,
	className,
	icon,
}: FormSectionProps) {
	return (
		<div className={cx("space-y-4", className)}>
			<div className="flex items-start gap-3">
				{icon && (
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200/80">
						{icon}
					</div>
				)}
				<div className="flex-1 space-y-1">
					<h3 className="text-base font-semibold tracking-tight text-zinc-900">
						{title}
					</h3>
					{description && (
						<p className="text-sm leading-relaxed text-zinc-500 max-w-[65ch]">
							{description}
						</p>
					)}
				</div>
			</div>
			<div className="pl-0 md:pl-[52px]">{children}</div>
		</div>
	);
}

interface FormFieldProps {
	label: string;
	children: React.ReactNode;
	error?: string | null | React.ReactNode;
	helper?: string;
	required?: boolean;
	className?: string;
	labelId?: string;
}

export function FormField({
	label,
	children,
	error,
	helper,
	required,
	className,
	labelId,
}: FormFieldProps) {
	const generatedId = React.useId();
	const fieldId = labelId || `field-${generatedId}`;

	return (
		<div className={cx("space-y-1.5", className)}>
			<div className="flex items-center gap-1">
				<label
					htmlFor={fieldId}
					id={`${fieldId}-label`}
					className="text-sm font-medium text-zinc-700"
				>
					{label}
					{required && (
						<span className="ml-0.5 text-red-600" aria-hidden="true">
							*
						</span>
					)}
				</label>
			</div>
			<div className="[&_input]:w-full [&_textarea]:w-full">{children}</div>
			{error ? (
				<Text size="xs" c="red.6" mt={4} id={`${fieldId}-error`}>
					{error}
				</Text>
			) : helper ? (
				<Text size="xs" c="gray.5" mt={4} id={`${fieldId}-helper`}>
					{helper}
				</Text>
			) : null}
		</div>
	);
}
