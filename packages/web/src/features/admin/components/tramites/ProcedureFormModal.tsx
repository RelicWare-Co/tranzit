import { Alert, Badge, Button, Tabs } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import {
	AlertCircle,
	ClipboardList,
	FileCheck2,
	FileText,
	Info,
	Save,
} from "lucide-react";
import { useRef, useState } from "react";
import { PremiumModal } from "#/features/admin/components/PremiumModal";
import {
	CitizenFormPanel,
	GeneralPanel,
	RequirementsPanel,
} from "./ProcedureFormPanels";
import {
	buildProcedurePayload,
	createProcedureFormValues,
	findBuilderError,
	type ProcedureFormPayload,
	tabForFieldPath,
} from "./procedure-form-model";
import classes from "./Tramites.module.css";
import type { ProcedureType } from "./types";
import { generateSlugFromName, sanitizeSlug } from "./utils";

interface ProcedureFormModalProps {
	opened: boolean;
	onClose: () => void;
	mode: "create" | "edit";
	procedure?: ProcedureType;
	onSubmit: (payload: ProcedureFormPayload) => Promise<void>;
}

export function ProcedureFormModal(props: ProcedureFormModalProps) {
	const sessionKey = `${props.mode}-${props.procedure?.id ?? "new"}-${props.opened ? "open" : "closed"}`;
	return <ProcedureFormDialog key={sessionKey} {...props} />;
}

function ProcedureFormDialog({
	opened,
	onClose,
	mode,
	procedure,
	onSubmit,
}: ProcedureFormModalProps) {
	const isCreate = mode === "create";
	const isMobile = useMediaQuery("(max-width: 47.99em)");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
	const [activeTab, setActiveTab] = useState<string | null>("general");
	const nameInputRef = useRef<HTMLInputElement>(null);
	const slugInputRef = useRef<HTMLInputElement>(null);

	const form = useForm({
		mode: "controlled",
		initialValues: createProcedureFormValues(procedure),
		validate: {
			name: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return "El nombre es obligatorio";
				if (trimmed.length < 3) {
					return "El nombre debe tener al menos 3 caracteres";
				}
				if (trimmed.length > 120) {
					return "El nombre no puede exceder 120 caracteres";
				}
				return null;
			},
			slug: (value) => {
				if (!isCreate) return null;
				const trimmed = value.trim();
				if (!trimmed) return "El identificador es obligatorio";
				if (trimmed.length < 2) {
					return "El identificador debe tener al menos 2 caracteres";
				}
				if (trimmed.length > 60) {
					return "El identificador no puede exceder 60 caracteres";
				}
				if (!/^[a-z0-9-]+$/.test(trimmed)) {
					return "Usa únicamente letras minúsculas, números y guiones";
				}
				return null;
			},
			description: (value) =>
				value.trim().length > 500
					? "La descripción no puede exceder 500 caracteres"
					: null,
			instructions: (value) =>
				value.trim().length > 2000
					? "Las instrucciones no pueden exceder 2000 caracteres"
					: null,
		},
	});

	const focusField = (path: string) => {
		requestAnimationFrame(() => {
			if (path === "name") {
				nameInputRef.current?.focus();
				return;
			}
			if (path === "slug") {
				slugInputRef.current?.focus();
				return;
			}
			document
				.querySelector<HTMLElement>(`[data-procedure-field="${path}"]`)
				?.focus();
		});
	};

	const handleInvalidSubmit = (errors: typeof form.errors) => {
		const firstPath = Object.keys(errors)[0];
		if (!firstPath) return;
		setActiveTab(tabForFieldPath(firstPath));
		focusField(firstPath);
	};

	const handleSubmit = async (values: typeof form.values) => {
		const builderError = findBuilderError(values);
		if (builderError) {
			form.setFieldError(builderError.path, builderError.message);
			setActiveTab(builderError.tab);
			focusField(builderError.path);
			return;
		}

		setSubmitError(null);
		setIsSubmitting(true);
		try {
			await onSubmit(buildProcedurePayload(values));
			onClose();
		} catch (error) {
			setSubmitError(
				error instanceof Error
					? error.message
					: isCreate
						? "No se pudo crear el trámite"
						: "No se pudo actualizar el trámite",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const name = event.currentTarget.value;
		form.setFieldValue("name", name);
		if (!slugManuallyEdited && isCreate) {
			form.setFieldValue("slug", generateSlugFromName(name));
		}
	};

	const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		form.setFieldValue("slug", sanitizeSlug(event.currentTarget.value));
		setSlugManuallyEdited(true);
	};

	const handleRestoreSlug = () => {
		form.setFieldValue("slug", generateSlugFromName(form.values.name));
		form.clearFieldError("slug");
		setSlugManuallyEdited(false);
	};

	const handleClose = () => {
		if (!isSubmitting) onClose();
	};

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title={
				isCreate ? "Crear trámite" : `Editar ${procedure?.name ?? "trámite"}`
			}
			subtitle={
				isCreate
					? "Define la información, los requisitos y los datos que solicitará la agenda ciudadana."
					: "Actualiza la experiencia ciudadana sin cambiar el identificador del trámite."
			}
			size="2xl"
			fullScreen={isMobile}
			closeOnClickOutside={!isSubmitting}
			closeOnEscape={!isSubmitting}
			classNames={{
				content: classes.editorModalContent,
				header: classes.editorModalHeader,
				body: classes.editorModalBody,
			}}
		>
			<form
				onSubmit={form.onSubmit(handleSubmit, handleInvalidSubmit)}
				className={classes.modalForm}
				noValidate
			>
				{submitError ? (
					<Alert
						color="red"
						variant="light"
						icon={<AlertCircle size={17} aria-hidden="true" />}
						role="alert"
						className={classes.submitAlert}
					>
						{submitError}
					</Alert>
				) : null}

				<Tabs
					value={activeTab}
					onChange={setActiveTab}
					classNames={{
						root: classes.editorTabs,
						list: classes.editorTabsList,
						tab: classes.editorTab,
						panel: classes.editorTabPanel,
					}}
				>
					<Tabs.List aria-label="Secciones del trámite">
						<Tabs.Tab
							value="general"
							leftSection={<Info size={16} aria-hidden="true" />}
						>
							Información
						</Tabs.Tab>
						<Tabs.Tab
							value="requirements"
							leftSection={<FileCheck2 size={16} aria-hidden="true" />}
							rightSection={
								<Badge variant="light" color="gray" size="sm">
									{form.values.requirements.length}
								</Badge>
							}
						>
							Requisitos
						</Tabs.Tab>
						<Tabs.Tab
							value="form"
							leftSection={<ClipboardList size={16} aria-hidden="true" />}
							rightSection={
								<Badge variant="light" color="gray" size="sm">
									{form.values.formFields.length}
								</Badge>
							}
						>
							Formulario ciudadano
						</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panel value="general">
						<GeneralPanel
							form={form}
							isCreate={isCreate}
							isSubmitting={isSubmitting}
							slugManuallyEdited={slugManuallyEdited}
							nameInputRef={nameInputRef}
							slugInputRef={slugInputRef}
							onNameChange={handleNameChange}
							onSlugChange={handleSlugChange}
							onRestoreSlug={handleRestoreSlug}
						/>
					</Tabs.Panel>
					<Tabs.Panel value="requirements">
						<RequirementsPanel form={form} isSubmitting={isSubmitting} />
					</Tabs.Panel>
					<Tabs.Panel value="form">
						<CitizenFormPanel form={form} isSubmitting={isSubmitting} />
					</Tabs.Panel>
				</Tabs>

				<div className={classes.modalActions}>
					<div className={classes.modalActionHint}>
						<FileText size={15} aria-hidden="true" />
						<span>Los cambios aplican a nuevas solicitudes ciudadanas.</span>
					</div>
					<div className={classes.modalActionButtons}>
						<Button
							type="button"
							variant="default"
							onClick={handleClose}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							color="red"
							loading={isSubmitting}
							leftSection={
								isCreate ? (
									<FileText size={16} aria-hidden="true" />
								) : (
									<Save size={16} aria-hidden="true" />
								)
							}
						>
							{isCreate ? "Crear trámite" : "Guardar cambios"}
						</Button>
					</div>
				</div>
			</form>
		</PremiumModal>
	);
}
