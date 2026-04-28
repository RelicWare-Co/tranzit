import { Alert, NumberInput, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AlertCircle, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	FormActionButton,
	FormActions,
	FormField,
	FormSection,
	PremiumModal,
} from "#/features/admin/components";
import { cx } from "#/shared/lib/cx";
import type { CreateStaffPayload } from "./-types";

// Validaciones en tiempo real
const validators = {
	name: (value: string): string | null => {
		const trimmed = value.trim();
		if (!trimmed) return "El nombre es obligatorio";
		if (trimmed.length < 3) return "El nombre debe tener al menos 3 caracteres";
		if (trimmed.length > 100)
			return "El nombre no puede exceder 100 caracteres";
		if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(trimmed))
			return "El nombre solo puede contener letras y espacios";
		return null;
	},
	email: (value: string): string | null => {
		const trimmed = value.trim().toLowerCase();
		if (!trimmed) return "El correo electrónico es obligatorio";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
			return "Ingresa un correo electrónico válido";
		if (trimmed.length > 255)
			return "El correo no puede exceder 255 caracteres";
		return null;
	},
	capacity: (value: number | ""): string | null => {
		if (value === "" || value === undefined || value === null)
			return "La capacidad es obligatoria";
		if (typeof value !== "number") return "Ingresa un número válido";
		if (!Number.isInteger(value))
			return "La capacidad debe ser un número entero";
		if (value < 1) return "La capacidad debe ser al menos 1";
		if (value > 100) return "La capacidad no puede exceder 100";
		return null;
	},
};

interface AddStaffModalProps {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: CreateStaffPayload) => Promise<void>;
}

export function AddStaffModal({
	opened,
	onClose,
	onCreate,
}: AddStaffModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			email: "",
			capacity: 25 as number | "",
		},
	});

	// Reset form when modal opens
	useEffect(() => {
		if (opened) {
			form.reset();
			setSubmitError(null);
			setTouched({});
		}
	}, [opened, form.reset]);

	// Validación progresiva
	const values = form.getValues();

	const errors = useMemo(() => {
		return {
			name: touched.name ? validators.name(values.name) : null,
			email: touched.email ? validators.email(values.email) : null,
			capacity: touched.capacity ? validators.capacity(values.capacity) : null,
		};
	}, [values, touched]);

	const isValid = useMemo(() => {
		return (
			!validators.name(values.name) &&
			!validators.email(values.email) &&
			!validators.capacity(values.capacity) &&
			values.name.trim() !== "" &&
			values.email.trim() !== ""
		);
	}, [values]);

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	const handleSubmit = async () => {
		// Marcar todos como touched para mostrar errores
		setTouched({ name: true, email: true, capacity: true });

		if (!isValid) {
			return;
		}

		setSubmitError(null);
		setIsSubmitting(true);

		try {
			await onCreate({
				name: values.name.trim(),
				email: values.email.trim().toLowerCase(),
				capacity: typeof values.capacity === "number" ? values.capacity : 25,
			});
			form.reset();
			onClose();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "No se pudo crear el encargado";
			setSubmitError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title="Nuevo encargado"
			subtitle="Completa los datos para crear un nuevo funcionario en el sistema"
			size="md"
		>
			<Stack gap="md">
				{submitError && (
					<Alert
						color="red"
						variant="light"
						radius="md"
						icon={<AlertCircle size={16} />}
					>
						{submitError}
					</Alert>
				)}

				<FormSection
					title="Información personal"
					description="Datos básicos de identificación del funcionario"
					icon={<Users size={18} className="text-zinc-500" strokeWidth={1.5} />}
				>
					<Stack gap="sm">
						<FormField
							label="Nombre completo"
							error={errors.name}
							helper="Ej: María Elena Vargas"
							required
						>
							<TextInput
								placeholder="Ingresa el nombre completo"
								radius="md"
								size="md"
								disabled={isSubmitting}
								value={values.name}
								onChange={(e) => {
									form.setFieldValue("name", e.currentTarget.value);
									setTouched((t) => ({ ...t, name: true }));
								}}
								onBlur={() => setTouched((t) => ({ ...t, name: true }))}
								error={errors.name}
								className={cx(
									"transition-all duration-200",
									values.name && !errors.name && "border-emerald-500/50",
								)}
								styles={{
									input: {
										"&:focus": {
											boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
										},
									},
								}}
							/>
						</FormField>

						<FormField
							label="Correo electrónico"
							error={errors.email}
							helper="Se usará para notificaciones y acceso al sistema"
							required
						>
							<TextInput
								placeholder="ejemplo@simut.gov.co"
								type="email"
								radius="md"
								size="md"
								disabled={isSubmitting}
								value={values.email}
								onChange={(e) => {
									form.setFieldValue("email", e.currentTarget.value);
									setTouched((t) => ({ ...t, email: true }));
								}}
								onBlur={() => setTouched((t) => ({ ...t, email: true }))}
								error={errors.email}
								className={cx(
									"transition-all duration-200",
									values.email && !errors.email && "border-emerald-500/50",
								)}
								styles={{
									input: {
										"&:focus": {
											boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
										},
									},
								}}
							/>
						</FormField>
					</Stack>
				</FormSection>

				<FormSection
					title="Configuración operativa"
					description="Define la capacidad de atención diaria del funcionario"
					icon={
						<UserPlus size={18} className="text-zinc-500" strokeWidth={1.5} />
					}
				>
					<FormField
						label="Capacidad diaria máxima"
						error={errors.capacity}
						helper="Número máximo de citas que puede atender por día"
						required
					>
						<NumberInput
							placeholder="25"
							min={1}
							max={100}
							radius="md"
							size="md"
							disabled={isSubmitting}
							value={values.capacity}
							onChange={(val) => {
								form.setFieldValue("capacity", val === "" ? "" : Number(val));
								setTouched((t) => ({ ...t, capacity: true }));
							}}
							onBlur={() => setTouched((t) => ({ ...t, capacity: true }))}
							error={errors.capacity}
							className={cx(
								"transition-all duration-200",
								values.capacity && !errors.capacity && "border-emerald-500/50",
							)}
							styles={{
								input: {
									"&:focus": {
										boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
									},
								},
							}}
						/>
					</FormField>
				</FormSection>

				<FormActions align="right">
					<FormActionButton
						variant="secondary"
						onClick={handleClose}
						disabled={isSubmitting}
					>
						Cancelar
					</FormActionButton>
					<FormActionButton
						variant="primary"
						isLoading={isSubmitting}
						onClick={handleSubmit}
						disabled={!isValid}
						leftSection={<UserPlus size={16} strokeWidth={1.5} />}
					>
						Crear encargado
					</FormActionButton>
				</FormActions>
			</Stack>
		</PremiumModal>
	);
}
