import nodemailer from "nodemailer";
import { sendOtpNotification } from "../notifications/notification.service";

export type OtpPurpose =
	| "sign-in"
	| "email-verification"
	| "forget-password"
	| "change-email";

export type SendMailInput = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? "1025", 10);
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpHost = process.env.SMTP_HOST ?? "127.0.0.1";
const mailFrom = process.env.MAIL_FROM ?? "SIMUT Tulua <no-reply@simut.local>";

const transporter = nodemailer.createTransport({
	host: smtpHost,
	port: Number.isNaN(smtpPort) ? 1025 : smtpPort,
	secure: smtpSecure,
	...(process.env.SMTP_USER
		? {
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS ?? "",
				},
			}
		: {}),
});

export async function sendMail({ to, subject, text, html }: SendMailInput) {
	await transporter.sendMail({
		from: mailFrom,
		to,
		subject,
		text,
		html,
	});
}

export async function sendVerificationOtpEmail({
	email,
	otp,
	type,
}: {
	email: string;
	otp: string;
	type: OtpPurpose;
}) {
	// Route through notification service to create notification_delivery record
	await sendOtpNotification({ email, otp, type });
}
