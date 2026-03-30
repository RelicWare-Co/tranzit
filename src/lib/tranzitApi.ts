import pb from "./pb";

const TRANZIT_AUX_URL =
	import.meta.env.VITE_TRANZIT_AUX_URL ?? "http://127.0.0.1:8787";

type RequestOptions = RequestInit & {
	auth?: boolean;
};

async function tranzitRequest<T>(
	path: string,
	{ auth = false, headers, ...init }: RequestOptions = {},
): Promise<T> {
	const requestHeaders = new Headers(headers);

	if (auth) {
		const token = pb.authStore.token;
		if (!token) {
			throw new Error("No hay una sesion activa en PocketBase.");
		}

		requestHeaders.set("Authorization", `Bearer ${token}`);
	}

	const response = await fetch(`${TRANZIT_AUX_URL}${path}`, {
		...init,
		headers: requestHeaders,
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(
			typeof payload?.message === "string"
				? payload.message
				: "La solicitud a tranzit-aux fallo.",
		);
	}

	return payload as T;
}

export interface RequestOtpPayload {
	email: string;
	name?: string;
	phone?: string;
	documentType?: string;
	documentNumber?: string;
	vehiclePlate?: string;
}

export interface VerifyOtpPayload {
	otpId: string;
	password: string;
}

export interface HoldAppointmentPayload {
	serviceId: string;
	date: string;
	startMinutes: number;
	applicantName?: string;
	applicantPhone?: string;
	documentType?: string;
	documentNumber?: string;
	vehiclePlate?: string;
	vehicleRegisteredLocally?: boolean;
	deliveryMode?: "digital_upload" | "physical_delivery";
	initialChecks?: unknown;
	intakePayload?: unknown;
}

export interface ConfirmAppointmentPayload {
	appointmentId: string;
	applicantName?: string;
	applicantPhone?: string;
	documentType?: string;
	documentNumber?: string;
	vehiclePlate?: string;
	vehicleRegisteredLocally?: boolean;
	deliveryMode?: "digital_upload" | "physical_delivery";
	initialChecks?: unknown;
	intakePayload?: unknown;
}

export async function listTranzitServices() {
	return tranzitRequest<{ items: unknown[] }>("/api/tranzit/services");
}

export async function getTranzitAvailability(date: string, serviceId?: string) {
	const searchParams = new URLSearchParams({ date });
	if (serviceId) {
		searchParams.set("serviceId", serviceId);
	}

	return tranzitRequest<unknown>(
		`/api/tranzit/availability?${searchParams.toString()}`,
	);
}

export async function requestTranzitOtp(payload: RequestOtpPayload) {
	return tranzitRequest<{ otpId: string }>("/api/tranzit/auth/request-otp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}

export async function verifyTranzitOtp(payload: VerifyOtpPayload) {
	const authData = await tranzitRequest<{ token: string; record: Record<string, unknown> }>(
		"/api/tranzit/auth/verify-otp",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		},
	);

	pb.authStore.save(authData.token, authData.record);
	return authData;
}

export async function holdTranzitAppointment(payload: HoldAppointmentPayload) {
	return tranzitRequest<unknown>("/api/tranzit/appointments/hold", {
		method: "POST",
		auth: true,
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}

export async function confirmTranzitAppointment(
	payload: ConfirmAppointmentPayload,
	attachments: File[] = [],
) {
	const formData = new FormData();
	formData.set("appointmentId", payload.appointmentId);

	if (payload.applicantName) {
		formData.set("applicantName", payload.applicantName);
	}
	if (payload.applicantPhone) {
		formData.set("applicantPhone", payload.applicantPhone);
	}
	if (payload.documentType) {
		formData.set("documentType", payload.documentType);
	}
	if (payload.documentNumber) {
		formData.set("documentNumber", payload.documentNumber);
	}
	if (payload.vehiclePlate) {
		formData.set("vehiclePlate", payload.vehiclePlate);
	}
	if (payload.vehicleRegisteredLocally !== undefined) {
		formData.set(
			"vehicleRegisteredLocally",
			String(payload.vehicleRegisteredLocally),
		);
	}
	if (payload.deliveryMode) {
		formData.set("deliveryMode", payload.deliveryMode);
	}
	if (payload.initialChecks !== undefined) {
		formData.set("initialChecks", JSON.stringify(payload.initialChecks));
	}
	if (payload.intakePayload !== undefined) {
		formData.set("intakePayload", JSON.stringify(payload.intakePayload));
	}

	for (const attachment of attachments) {
		formData.append("attachments", attachment);
	}

	return tranzitRequest<unknown>("/api/tranzit/appointments/confirm", {
		method: "POST",
		auth: true,
		body: formData,
	});
}
