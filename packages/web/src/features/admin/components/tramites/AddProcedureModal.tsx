import { Alert, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	AlertCircle,
	FileText,
	FolderPlus,
	Link2,
	Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	FormActionButton,
	FormActions,
	FormField,
	FormSection,
	PremiumModal,
} from "#/features/admin/components";
import { cx } from "#/shared/lib/cx";
import type { ProcedureCreateInput } from "./types";

// Validaciones en tiempo real
const validators = {
	name: (value: string): string | null => {
		const trimmed = value.trim();
		if (!trimmed) return "El nombre es obligatorio";
		if (trimmed.length < 3) return "El nombre debe tener al menos 3 caracteres";
		if (trimmed.length > 120)
			return "El nombre no puede exceder 120 caracteres";
		return null;
	},
	slug: (value: string): string | null => {
		const trimmed = value.trim();
		if (!trimmed) return "El slug es obligatorio";
		if (trimmed.length < 2) return "El slug debe tener al menos 2 caracteres";
		if (trimmed.length > 60) return "El slug no puede exceder 60 caracteres";
		if (!/^[a-z0-9-]+$/.test(trimmed))
			return "El slug solo puede contener letras minúsculas, números y guiones";
		return null;
	},
	description: (value: string): string | null => {
		if (value.trim().length > 500)
			return "La descripción no puede exceder 500 caracteres";
		return null;
	},
};

// Sanitización de slug
function sanitizeSlug(slug: string): string {
	return slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// Generar slug desde nombre
function generateSlugFromName(name: string): string {
	return sanitizeSlug(
		name
			.toLowerCase()
			.replace(/[áàäâ]/g, "a")
			.replace(/[éèëê]/g, "e")
			.replace(/[íìïî]/g, "i")
			.replace(/[óòöô]/g, "o")
			.replace(/[úùüû]/g, "u")
			.replace(/[ñ]/g, "n")
			.replace(/[^a-z0-9\s-]/g, ""),
	);
}

interface AddProcedureModalProps {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: ProcedureCreateInput) => Promise<void>;
}

export function AddProcedureModal({
	opened,
	onClose,
	onCreate,
}: AddProcedureModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: "",
			slug: "",
			description: "",
			requiresVehicle: false,
			allowsPhysicalDocuments: true,
			allowsDigitalDocuments: false,
		},
	});

	// Reset form when modal opens
	useEffect(() => {
		if (opened) {
			form.reset();
			setSubmitError(null);
			setTouched({});
			setSlugManuallyEdited(false);
		}
	}, [opened, form.reset]);

	// Validación progresiva
	const values = form.getValues();

	const errors = useMemo(() => {
		return {
			name: touched.name ? validators.name(values.name) : null,
			slug: touched.slug ? validators.slug(values.slug) : null,
			description: touched.description
				? validators.description(values.description)
				: null,
		};
	}, [values, touched]);

	// Auto-generar slug desde nombre si no se ha editado manualmente
	useEffect(() => {
		if (!slugManuallyEdited && values.name.trim()) {
			const generatedSlug = generateSlugFromName(values.name);
			if (generatedSlug !== values.slug) {
				form.setFieldValue("slug", generatedSlug);
			}
		}
	}, [values.name, values.slug, slugManuallyEdited, form.setFieldValue]);

	const isValid = useMemo(() => {
		return (
			!validators.name(values.name) &&
			!validators.slug(values.slug) &&
			!validators.description(values.description) &&
			values.name.trim() !== "" &&
			values.slug.trim() !== ""
		);
	}, [values]);

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	const handleSubmit = async () => {
		// Marcar todos como touched para mostrar errores
		setTouched({ name: true, slug: true, description: true });

		if (!isValid) {
			return;
		}

		setSubmitError(null);
		setIsSubmitting(true);

		try {
			const payload: ProcedureCreateInput = {
				name: values.name.trim(),
				slug: values.slug.trim(),
				description: values.description.trim() || undefined,
				requiresVehicle: values.requiresVehicle,
				allowsPhysicalDocuments: values.allowsPhysicalDocuments,
				allowsDigitalDocuments: false,
			};
			await onCreate(payload);
			form.reset();
			onClose();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No se pudo crear el trámite";
			setSubmitError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const sanitized = sanitizeSlug(e.currentTarget.value);
		form.setFieldValue("slug", sanitized);
		setSlugManuallyEdited(true);
		setTouched((t) => ({ ...t, slug: true }));
	};

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title="Nuevo trámite"
			subtitle="Configura un nuevo tipo de trámite para la agenda ciudadana"
			size="lg"
		>
			<Stack gap="lg">
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
					title="Información básica"
					description="Datos identificativos del trámite"
					icon={
						<FolderPlus size={18} className="text-zinc-500" strokeWidth={1.5} />
					}
				>
					<Stack gap="md">
						<FormField
							label="Nombre del trámite"
							error={errors.name}
							helper="Ej: Renovación de Licencia de Conducción"
							required
						>
							<TextInput
								placeholder="Ingresa el nombre del trámite"
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
							label="Slug identificador"
							error={errors.slug}
							helper="Identificador único para URLs (se genera automáticamente desde el nombre)"
							required
						>
							<div className="relative">
								<TextInput
									placeholder="renovacion-licencia"
									radius="md"
									size="md"
									disabled={isSubmitting}
									value={values.slug}
									onChange={handleSlugChange}
									onBlur={() => setTouched((t) => ({ ...t, slug: true }))}
									error={errors.slug}
									leftSection={<Link2 size={14} className="text-zinc-400" />}
									className={cx(
										"transition-all duration-200",
										values.slug && !errors.slug && "border-emerald-500/50",
									)}
									styles={{
										input: {
											fontFamily: "monospace",
											fontSize: "0.875rem",
											"&:focus": {
												boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
											},
										},
									}}
								/>
							</div>
							{slugManuallyEdited && values.name && !values.slug && (
								<button
									type="button"
									onClick={() => {
										form.setFieldValue(
											"slug",
											generateSlugFromName(values.name),
										);
										setSlugManuallyEdited(false);
									}}
									className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 underline"
								>
									Restaurar slug automático
								</button>
							)}
						</FormField>

						<FormField
							label="Descripción"
							error={errors.description}
							helper="Descripción opcional para ayudar a los ciudadanos a entender el trámite"
						>
							<Textarea
								placeholder="Describe el propósito y requisitos del trámite..."
								radius="md"
								size="md"
								minRows={3}
								maxRows={5}
								disabled={isSubmitting}
								value={values.description}
								onChange={(e) => {
									form.setFieldValue("description", e.currentTarget.value);
									setTouched((t) => ({ ...t, description: true }));
								}}
								onBlur={() => setTouched((t) => ({ ...t, description: true }))}
								error={errors.description}
								className={cx(
									"transition-all duration-200",
									values.description &&
										!errors.description &&
										"border-emerald-500/50",
								)}
								styles={{
									input: {
										"&:focus": {
											boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
										},
									},
								}}
							/>
							<div className="flex justify-end">
								<span
									className={cx(
										"text-xs transition-colors",
										values.description.length > 450
											? "text-amber-600"
											: "text-zinc-400",
									)}
								>
									{values.description.length}/500
								</span>
							</div>
						</FormField>
					</Stack>
				</FormSection>

				<FormSection
					title="Configuración de documentos"
					description="La plataforma solo permite gestión física de requisitos para ciudadanos"
					icon={
						<FileText size={18} className="text-zinc-500" strokeWidth={1.5} />
					}
				>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/30">
							<div className="flex-1">
								<div className="font-medium text-sm text-zinc-900">
									Requisitos físicos habilitados
								</div>
								<div className="text-xs text-zinc-500 mt-0.5">
									Los ciudadanos deben llevar documentación y formatos impresos
									el día de la cita.
								</div>
							</div>
						</div>

						<div className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
							<div className="flex-1">
								<div className="font-medium text-sm text-zinc-900">
									Carga digital deshabilitada
								</div>
								<div className="text-xs text-zinc-500 mt-0.5">
									Por política vigente no se permite subir archivos del trámite
									desde el portal ciudadano.
								</div>
							</div>
						</div>
					</div>
				</FormSection>

				<FormSection
					title="Configuración adicional"
					description="Opciones específicas del trámite"
					icon={
						<Settings2 size={18} className="text-zinc-500" strokeWidth={1.5} />
					}
				>
					<div
						className={cx(
							"flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
							values.requiresVehicle
								? "border-orange-200 bg-orange-50/30"
								: "border-zinc-200 bg-zinc-50/50",
						)}
					>
						<Switch
							checked={values.requiresVehicle}
							onChange={(e) =>
								form.setFieldValue("requiresVehicle", e.currentTarget.checked)
							}
							size="sm"
							className="mt-0.5"
						/>
						<div className="flex-1">
							<div className="font-medium text-sm text-zinc-900">
								Requiere vehículo
							</div>
							<div className="text-xs text-zinc-500 mt-0.5">
								Este trámite involucra la revisión o registro de un vehículo
							</div>
						</div>
					</div>
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
						leftSection={<FileText size={16} strokeWidth={1.5} />}
					>
						Crear trámite
					</FormActionButton>
				</FormActions>
			</Stack>
		</PremiumModal>
	);
}
