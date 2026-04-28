import { createAuditRouter } from "../../features/audit/router";
import { createBookingsRouter } from "../../features/bookings/router";
import { createCitizenRouter } from "../../features/citizen/router";
import { createOnboardingRouter } from "../../features/auth/onboarding.router";
import { createProceduresRouter } from "../../features/schedule/procedures.router";
import { createReservationSeriesRouter } from "../../features/reservations/series.router";
import { createReservationsRouter } from "../../features/reservations/instance.router";
import { createScheduleRouter } from "../../features/schedule/schedule.router";
import { createServiceRequestsRouter } from "../../features/service-requests/router";
import { createSessionRouter } from "../../features/auth/session.router";
import { createStaffRouter } from "../../features/staff/router";

export function createTranzitRpcRouter() {
	return {
		session: createSessionRouter(),
		citizen: createCitizenRouter(),
		admin: {
			onboarding: createOnboardingRouter(),
			schedule: createScheduleRouter(),
			staff: createStaffRouter(),
			bookings: createBookingsRouter(),
			procedures: createProceduresRouter(),
			serviceRequests: createServiceRequestsRouter(),
			reservationSeries: createReservationSeriesRouter(),
			reservations: createReservationsRouter(),
			audit: createAuditRouter(),
		},
	};
}
