import nodemailer from "nodemailer";

type OtpPurpose =
	| "sign-in"
	| "email-verification"
	| "forget-password"
	| "change-email";

type SendMailInput = {
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

const otpCopyByType: Record<
	OtpPurpose,
	{
		subject: string;
		title: string;
		description: string;
	}
> = {
	"sign-in": {
		subject: "Codigo de acceso SIMUT Tulua",
		title: "Codigo de acceso",
		description:
			"Use este codigo para continuar el ingreso o registro transparente en SIMUT Tulua.",
	},
	"email-verification": {
		subject: "Verificacion de correo SIMUT Tulua",
		title: "Verifique su correo",
		description:
			"Use este codigo para verificar su direccion de correo en SIMUT Tulua.",
	},
	"forget-password": {
		subject: "Recuperacion de cuenta SIMUT Tulua",
		title: "Recuperacion de cuenta",
		description:
			"Use este codigo para restablecer el acceso a su cuenta de SIMUT Tulua.",
	},
	"change-email": {
		subject: "Cambio de correo SIMUT Tulua",
		title: "Cambio de correo",
		description:
			"Use este codigo para confirmar el cambio de correo en SIMUT Tulua.",
	},
};

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
	const copy = otpCopyByType[type];

	await sendMail({
		to: email,
		subject: copy.subject,
		text: `${copy.description}\n\nCodigo: ${otp}\n\nSi usted no solicito este codigo, ignore este correo.`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
				<h1 style="font-size: 24px; margin-bottom: 16px;">${copy.title}</h1>
				<p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
					${copy.description}
				</p>
				<div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
					<div style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">
						Codigo OTP
					</div>
					<div style="font-size: 32px; font-weight: 700; letter-spacing: 0.24em; color: #111827;">
						${otp}
					</div>
				</div>
				<p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
					Si usted no solicito este codigo, ignore este correo.
				</p>
			</div>
		`,
	});
}
