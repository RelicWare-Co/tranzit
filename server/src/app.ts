import { Hono } from "hono";
import { adminOnboardingApp, authApp } from "./features/auth/auth.routes";
import { bookingsApp } from "./features/bookings/bookings.routes";
import {
	reservationInstanceApp,
	reservationSeriesApp,
} from "./features/reservations/reservation-series.routes";
import { scheduleApp } from "./features/schedule/schedule.routes";
import { staffApp } from "./features/staff/staff.routes";
import { requirePermissions, requireRole } from "./middlewares/authorization";
import { adminCorsMiddleware, authCorsMiddleware } from "./middlewares/cors";
import { sessionMiddleware } from "./middlewares/session";
import type { AppVariables } from "./shared/types/app-context";

export const app = new Hono<{ Variables: AppVariables }>();

app.use("/api/auth/*", authCorsMiddleware);
app.use("/api/admin/*", adminCorsMiddleware);

app.use("*", sessionMiddleware);

app.use("/api/auth/admin/*", requireRole("admin"));

app.route("/api/auth", authApp);
app.route("/api/admin/onboard", adminOnboardingApp);

app.use("/api/admin/*", requireRole("admin", "staff", "auditor"));

app.use("/api/admin/schedule/*", requirePermissions({ schedule: ["read"] }));
app.use("/api/admin/staff/*", requirePermissions({ staff: ["read"] }));
app.use("/api/admin/bookings/*", requirePermissions({ booking: ["read"] }));
app.use(
	"/api/admin/reservation-series/*",
	requirePermissions({ "reservation-series": ["read"] }),
);
app.use(
	"/api/admin/reservations/*",
	requirePermissions({ "reservation-series": ["read"] }),
);

app.get("/session", (c) => {
	const user = c.get("user");
	const session = c.get("session");

	if (!user) return c.json(null, 401);

	return c.json({ user, session });
});

app.get("/", (c) => {
	return c.text("Hello Hono + Better Auth");
});

app.route("/api/admin/schedule", scheduleApp);
app.route("/api/admin/staff", staffApp);
app.route("/api/admin/bookings", bookingsApp);
app.route("/api/admin/reservation-series", reservationSeriesApp);
app.route("/api/admin/reservations", reservationInstanceApp);
