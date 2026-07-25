import { describe, expect, test } from "vitest";
import {
	normalizeVehiclePlate,
	validateVehiclePlate,
} from "./vehicle-plate.service";

describe("vehicle plate mock validation", () => {
	test("normalizes case, spaces and hyphens", () => {
		expect(normalizeVehiclePlate(" ab-c 123 ")).toBe("ABC123");
	});

	test("accepts any valid plate format for the default test path", () => {
		expect(validateVehiclePlate("QWE987")).toMatchObject({
			plate: "QWE987",
			status: "registered-tulua",
			source: "mock",
			city: "Tuluá",
		});
	});

	test.each([
		["ABC123", "registered-tulua"],
		["CAL123", "registered-other-city"],
		["NFD404", "not-found"],
		["ERR500", "error"],
	] as const)("returns the configured result for %s", (plate, status) => {
		expect(validateVehiclePlate(plate).status).toBe(status);
	});

	test("rejects malformed plates", () => {
		expect(validateVehiclePlate("1234")).toMatchObject({
			status: "error",
			source: "mock",
		});
	});
});
