import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { logger } from "../../lib/logger";
import { sendMail } from "../auth/auth.mailer";
import type { TemplateContext } from "./notification-templates";
import {
	bookingCancellationTemplate,
	bookingConfirmationTemplate,
	holdExpirationTemplate,
	otpTemplate,
} from "./notification-templates";

export type NotificationChannel = "email";

export type NotificationTemplateKey =
	| "booking-confirmation"
	| "booking-cancellation"
	| "booking-hold-expired"
	| "otp-sign-in"
	| "otp-email-verification"
	| "otp-forget-password"
	| "otp-change-email";

export type NotificationStatus = "pending" | "sent" | "failed";

type SendNotificationInput = {
	channel: NotificationChannel;
	templateKey: NotificationTemplateKey;
	entityType: string;
	entityId: string;
	recipient: string;
	context: TemplateContext;
};

/**
 * Send an email notification and record the delivery status in the database.
 *
 * This function:
 * 1. Creates a notification_delivery record with status=pending
 * 2. Attempts to send the email via nodemailer
 * 3. Updates the record with status=sent or status=failed
 *
 * Failures in email sending are caught and logged; they do not throw.
 */
export async function sendNotification({
	channel,
	templateKey,
	entityType,
	entityId,
	recipient,
	context,
}: SendNotificationInput): Promise<void> {
	const now = new Date();

	// Select the appropriate template
	const template =
		templateKey === "booking-confirmation"
			? bookingConfirmationTemplate
			: templateKey === "booking-cancellation"
				? bookingCancellationTemplate
				: templateKey === "booking-hold-expired"
					? holdExpirationTemplate
					: otpTemplate;

	// Create the notification_delivery record with status=pending
	const notificationId = crypto.randomUUID();
	const notification = await db
		.insert(schema.notificationDelivery)
		.values({
			id: notificationId,
			channel,
			templateKey,
			entityType,
			entityId,
			recipient,
			status: "pending",
			attemptCount: 0,
			payload: context as unknown as Record<string, unknown>,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	if (!notification[0]) {
		logger.error(
			{ templateKey, entityType, entityId, recipient },
			"Failed to create notification_delivery record",
		);
		return;
	}

	// Attempt to send the email
	try {
		const subject = template.subject(context);
		const text = template.text(context);
		const html = template.html(context);

		await sendMail({ to: recipient, subject, text, html });

		// Update with success
		await db
			.update(schema.notificationDelivery)
			.set({
				status: "sent",
				attemptCount: 1,
				sentAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(schema.notificationDelivery.id, notificationId));

		logger.info(
			{ notificationId, templateKey, recipient, entityId },
			"Notification sent successfully",
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error(
			{ notificationId, templateKey, recipient, entityId, err: error },
			"Failed to send notification",
		);

		// Update with failure
		await db
			.update(schema.notificationDelivery)
			.set({
				status: "failed",
				attemptCount: 1,
				lastAttemptAt: new Date(),
				errorMessage,
				updatedAt: new Date(),
			})
			.where(eq(schema.notificationDelivery.id, notificationId));
	}
}

/**
 * Send a booking confirmation email notification.
 */
export async function sendBookingConfirmationEmail(params: {
	bookingId: string;
	recipient: string;
	context: TemplateContext;
}): Promise<void> {
	return sendNotification({
		channel: "email",
		templateKey: "booking-confirmation",
		entityType: "booking",
		entityId: params.bookingId,
		recipient: params.recipient,
		context: params.context,
	});
}

/**
 * Send a booking cancellation email notification.
 */
export async function sendBookingCancellationEmail(params: {
	bookingId: string;
	recipient: string;
	context: TemplateContext;
}): Promise<void> {
	return sendNotification({
		channel: "email",
		templateKey: "booking-cancellation",
		entityType: "booking",
		entityId: params.bookingId,
		recipient: params.recipient,
		context: params.context,
	});
}

/**
 * Send a hold expiration email notification.
 */
export async function sendHoldExpirationEmail(params: {
	bookingId: string;
	recipient: string;
	context: TemplateContext;
}): Promise<void> {
	return sendNotification({
		channel: "email",
		templateKey: "booking-hold-expired",
		entityType: "booking",
		entityId: params.bookingId,
		recipient: params.recipient,
		context: params.context,
	});
}

type OtpPurpose = "sign-in" | "email-verification" | "forget-password" | "change-email";

const otpPurposeToTemplateKey: Record<OtpPurpose, NotificationTemplateKey> = {
	"sign-in": "otp-sign-in",
	"email-verification": "otp-email-verification",
	"forget-password": "otp-forget-password",
	"change-email": "otp-change-email",
};

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

/**
 * Send an OTP email notification and record the delivery status in the database.
 */
export async function sendOtpNotification(params: {
	email: string;
	otp: string;
	type: OtpPurpose;
}): Promise<void> {
	const { email, otp, type } = params;
	const copy = otpCopyByType[type];

	return sendNotification({
		channel: "email",
		templateKey: otpPurposeToTemplateKey[type],
		entityType: "user",
		entityId: email, // Use email as entity identifier for OTP since user may not exist yet
		recipient: email,
		context: {
			otp,
			subject: copy.subject,
			title: copy.title,
			description: copy.description,
		},
	});
}
