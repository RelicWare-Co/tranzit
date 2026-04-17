import {
	NumberInput,
	type NumberInputProps,
	TextInput,
	type TextInputProps,
} from "@mantine/core";
import { useState } from "react";
import { cx } from "../../../utils/cx";

interface SmartTextInputProps extends Omit<TextInputProps, "onChange"> {
	maxLength?: number;
	showCounter?: boolean;
	onChange?: (value: string) => void;
	transform?: (value: string) => string;
	validate?: (value: string) => string | null;
	debounceMs?: number;
}

export function SmartTextInput({
	maxLength,
	showCounter = true,
	onChange,
	transform,
	validate,
	value,
	defaultValue,
	className,
	debounceMs = 0,
	error,
	...props
}: SmartTextInputProps) {
	const [localValue, setLocalValue] = useState<string>(
		(value as string) ?? (defaultValue as string) ?? "",
	);
	const [localError, setLocalError] = useState<string | null>(null);
	const [isDirty, setIsDirty] = useState(false);

	const displayValue = value !== undefined ? (value as string) : localValue;
	const displayError = error ?? localError;

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		let newValue = event.currentTarget.value;

		// Apply transformation if provided
		if (transform) {
			newValue = transform(newValue);
		}

		// Enforce maxLength
		if (maxLength && newValue.length > maxLength) {
			newValue = newValue.slice(0, maxLength);
		}

		setLocalValue(newValue);
		setIsDirty(true);

		// Validate if validator provided
		if (validate) {
			const validationError = validate(newValue);
			setLocalError(validationError);
		}

		if (debounceMs > 0) {
			setTimeout(() => {
				onChange?.(newValue);
			}, debounceMs);
		} else {
			onChange?.(newValue);
		}
	};

	return (
		<div className="space-y-1">
			<TextInput
				{...props}
				value={displayValue}
				onChange={handleChange}
				error={displayError}
				className={cx(
					"transition-all duration-200",
					isDirty && !displayError && displayValue && "border-emerald-500/50",
					className,
				)}
				radius="lg"
				size="md"
				styles={{
					input: {
						"&:focus": {
							boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
						},
					},
				}}
			/>
			{showCounter && maxLength && (
				<div className="flex justify-end">
					<span
						className={cx(
							"text-xs transition-colors",
							displayValue.length > maxLength * 0.9
								? "text-amber-600"
								: "text-zinc-400",
						)}
					>
						{displayValue.length}/{maxLength}
					</span>
				</div>
			)}
		</div>
	);
}

type NumberInputValue<T> = T | "" | string;

interface SmartNumberInputProps extends Omit<NumberInputProps, "onChange"> {
	onChange?: (value: number | "") => void;
	helper?: string;
	min?: number;
	max?: number;
}

export function SmartNumberInput({
	onChange,
	helper,
	min,
	max,
	value,
	className,
	...props
}: SmartNumberInputProps) {
	const handleChange = (val: NumberInputValue<number>) => {
		let newVal: number | "" = val === "" ? "" : Number(val);
		if (typeof newVal === "number" && !Number.isNaN(newVal)) {
			if (min !== undefined && newVal < min) newVal = min;
			if (max !== undefined && newVal > max) newVal = max;
		}
		onChange?.(newVal);
	};

	return (
		<div className="space-y-1">
			<NumberInput
				{...props}
				value={value}
				onChange={handleChange}
				min={min}
				max={max}
				className={cx("transition-all duration-200", className)}
				radius="lg"
				size="md"
				styles={{
					input: {
						"&:focus": {
							boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
						},
					},
				}}
			/>
			{helper && <span className="text-xs text-zinc-500">{helper}</span>}
		</div>
	);
}
