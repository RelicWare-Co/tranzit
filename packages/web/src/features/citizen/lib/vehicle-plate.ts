/**
 * Validacion de placa vehicular ante el registro de Tuluá.
 *
 * Por ahora la consulta es MOCK: simula latencia y devuelve un resultado
 * determinista basado en la placa. El contrato de esta funcion es el que
 * debe respetarse cuando se conecte al RUNT / base del tránsito de Tuluá:
 * sustituir el cuerpo de `resolvePlate` por la llamada real y conservar el
 * tipo `VehiclePlateValidation` como valor de retorno.
 */

export type PlateValidationStatus =
	| "registered-tulua"
	| "registered-other-city"
	| "not-found"
	| "error";

export interface VehiclePlateValidation {
	plate: string;
	status: PlateValidationStatus;
	/** Ciudad/municipio donde está matriculado el vehículo, si se conoce. */
	city: string | null;
	vehicle: VehicleSummary | null;
	message: string;
}

export interface VehicleSummary {
	plate: string;
	brand?: string;
	model?: string;
	year?: number;
}

const TULUA_CITY = "Tuluá";

const TULUA_REGISTERED: Record<string, VehicleSummary> = {
	ABC123: { plate: "ABC123", brand: "Renault", model: "Logan", year: 2019 },
	XYZ789: { plate: "XYZ789", brand: "Chevrolet", model: "Onix", year: 2021 },
	TUL091: { plate: "TUL091", brand: "Mazda", model: "CX-5", year: 2022 },
	QWE456: { plate: "QWE456", brand: "Toyota", model: "Hilux", year: 2018 },
};

const OTHER_CITY_PREFIXES: Record<string, string> = {
	M: "Cali",
	B: "Bogotá D.C.",
	C: "Medellín",
};

function normalizePlate(plate: string): string {
	return plate.trim().toUpperCase().replace(/\s+/g, "");
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolvePlate(plate: string): Promise<VehiclePlateValidation> {
	await delay(450 + Math.random() * 350);

	const tulua = TULUA_REGISTERED[plate];
	if (tulua) {
		return {
			plate,
			status: "registered-tulua",
			city: TULUA_CITY,
			vehicle: tulua,
			message: `Vehículo registrado en ${TULUA_CITY}. Puedes continuar con tu trámite.`,
		};
	}

	const prefix = plate.charAt(0);
	const otherCity = OTHER_CITY_PREFIXES[prefix];
	if (otherCity) {
		return {
			plate,
			status: "registered-other-city",
			city: otherCity,
			vehicle: { plate, brand: "Genérico" },
			message: `Este vehículo está matriculado en ${otherCity}. Los trámites ante SIMUT ${TULUA_CITY} solo aplican para vehículos registrados en el municipio. Solicita primero el cambio de jurisdicción o realiza el trámite en tu ciudad de matrícula.`,
		};
	}

	return {
		plate,
		status: "not-found",
		city: null,
		vehicle: null,
		message:
			"No encontramos un vehículo registrado con esa placa. Verifica la placa e intenta de nuevo.",
	};
}

/**
 * Valida una placa ante el registro de Tuluá.
 * regimen: 'registered-tulua' permite continuar; cualquier otro estado bloquea.
 */
export async function validateVehiclePlate(
	rawPlate: string,
): Promise<VehiclePlateValidation> {
	const plate = normalizePlate(rawPlate);
	if (plate.length < 4) {
		return {
			plate,
			status: "error",
			city: null,
			vehicle: null,
			message: "Ingresa una placa válida (mínimo 4 caracteres).",
		};
	}

	try {
		return await resolvePlate(plate);
	} catch {
		return {
			plate,
			status: "error",
			city: null,
			vehicle: null,
			message:
				"No pudimos consultar el registro del vehículo. Intenta de nuevo.",
		};
	}
}