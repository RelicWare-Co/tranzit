import { createBookingsRouter } from "./modules/bookings.router";
import { createOnboardingRouter } from "./modules/onboarding.router";
import { createProceduresRouter } from "./modules/procedures.router";
import { createReservationSeriesRouter } from "./modules/reservation-series.router";
import { createReservationsRouter } from "./modules/reservations.router";
import { createScheduleRouter } from "./modules/schedule.router";
import { createSessionRouter } from "./modules/session.router";
import { createStaffRouter } from "./modules/staff.router";

export function createTranzitRpcRouter() {
	return {
		session: createSessionRouter(),
		admin: {
			onboarding: createOnboardingRouter(),
			schedule: createScheduleRouter(),
			staff: createStaffRouter(),
			bookings: createBookingsRouter(),
			procedures: createProceduresRouter(),
			reservationSeries: createReservationSeriesRouter(),
			reservations: createReservationsRouter(),
		},
	};
}
