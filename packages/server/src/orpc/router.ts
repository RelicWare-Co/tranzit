import { createBookingsRouter } from "./modules/bookings.router";
import { createCitizenRouter } from "./modules/citizen.router";
import { createDocumentsRouter } from "./modules/documents.router";
import { createOnboardingRouter } from "./modules/onboarding.router";
import { createProceduresRouter } from "./modules/procedures.router";
import { createReservationSeriesRouter } from "./modules/reservation-series.router";
import { createReservationsRouter } from "./modules/reservations.router";
import { createScheduleRouter } from "./modules/schedule.router";
import { createServiceRequestsRouter } from "./modules/service-requests.router";
import { createSessionRouter } from "./modules/session.router";
import { createStaffRouter } from "./modules/staff.router";

export function createTranzitRpcRouter() {
	return {
		session: createSessionRouter(),
		citizen: createCitizenRouter(),
		documents: createDocumentsRouter(),
		admin: {
			onboarding: createOnboardingRouter(),
			schedule: createScheduleRouter(),
			staff: createStaffRouter(),
			bookings: createBookingsRouter(),
			procedures: createProceduresRouter(),
			serviceRequests: createServiceRequestsRouter(),
			reservationSeries: createReservationSeriesRouter(),
			reservations: createReservationsRouter(),
		},
	};
}
