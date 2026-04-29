type OrpcClient = typeof import("#/shared/lib/orpc-client").orpcClient;

export type ProcedureType = Awaited<
	ReturnType<OrpcClient["admin"]["procedures"]["list"]>
>[number];

export type ProcedureCreateInput = Parameters<
	OrpcClient["admin"]["procedures"]["create"]
>[0];

export type ProcedureUpdateInput = Parameters<
	OrpcClient["admin"]["procedures"]["update"]
>[0];

export interface DocumentRequirement {
	id: string;
	name: string;
	description?: string;
	isRequired: boolean;
	order: number;
	downloadUrl?: string;
}

export interface DocumentSchema {
	requirements?: DocumentRequirement[];
	instructions?: string;
}

export interface FormFieldDef {
	id: string;
	label: string;
	type: "text" | "number" | "email" | "tel" | "select" | "textarea";
	required: boolean;
	placeholder?: string;
	options?: string[];
	order: number;
}

export interface FormSchema {
	fields?: FormFieldDef[];
}
