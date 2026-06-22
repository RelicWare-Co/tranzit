import { describe, expect, it } from "vitest";
import { validateScheduleTimeFields } from "./constants";

describe("validateScheduleTimeFields", () => {
	it("returns no errors for valid windows", () => {
		expect(
			validateScheduleTimeFields({
				morningStart: "08:00",
				morningEnd: "12:00",
				afternoonStart: "14:00",
				afternoonEnd: "17:00",
			}),
		).toEqual({});
	});

	it("flags inverted morning window", () => {
		expect(
			validateScheduleTimeFields({
				morningStart: "10:00",
				morningEnd: "09:00",
				afternoonStart: "",
				afternoonEnd: "",
			}).morningEnd,
		).toBe("El fin de mañana debe ser posterior al inicio");
	});

	it("flags afternoon start before morning end", () => {
		expect(
			validateScheduleTimeFields({
				morningStart: "08:00",
				morningEnd: "12:00",
				afternoonStart: "11:00",
				afternoonEnd: "17:00",
			}).afternoonStart,
		).toBe("El inicio de tarde debe ser posterior al fin de mañana");
	});
});
