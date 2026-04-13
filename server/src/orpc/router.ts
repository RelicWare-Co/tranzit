import { createBookingsRouter } from "./modules/bookings.router";
import { createOnboardingRouter } from "./modules/onboarding.router";
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
			reservationSeries: createReservationSeriesRouter(),
			reservations: createReservationsRouter(),
		},
	};
}
