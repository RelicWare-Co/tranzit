type OrpcClient = typeof import("#/shared/lib/orpc-client").orpcClient;

export type StaffProfile = Awaited<
	ReturnType<OrpcClient["admin"]["staff"]["list"]>
>[number];

export type AdminBooking = Awaited<
	ReturnType<OrpcClient["admin"]["bookings"]["list"]>
>[number];

export type BookingByStaff = Record<string, AdminBooking[]>;

export type CreateStaffPayload = {
	name: string;
	email: string;
	capacity: number;
};
