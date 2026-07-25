export type VehiclePlateValidationStatus =
	| "registered-tulua"
	| "registered-other-city"
	| "not-found"
	| "error";

export type VehiclePlateValidation = {
	plate: string;
	status: VehiclePlateValidationStatus;
	source: "mock";
	city: string | null;
	vehicle: {
		plate: string;
		brand?: string;
		model?: string;
		year?: number;
	} | null;
	message: string;
};

const TULUA_CITY = "Tuluá";
const PLATE_PATTERN = /^[A-Z]{3}(?:\d{3}|\d{2}[A-Z])$/;

const MOCK_RESULTS: Record<
	string,
	Omit<VehiclePlateValidation, "plate" | "source">
> = {
	ABC123: {
		status: "registered-tulua",
		city: TULUA_CITY,
		vehicle: {
			plate: "ABC123",
			brand: "Renault",
			model: "Logan",
			year: 2019,
		},
		message: "Placa habilitada para pruebas en Tuluá.",
	},
	CAL123: {
		status: "registered-other-city",
		city: "Cali",
		vehicle: { plate: "CAL123" },
		message: "Placa de prueba registrada en Cali.",
	},
	NFD404: {
		status: "not-found",
		city: null,
		vehicle: null,
		message: "Placa de prueba configurada como no encontrada.",
	},
	ERR500: {
		status: "error",
		city: null,
		vehicle: null,
		message: "La fuente de prueba no está disponible.",
	},
};

export function normalizeVehiclePlate(rawPlate: string): string {
	return rawPlate
		.trim()
		.toUpperCase()
		.replace(/[\s-]+/g, "");
}

export function validateVehiclePlate(rawPlate: string): VehiclePlateValidation {
	const plate = normalizeVehiclePlate(rawPlate);

	if (!PLATE_PATTERN.test(plate)) {
		return {
			plate,
			status: "error",
			source: "mock",
			city: null,
			vehicle: null,
			message:
				"Ingresa una placa con formato válido, por ejemplo ABC123 o ABC12D.",
		};
	}

	const configuredResult = MOCK_RESULTS[plate];
	if (configuredResult) {
		return {
			plate,
			source: "mock",
			...configuredResult,
			vehicle: configuredResult.vehicle
				? { ...configuredResult.vehicle, plate }
				: null,
		};
	}

	return {
		plate,
		status: "registered-tulua",
		source: "mock",
		city: TULUA_CITY,
		vehicle: { plate },
		message:
			"Formato válido. La placa queda habilitada para continuar en este entorno de prueba.",
	};
}
