export type BookingKind = "citizen" | "administrative";

export type BookingWithRelations = {
	id: string;
	kind: BookingKind;
	status: string;
	isActive: boolean;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	staff: {
		id: string;
		name: string | null;
		email: string;
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
