export type ProcedureRequirement = {
	id: string;
	name: string;
	description: string | null;
	isRequired: boolean;
	downloadUrl: string | null;
};

export type ProcedureFormFieldType =
	| "text"
	| "number"
	| "email"
	| "tel"
	| "select"
	| "textarea";

export type ProcedureFormField = {
	id: string;
	label: string;
	type: ProcedureFormFieldType;
	required: boolean;
	placeholder: string | null;
	options: string[];
};

const FORM_FIELD_TYPES = new Set<ProcedureFormFieldType>([
	"text",
	"number",
	"email",
	"tel",
	"select",
	"textarea",
]);

export const PROCEDURE_FORM_FIELD_LABELS: Record<
	ProcedureFormFieldType,
	string
> = {
	text: "Texto",
	number: "Número",
	email: "Correo",
	tel: "Teléfono",
	select: "Selección",
	textarea: "Texto largo",
};

function asNonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

export function getProcedureRequirements(
	documentSchema: Record<string, unknown> | null | undefined,
): ProcedureRequirement[] {
	if (!Array.isArray(documentSchema?.requirements)) return [];

	return documentSchema.requirements.flatMap((value) => {
		if (!value || typeof value !== "object") return [];
		const requirement = value as Record<string, unknown>;
		const id = asNonEmptyString(requirement.id);
		const name = asNonEmptyString(requirement.name);
		if (!id || !name) return [];

		return [
			{
				id,
				name,
				description: asNonEmptyString(requirement.description),
				isRequired: requirement.isRequired !== false,
				downloadUrl: asNonEmptyString(requirement.downloadUrl),
			},
		];
	});
}

export function getProcedureFormFields(
	formSchema: Record<string, unknown> | null | undefined,
): ProcedureFormField[] {
	if (!Array.isArray(formSchema?.fields)) return [];

	return formSchema.fields.flatMap((value) => {
		if (!value || typeof value !== "object") return [];
		const field = value as Record<string, unknown>;
		const id = asNonEmptyString(field.id);
		const label = asNonEmptyString(field.label);
		const rawType = asNonEmptyString(field.type);
		if (!id || !label || !rawType) return [];
		if (!FORM_FIELD_TYPES.has(rawType as ProcedureFormFieldType)) return [];

		return [
			{
				id,
				label,
				type: rawType as ProcedureFormFieldType,
				required: field.required === true,
				placeholder: asNonEmptyString(field.placeholder),
				options: Array.isArray(field.options)
					? field.options.flatMap((option) => {
							const normalized = asNonEmptyString(option);
							return normalized ? [normalized] : [];
						})
					: [],
			},
		];
	});
}
