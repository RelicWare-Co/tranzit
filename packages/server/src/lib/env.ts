export const CORS_ORIGIN =
	process.env.CORS_ORIGIN || "https://tranzit.localhost";

export const TRUSTED_ORIGINS = process.env.TRUSTED_ORIGINS
	? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim())
	: ["http://localhost:3000", "http://localhost:5173"];
