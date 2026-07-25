import { describe, expect, test } from "vitest";
import {
	getProcedureFormFields,
	getProcedureRequirements,
} from "./procedure-schema";

describe("procedure schema", () => {
	test("reads the canonical document schema", () => {
		expect(
			getProcedureRequirements({
				requirements: [
					{
						id: "identity",
						name: "Documento de identidad",
						description: "Original en físico",
						isRequired: true,
						downloadUrl: "https://example.com/form.pdf",
					},
				],
			}),
		).toEqual([
			{
				id: "identity",
				name: "Documento de identidad",
				description: "Original en físico",
				isRequired: true,
				downloadUrl: "https://example.com/form.pdf",
			},
		]);
	});

	test("does not read legacy document shapes", () => {
		expect(
			getProcedureRequirements({
				required: [{ key: "identity", label: "Documento de identidad" }],
			}),
		).toEqual([]);
	});

	test("reads the canonical flat form schema", () => {
		expect(
			getProcedureFormFields({
				fields: [
					{
						id: "category",
						label: "Categoría",
						type: "select",
						required: true,
						options: ["A1", " A2 ", ""],
					},
				],
			}),
		).toEqual([
			{
				id: "category",
				label: "Categoría",
				type: "select",
				required: true,
				placeholder: null,
				options: ["A1", "A2"],
			},
		]);
	});

	test("does not flatten legacy form sections", () => {
		expect(
			getProcedureFormFields({
				sections: [
					{
						fields: [{ key: "name", label: "Nombre", type: "text" }],
					},
				],
			}),
		).toEqual([]);
	});
});
