import type { UseFormReturnType } from "@mantine/form";
import type {
	DocumentRequirement,
	DocumentSchema,
	FormFieldDef,
	FormSchema,
	ProcedureType,
} from "./types";
import { generateId } from "./utils";

export interface FormOptionValue {
	id: string;
	value: string;
}

export interface ProcedureFormField extends Omit<FormFieldDef, "options"> {
	options: FormOptionValue[];
}

export interface ProcedureFormValues {
	name: string;
	slug: string;
	description: string;
	requiresVehicle: boolean;
	allowsPhysicalDocuments: boolean;
	instructions: string;
	requirements: DocumentRequirement[];
	formFields: ProcedureFormField[];
}

export interface ProcedureFormPayload {
	name: string;
	slug: string;
	description?: string;
	requiresVehicle: boolean;
	allowsPhysicalDocuments: boolean;
	instructions?: string;
	documentSchema: Record<string, unknown>;
	formSchema: Record<string, unknown>;
}

export type ProcedureEditorForm = UseFormReturnType<ProcedureFormValues>;

export const FIELD_TYPE_OPTIONS: {
	value: FormFieldDef["type"];
	label: string;
}[] = [
	{ value: "text", label: "Texto corto" },
	{ value: "textarea", label: "Texto largo" },
	{ value: "number", label: "Número" },
	{ value: "email", label: "Correo electrónico" },
	{ value: "tel", label: "Teléfono" },
	{ value: "select", label: "Lista de opciones" },
];

export function createProcedureFormValues(
	procedure?: ProcedureType,
): ProcedureFormValues {
	const documentSchema = (procedure?.documentSchema ?? {}) as DocumentSchema;
	const formSchema = (procedure?.formSchema ?? {}) as FormSchema;

	return {
		name: procedure?.name ?? "",
		slug: procedure?.slug ?? "",
		description: procedure?.description ?? "",
		requiresVehicle: procedure?.requiresVehicle ?? false,
		allowsPhysicalDocuments: procedure?.allowsPhysicalDocuments ?? true,
		instructions: procedure?.instructions ?? "",
		requirements:
			documentSchema.requirements?.map((requirement, index) => ({
				id: requirement.id || generateId(),
				name: requirement.name ?? "",
				description: requirement.description ?? "",
				isRequired: requirement.isRequired ?? true,
				downloadUrl: requirement.downloadUrl ?? "",
				order: requirement.order ?? index,
			})) ?? [],
		formFields:
			formSchema.fields?.map((field, index) => ({
				id: field.id || generateId(),
				label: field.label ?? "",
				type: field.type ?? "text",
				required: field.required ?? false,
				placeholder: field.placeholder ?? "",
				options:
					field.options?.map((option) => ({
						id: generateId(),
						value: option,
					})) ?? [],
				order: field.order ?? index,
			})) ?? [],
	};
}

export function buildProcedurePayload(
	values: ProcedureFormValues,
): ProcedureFormPayload {
	const documentSchema: DocumentSchema = {
		requirements: values.requirements.map((requirement, index) => ({
			...requirement,
			name: requirement.name.trim(),
			description: requirement.description?.trim() || undefined,
			downloadUrl: requirement.downloadUrl?.trim() || undefined,
			order: index,
		})),
	};

	const formSchema: FormSchema = {
		fields: values.formFields.map((field, index) => ({
			id: field.id,
			label: field.label.trim(),
			type: field.type,
			required: field.required,
			placeholder: field.placeholder?.trim() || undefined,
			options:
				field.type === "select"
					? field.options.map((option) => option.value.trim())
					: undefined,
			order: index,
		})),
	};

	return {
		name: values.name.trim(),
		slug: values.slug.trim(),
		description: values.description.trim() || undefined,
		requiresVehicle: values.requiresVehicle,
		allowsPhysicalDocuments: values.allowsPhysicalDocuments,
		instructions: values.instructions.trim() || undefined,
		documentSchema: documentSchema as Record<string, unknown>,
		formSchema: formSchema as Record<string, unknown>,
	};
}

export interface ProcedureFormError {
	tab: "requirements" | "form";
	path: string;
	message: string;
}

export function findBuilderError(
	values: ProcedureFormValues,
): ProcedureFormError | null {
	for (const [index, requirement] of values.requirements.entries()) {
		if (!requirement.name.trim()) {
			return {
				tab: "requirements",
				path: `requirements.${index}.name`,
				message: "Escribe el nombre del requisito",
			};
		}
	}

	for (const [fieldIndex, field] of values.formFields.entries()) {
		if (!field.label.trim()) {
			return {
				tab: "form",
				path: `formFields.${fieldIndex}.label`,
				message: "Escribe la etiqueta del campo",
			};
		}

		if (field.type !== "select") continue;

		if (field.options.length === 0) {
			return {
				tab: "form",
				path: `formFields.${fieldIndex}.options`,
				message: "Agrega al menos una opción",
			};
		}

		const emptyOptionIndex = field.options.findIndex(
			(option) => !option.value.trim(),
		);
		if (emptyOptionIndex >= 0) {
			return {
				tab: "form",
				path: `formFields.${fieldIndex}.options.${emptyOptionIndex}.value`,
				message: "Escribe un valor para esta opción",
			};
		}
	}

	return null;
}

export function tabForFieldPath(
	path: string,
): "general" | "requirements" | "form" {
	if (path.startsWith("requirements")) return "requirements";
	if (path.startsWith("formFields")) return "form";
	return "general";
}
