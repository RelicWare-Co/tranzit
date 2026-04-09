import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { db, schema } from "./db";
import { sendVerificationOtpEmail } from "./mailer";

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
	throw new Error("Missing BETTER_AUTH_SECRET in environment variables.");
}

const readPositiveInt = (value: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(value ?? "", 10);

	if (Number.isNaN(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
};

const otpLength = readPositiveInt(process.env.AUTH_OTP_LENGTH, 6);
const otpExpiresIn = readPositiveInt(process.env.AUTH_OTP_EXPIRES_IN, 300);
const otpAllowedAttempts = readPositiveInt(
	process.env.AUTH_OTP_ALLOWED_ATTEMPTS,
	3,
);

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
	secret,
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema,
	}),
	plugins: [
		admin(),
		emailOTP({
			otpLength,
			expiresIn: otpExpiresIn,
			allowedAttempts: otpAllowedAttempts,
			storeOTP: "hashed",
			async sendVerificationOTP({ email, otp, type }) {
				await sendVerificationOtpEmail({
					email,
					otp,
					type,
				});
			},
		}),
	],
	emailAndPassword: {
		enabled: true,
	},
});
