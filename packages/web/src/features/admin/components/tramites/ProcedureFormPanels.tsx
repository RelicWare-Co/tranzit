import {
	ActionIcon,
	Button,
	Select,
	Switch,
	Text,
	Textarea,
	TextInput,
	Tooltip,
} from "@mantine/core";
import {
	ArrowDown,
	ArrowUp,
	ClipboardList,
	FileCheck2,
	Link2,
	Plus,
	RotateCcw,
	Trash2,
} from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import {
	FIELD_TYPE_OPTIONS,
	type ProcedureEditorForm,
	type ProcedureFormField,
} from "./procedure-form-model";
import classes from "./Tramites.module.css";
import { generateId } from "./utils";

interface GeneralPanelProps {
	form: ProcedureEditorForm;
	isCreate: boolean;
	isSubmitting: boolean;
	slugManuallyEdited: boolean;
	nameInputRef: RefObject<HTMLInputElement | null>;
	slugInputRef: RefObject<HTMLInputElement | null>;
	onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onSlugChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onRestoreSlug: () => void;
}

export function GeneralPanel({
	form,
	isCreate,
	isSubmitting,
	slugManuallyEdited,
	nameInputRef,
	slugInputRef,
	onNameChange,
	onSlugChange,
	onRestoreSlug,
}: GeneralPanelProps) {
	return (
		<div className={classes.panelStack}>
			<section
				className={classes.formSection}
				aria-labelledby="procedure-identity"
			>
				<SectionHeading
					id="procedure-identity"
					title="Identidad del trámite"
					description="Así se reconocerá el trámite en el portal ciudadano y en la operación interna."
				/>
				<div className={classes.identityGrid}>
					<TextInput
						ref={nameInputRef}
						label="Nombre del trámite"
						description="Usa el nombre oficial que reconocerá la ciudadanía."
						placeholder="Ingresa el nombre del trámite"
						withAsterisk
						disabled={isSubmitting}
						value={form.values.name}
						onChange={onNameChange}
						onBlur={() => form.validateField("name")}
						error={form.errors.name}
						data-procedure-field="name"
					/>

					{isCreate ? (
						<div className={classes.slugField}>
							<TextInput
								ref={slugInputRef}
								label="Identificador"
								description="Se usa internamente y se genera desde el nombre."
								placeholder="renovacion-licencia"
								withAsterisk
								disabled={isSubmitting}
								value={form.values.slug}
								onChange={onSlugChange}
								onBlur={() => form.validateField("slug")}
								error={form.errors.slug}
								leftSection={<Link2 size={15} aria-hidden="true" />}
								classNames={{ input: classes.slugInput }}
								data-procedure-field="slug"
							/>
							{slugManuallyEdited ? (
								<Button
									type="button"
									variant="subtle"
									color="gray"
									size="compact-xs"
									leftSection={<RotateCcw size={13} aria-hidden="true" />}
									onClick={onRestoreSlug}
									disabled={isSubmitting || !form.values.name}
									className={classes.restoreSlug}
								>
									Restaurar automático
								</Button>
							) : null}
						</div>
					) : (
						<div className={classes.readOnlySlug}>
							<Text size="xs" fw={600} c="dimmed">
								IDENTIFICADOR
							</Text>
							<code>{form.values.slug}</code>
							<Text size="xs" c="dimmed">
								El identificador no cambia después de crear el trámite.
							</Text>
						</div>
					)}
				</div>

				<Textarea
					label="Descripción para el ciudadano"
					description="Resume el propósito del trámite y ayuda a elegirlo correctamente."
					placeholder="Describe qué puede resolver el ciudadano con este trámite..."
					rows={4}
					disabled={isSubmitting}
					value={form.values.description}
					onChange={(event) =>
						form.setFieldValue("description", event.currentTarget.value)
					}
					onBlur={() => form.validateField("description")}
					error={form.errors.description}
					data-procedure-field="description"
				/>
				<Text
					size="xs"
					c={form.values.description.length > 450 ? "orange.7" : "dimmed"}
					className={classes.characterCount}
				>
					{form.values.description.length}/500
				</Text>
			</section>

			<section
				className={classes.formSection}
				aria-labelledby="procedure-guidance"
			>
				<SectionHeading
					id="procedure-guidance"
					title="Orientación previa"
					description="Indica lo que la persona debe saber antes de reservar su cita."
				/>
				<Textarea
					label="Instrucciones"
					description="Incluye pasos, recomendaciones o condiciones importantes."
					placeholder="Ejemplo: presenta el documento de identidad original y llega 15 minutos antes..."
					rows={6}
					disabled={isSubmitting}
					value={form.values.instructions}
					onChange={(event) =>
						form.setFieldValue("instructions", event.currentTarget.value)
					}
					onBlur={() => form.validateField("instructions")}
					error={form.errors.instructions}
					data-procedure-field="instructions"
				/>
			</section>

			<section
				className={classes.formSection}
				aria-labelledby="procedure-rules"
			>
				<SectionHeading
					id="procedure-rules"
					title="Reglas operativas"
					description="Define qué debe llevar el ciudadano y si el vehículo participa en la atención."
				/>
				<div className={classes.switchList}>
					<Switch
						label="Requiere vehículo"
						description="Actívalo cuando el vehículo deba presentarse, revisarse o registrarse durante la cita."
						checked={form.values.requiresVehicle}
						onChange={(event) =>
							form.setFieldValue("requiresVehicle", event.currentTarget.checked)
						}
						disabled={isSubmitting}
						classNames={{ root: classes.switchRow }}
					/>
					<Switch
						label="Recibe documentos físicos"
						description="Actívalo si los requisitos se entregan impresos o en original el día de la cita."
						checked={form.values.allowsPhysicalDocuments}
						onChange={(event) =>
							form.setFieldValue(
								"allowsPhysicalDocuments",
								event.currentTarget.checked,
							)
						}
						disabled={isSubmitting}
						classNames={{ root: classes.switchRow }}
					/>
				</div>
			</section>
		</div>
	);
}

interface BuilderPanelProps {
	form: ProcedureEditorForm;
	isSubmitting: boolean;
}

export function RequirementsPanel({ form, isSubmitting }: BuilderPanelProps) {
	const addRequirement = () => {
		form.insertListItem("requirements", {
			id: generateId(),
			name: "",
			description: "",
			isRequired: true,
			downloadUrl: "",
			order: form.values.requirements.length,
		});
	};

	return (
		<div className={classes.builderPanel}>
			<BuilderHeader
				title="Requisitos documentales"
				description="Documentos o soportes que la persona debe presentar durante la atención."
				count={form.values.requirements.length}
				actionLabel="Agregar requisito"
				onAdd={addRequirement}
				disabled={isSubmitting}
			/>

			{form.values.requirements.length === 0 ? (
				<BuilderEmptyState
					icon={FileCheck2}
					title="Este trámite todavía no tiene requisitos"
					description="Agrega únicamente los documentos que el ciudadano debe llevar a la cita."
					actionLabel="Agregar primer requisito"
					onAdd={addRequirement}
				/>
			) : (
				<div className={classes.builderList}>
					{form.values.requirements.map((requirement, index) => {
						const namePath = `requirements.${index}.name`;
						return (
							<article key={requirement.id} className={classes.builderItem}>
								<ItemHeader
									label={`Requisito ${index + 1}`}
									detail={requirement.name || "Sin nombre"}
									index={index}
									lastIndex={form.values.requirements.length - 1}
									disabled={isSubmitting}
									onMove={(to) =>
										form.reorderListItem("requirements", {
											from: index,
											to,
										})
									}
									onRemove={() => form.removeListItem("requirements", index)}
								/>
								<div className={classes.requirementGrid}>
									<TextInput
										label="Nombre del requisito"
										placeholder="Ejemplo: Documento de identidad original"
										withAsterisk
										value={requirement.name}
										onChange={(event) =>
											form.setFieldValue(namePath, event.currentTarget.value)
										}
										error={form.errors[namePath]}
										disabled={isSubmitting}
										data-procedure-field={namePath}
									/>
									<TextInput
										label="Enlace de descarga"
										description="Opcional"
										placeholder="https://..."
										value={requirement.downloadUrl ?? ""}
										onChange={(event) =>
											form.setFieldValue(
												`requirements.${index}.downloadUrl`,
												event.currentTarget.value,
											)
										}
										disabled={isSubmitting}
										leftSection={<Link2 size={15} aria-hidden="true" />}
									/>
									<Textarea
										label="Aclaración para el ciudadano"
										description="Opcional"
										placeholder="Explica formato, vigencia o condiciones del documento..."
										rows={3}
										value={requirement.description ?? ""}
										onChange={(event) =>
											form.setFieldValue(
												`requirements.${index}.description`,
												event.currentTarget.value,
											)
										}
										disabled={isSubmitting}
										className={classes.fullWidthField}
									/>
								</div>
								<Switch
									label="Este documento es obligatorio"
									description="Si está desactivado, se mostrará como recomendado u opcional."
									checked={requirement.isRequired}
									onChange={(event) =>
										form.setFieldValue(
											`requirements.${index}.isRequired`,
											event.currentTarget.checked,
										)
									}
									disabled={isSubmitting}
									classNames={{ root: classes.itemSwitch }}
								/>
							</article>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function CitizenFormPanel({ form, isSubmitting }: BuilderPanelProps) {
	const addField = () => {
		const field: ProcedureFormField = {
			id: generateId(),
			label: "",
			type: "text",
			required: false,
			placeholder: "",
			options: [],
			order: form.values.formFields.length,
		};
		form.insertListItem("formFields", field);
	};

	return (
		<div className={classes.builderPanel}>
			<BuilderHeader
				title="Formulario ciudadano"
				description="Solicita solo la información adicional que no esté disponible en el perfil ciudadano."
				count={form.values.formFields.length}
				actionLabel="Agregar campo"
				onAdd={addField}
				disabled={isSubmitting}
			/>

			{form.values.formFields.length === 0 ? (
				<BuilderEmptyState
					icon={ClipboardList}
					title="No se solicitarán datos adicionales"
					description="Puedes dejar esta sección vacía o crear los campos que el ciudadano debe completar."
					actionLabel="Agregar primer campo"
					onAdd={addField}
				/>
			) : (
				<div className={classes.builderList}>
					{form.values.formFields.map((field, fieldIndex) => {
						const labelPath = `formFields.${fieldIndex}.label`;
						const optionsErrorPath = `formFields.${fieldIndex}.options`;
						return (
							<article key={field.id} className={classes.builderItem}>
								<ItemHeader
									label={`Campo ${fieldIndex + 1}`}
									detail={field.label || "Sin etiqueta"}
									index={fieldIndex}
									lastIndex={form.values.formFields.length - 1}
									disabled={isSubmitting}
									onMove={(to) =>
										form.reorderListItem("formFields", {
											from: fieldIndex,
											to,
										})
									}
									onRemove={() => form.removeListItem("formFields", fieldIndex)}
								/>
								<div className={classes.fieldGrid}>
									<TextInput
										label="Etiqueta del campo"
										description="La pregunta que verá el ciudadano."
										placeholder="Ejemplo: Número de placa"
										withAsterisk
										value={field.label}
										onChange={(event) =>
											form.setFieldValue(labelPath, event.currentTarget.value)
										}
										error={form.errors[labelPath]}
										disabled={isSubmitting}
										data-procedure-field={labelPath}
									/>
									<Select
										label="Tipo de respuesta"
										description="Define el control que se mostrará."
										data={FIELD_TYPE_OPTIONS}
										value={field.type}
										onChange={(value) =>
											form.setFieldValue(
												`formFields.${fieldIndex}.type`,
												(value as ProcedureFormField["type"]) ?? "text",
											)
										}
										disabled={isSubmitting}
									/>
									<TextInput
										label="Texto de ejemplo"
										description="Opcional; úsalo para mostrar el formato esperado."
										placeholder="Ejemplo: ABC123"
										value={field.placeholder ?? ""}
										onChange={(event) =>
											form.setFieldValue(
												`formFields.${fieldIndex}.placeholder`,
												event.currentTarget.value,
											)
										}
										disabled={isSubmitting}
										className={classes.fullWidthField}
									/>
								</div>

								<Switch
									label="Respuesta obligatoria"
									description="El ciudadano no podrá continuar sin completar este campo."
									checked={field.required}
									onChange={(event) =>
										form.setFieldValue(
											`formFields.${fieldIndex}.required`,
											event.currentTarget.checked,
										)
									}
									disabled={isSubmitting}
									classNames={{ root: classes.itemSwitch }}
								/>

								{field.type === "select" ? (
									<div className={classes.optionsSection}>
										<div className={classes.optionsHeader}>
											<div>
												<Text size="sm" fw={600}>
													Opciones disponibles
												</Text>
												<Text size="xs" c="dimmed">
													Se mostrarán en este mismo orden.
												</Text>
											</div>
											<Button
												type="button"
												variant="light"
												size="xs"
												leftSection={<Plus size={14} aria-hidden="true" />}
												onClick={() => {
													form.insertListItem(
														`formFields.${fieldIndex}.options`,
														{ id: generateId(), value: "" },
													);
													form.clearFieldError(optionsErrorPath);
												}}
												disabled={isSubmitting}
											>
												Agregar opción
											</Button>
										</div>

										{field.options.length > 0 ? (
											<div className={classes.optionList}>
												{field.options.map((option, optionIndex) => {
													const optionPath = `formFields.${fieldIndex}.options.${optionIndex}.value`;
													return (
														<div key={option.id} className={classes.optionRow}>
															<Text
																className={classes.optionNumber}
																aria-hidden="true"
															>
																{optionIndex + 1}
															</Text>
															<TextInput
																aria-label={`Opción ${optionIndex + 1} del campo ${fieldIndex + 1}`}
																placeholder={`Opción ${optionIndex + 1}`}
																value={option.value}
																onChange={(event) =>
																	form.setFieldValue(
																		optionPath,
																		event.currentTarget.value,
																	)
																}
																error={form.errors[optionPath]}
																disabled={isSubmitting}
																data-procedure-field={optionPath}
																className={classes.optionInput}
															/>
															<Tooltip
																label={`Eliminar opción ${optionIndex + 1}`}
															>
																<ActionIcon
																	type="button"
																	variant="subtle"
																	color="red"
																	size="lg"
																	aria-label={`Eliminar opción ${optionIndex + 1}`}
																	onClick={() =>
																		form.removeListItem(
																			`formFields.${fieldIndex}.options`,
																			optionIndex,
																		)
																	}
																	disabled={isSubmitting}
																	className={classes.itemAction}
																>
																	<Trash2 size={16} aria-hidden="true" />
																</ActionIcon>
															</Tooltip>
														</div>
													);
												})}
											</div>
										) : null}
										{form.errors[optionsErrorPath] ? (
											<Text size="xs" c="red.7" role="alert">
												{form.errors[optionsErrorPath]}
											</Text>
										) : null}
									</div>
								) : null}
							</article>
						);
					})}
				</div>
			)}
		</div>
	);
}

function SectionHeading({
	id,
	title,
	description,
}: {
	id: string;
	title: string;
	description: string;
}) {
	return (
		<div className={classes.formSectionHeading}>
			<h3 id={id} className={classes.formSectionTitle}>
				{title}
			</h3>
			<p className={classes.formSectionDescription}>{description}</p>
		</div>
	);
}

function BuilderHeader({
	title,
	description,
	count,
	actionLabel,
	onAdd,
	disabled,
}: {
	title: string;
	description: string;
	count: number;
	actionLabel: string;
	onAdd: () => void;
	disabled: boolean;
}) {
	return (
		<div className={classes.builderHeader}>
			<div className={classes.builderHeading}>
				<div className={classes.builderTitleRow}>
					<h3 className={classes.builderTitle}>{title}</h3>
					<span className={classes.builderCount}>{count}</span>
				</div>
				<p className={classes.builderDescription}>{description}</p>
			</div>
			<Button
				type="button"
				variant="light"
				leftSection={<Plus size={16} aria-hidden="true" />}
				onClick={onAdd}
				disabled={disabled}
				className={classes.builderAction}
			>
				{actionLabel}
			</Button>
		</div>
	);
}

function BuilderEmptyState({
	icon: Icon,
	title,
	description,
	actionLabel,
	onAdd,
}: {
	icon: typeof FileCheck2;
	title: string;
	description: string;
	actionLabel: string;
	onAdd: () => void;
}) {
	return (
		<div className={classes.builderEmpty}>
			<Icon size={24} strokeWidth={1.5} aria-hidden="true" />
			<div>
				<Text fw={600}>{title}</Text>
				<Text size="sm" c="dimmed" mt={4}>
					{description}
				</Text>
			</div>
			<Button type="button" variant="default" size="sm" onClick={onAdd}>
				{actionLabel}
			</Button>
		</div>
	);
}

function ItemHeader({
	label,
	detail,
	index,
	lastIndex,
	disabled,
	onMove,
	onRemove,
}: {
	label: string;
	detail: string;
	index: number;
	lastIndex: number;
	disabled: boolean;
	onMove: (to: number) => void;
	onRemove: () => void;
}) {
	return (
		<header className={classes.itemHeader}>
			<div className={classes.itemHeading}>
				<span className={classes.itemEyebrow}>{label}</span>
				<Text fw={600} lineClamp={1}>
					{detail}
				</Text>
			</div>
			<div className={classes.itemActions}>
				<Tooltip label="Mover hacia arriba">
					<ActionIcon
						type="button"
						variant="subtle"
						color="gray"
						size="lg"
						aria-label={`${label}: mover hacia arriba`}
						disabled={disabled || index === 0}
						onClick={() => onMove(index - 1)}
						className={classes.itemAction}
					>
						<ArrowUp size={16} aria-hidden="true" />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Mover hacia abajo">
					<ActionIcon
						type="button"
						variant="subtle"
						color="gray"
						size="lg"
						aria-label={`${label}: mover hacia abajo`}
						disabled={disabled || index === lastIndex}
						onClick={() => onMove(index + 1)}
						className={classes.itemAction}
					>
						<ArrowDown size={16} aria-hidden="true" />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Eliminar">
					<ActionIcon
						type="button"
						variant="subtle"
						color="red"
						size="lg"
						aria-label={`${label}: eliminar`}
						disabled={disabled}
						onClick={onRemove}
						className={classes.itemAction}
					>
						<Trash2 size={16} aria-hidden="true" />
					</ActionIcon>
				</Tooltip>
			</div>
		</header>
	);
}
