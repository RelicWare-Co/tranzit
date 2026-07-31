export type BookingKind = "citizen" | "administrative";

type DraftData = {
	plate?: string | null;
	applicantName?: string | null;
	applicantDocument?: string | null;
	notes?: string | null;
} | null;

export type BookingWithRelations = {
	id: string;
	kind: BookingKind;
	status: string;
	isActive: boolean;
	holdExpiresAt: string | Date | null;
	attendedAt: string | Date | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
		capacityLimit: number | null;
	} | null;
	staff: {
		id: string;
		name: string | null;
		email: string;
	} | null;
	request?: {
		id: string;
		status: string;
		procedureTypeId: string;
		citizenUserId: string | null;
		email: string | null;
		phone: string | null;
		documentType: string | null;
		documentNumber: string | null;
		plate: string | null;
		draftData: DraftData;
		procedure: {
			id: string;
			slug: string;
			name: string;
			description: string | null;
		} | null;
		procedureType?: {
			id: string;
			name: string;
			slug: string;
		} | null;
		citizen: {
			id: string;
			name: string | null;
			email: string;
		} | null;
	} | null;
};

export type StaffProfile = {
	userId: string;
	isActive: boolean;
	isAssignable: boolean;
	user: {
		id: string;
		name: string | null;
		email: string;
		role: string | null;
	} | null;
};

export type SlotWithCapacity = {
	id: string;
	slotDate: string;
	startTime: string;
	endTime: string;
	status: string;
	capacityLimit: number | null;
	reservedCount: number;
	remainingCapacity: number | null;
	generatedFrom: string;
};

export type ProcedureType = {
	id: string;
	slug: string;
	name: string;
	isActive: boolean;
};
