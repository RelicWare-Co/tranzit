/**
 * Email notification templates for booking lifecycle events.
 *
 * Templates use a simple interpolation system with placeholder replacement.
 * Each template defines:
 * - subject: Email subject line
 * - text: Plain text body
 * - html: HTML body (inline styles for email compatibility)
 */

type TemplateContext = {
	// Booking-specific fields (optional for OTP templates)
	procedureName?: string;
	appointmentDate?: string;
	appointmentTime?: string;
	appointmentEndTime?: string;
	staffName?: string | null;
	citizenName?: string | null;
	bookingId?: string;
	serviceRequest?: {
		applicantName?: string | null;
		applicantDocument?: string | null;
		plate?: string | null;
	};
	// OTP-specific fields
	otp?: string;
	subject?: string;
	title?: string;
	description?: string;
};

type EmailTemplate = {
	subject: (ctx: TemplateContext) => string;
	text: (ctx: TemplateContext) => string;
	html: (ctx: TemplateContext) => string;
};

const formatDateTime = (date: string, time: string): string => {
	// date is YYYY-MM-DD, time is HH:MM
	const [year, month, day] = date.split("-");
	return `${day}/${month}/${year} ${time}`;
};

export const bookingConfirmationTemplate: EmailTemplate = {
	subject: (ctx) => `Cita confirmada - ${ctx.procedureName!}`,
	text: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		const lines = [
			`Su cita ha sido confirmada exitosamente.`,
			``,
			`Detalles de la cita:`,
			`- Trámite: ${ctx.procedureName}`,
			`- Fecha y hora: ${dateTime}${ctx.appointmentEndTime ? ` - ${formatDateTime(ctx.appointmentDate!, ctx.appointmentEndTime)}` : ""}`,
			`- Funcionario asignado: ${ctx.staffName ?? "Por asignar"}`,
			``,
		];

		if (ctx.serviceRequest) {
			if (ctx.serviceRequest.applicantName) {
				lines.push(`- Solicitante: ${ctx.serviceRequest.applicantName}`);
			}
			if (ctx.serviceRequest.applicantDocument) {
				lines.push(`- Documento: ${ctx.serviceRequest.applicantDocument}`);
			}
			if (ctx.serviceRequest.plate) {
				lines.push(`- Placa: ${ctx.serviceRequest.plate}`);
			}
		}

		lines.push(``);
		lines.push(`Por favor llegue 10 minutos antes de su cita.`);
		lines.push(``);
		if (ctx.bookingId) {
			lines.push(`ID de reserva: ${ctx.bookingId}`);
		}

		return lines.join("\n");
	},
	html: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		return `
			<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
				<div style="background: #10b981; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
					<h1 style="font-size: 24px; margin: 0;">Cita Confirmada</h1>
				</div>
				<div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
					<h2 style="font-size: 18px; margin: 0 0 16px 0; color: #111827;">${ctx.procedureName}</h2>

					<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
						<div style="display: grid; gap: 12px;">
							<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Fecha y Hora</div>
								<div style="font-size: 16px; font-weight: 600;">${dateTime}${ctx.appointmentEndTime ? ` - ${formatDateTime(ctx.appointmentDate!, ctx.appointmentEndTime)}` : ""}</div>
							</div>
							<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Funcionario</div>
								<div style="font-size: 14px;">${ctx.staffName ?? "Por asignar"}</div>
							</div>
							${ctx.serviceRequest?.applicantName ? `<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Solicitante</div>
								<div style="font-size: 14px;">${ctx.serviceRequest.applicantName}</div>
							</div>` : ""}
							${ctx.serviceRequest?.applicantDocument ? `<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Documento</div>
								<div style="font-size: 14px;">${ctx.serviceRequest.applicantDocument}</div>
							</div>` : ""}
							${ctx.serviceRequest?.plate ? `<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Placa</div>
								<div style="font-size: 14px;">${ctx.serviceRequest.plate}</div>
							</div>` : ""}
						</div>
					</div>

					<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
						<p style="font-size: 14px; margin: 0; color: #92400e;">
							<strong>Importante:</strong> Por favor llegue 10 minutos antes de su cita.
						</p>
					</div>

					${ctx.bookingId ? `<div style="text-align: center; margin-top: 16px;">
						<div style="font-size: 12px; color: #9ca3af;">ID de reserva: ${ctx.bookingId}</div>
					</div>` : ""}
				</div>
			</div>
		`;
	},
};

export const bookingCancellationTemplate: EmailTemplate = {
	subject: (ctx) => `Cita cancelada - ${ctx.procedureName!}`,
	text: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		const lines = [
			`Su cita ha sido cancelada.`,
			``,
			`Detalles de la cita cancelada:`,
			`- Trámite: ${ctx.procedureName}`,
			`- Fecha y hora programada: ${dateTime}`,
			``,
		];

		if (ctx.serviceRequest) {
			if (ctx.serviceRequest.applicantName) {
				lines.push(`- Solicitante: ${ctx.serviceRequest.applicantName}`);
			}
		}

		lines.push(``);
		lines.push(`Si tiene preguntas, puede agendar una nueva cita en nuestro portal.`);

		return lines.join("\n");
	},
	html: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		return `
			<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
				<div style="background: #ef4444; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
					<h1 style="font-size: 24px; margin: 0;">Cita Cancelada</h1>
				</div>
				<div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
					<h2 style="font-size: 18px; margin: 0 0 16px 0; color: #111827;">${ctx.procedureName}</h2>

					<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
						<div style="display: grid; gap: 12px;">
							<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Fecha y Hora (Cancelada)</div>
								<div style="font-size: 16px; font-weight: 600; text-decoration: line-through; color: #9ca3af;">${dateTime}</div>
							</div>
							${ctx.serviceRequest?.applicantName ? `<div>
								<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Solicitante</div>
								<div style="font-size: 14px;">${ctx.serviceRequest.applicantName}</div>
							</div>` : ""}
						</div>
					</div>

					<div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px;">
						<p style="font-size: 14px; margin: 0; color: #1e40af;">
							Puede agendar una nueva cita en cualquier momento a través de nuestro portal web.
						</p>
					</div>
				</div>
			</div>
		`;
	},
};

export const holdExpirationTemplate: EmailTemplate = {
	subject: (ctx) => `Reserva temporal expirada - ${ctx.procedureName!}`,
	text: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		const lines = [
			`Su reserva temporal ha expirado sin ser confirmada.`,
			``,
			`Detalles de la reserva expirada:`,
			`- Trámite: ${ctx.procedureName}`,
			`- Fecha y hora reservada: ${dateTime}`,
			``,
			`La reserva temporal tiene una vigencia de 5 minutos. Si no confirmó su cita en ese tiempo, el cupo fue liberado.`,
			``,
			`Puede intentar agendar nuevamente si el horario sigue disponible.`,
		];

		return lines.join("\n");
	},
	html: (ctx) => {
		const dateTime = formatDateTime(ctx.appointmentDate!, ctx.appointmentTime!);
		return `
			<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
				<div style="background: #f59e0b; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
					<h1 style="font-size: 24px; margin: 0;">Reserva Temporal Expirada</h1>
				</div>
				<div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
					<h2 style="font-size: 18px; margin: 0 0 16px 0; color: #111827;">${ctx.procedureName}</h2>

					<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
						<div>
							<div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Fecha y Hora (Reserva Expirada)</div>
							<div style="font-size: 16px; font-weight: 600; color: #9ca3af;">${dateTime}</div>
						</div>
					</div>

					<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px;">
						<p style="font-size: 14px; margin: 0; color: #92400e;">
							<strong>Información:</strong> Las reservas temporales tienen una vigencia de 5 minutos. Si no confirmó su cita en ese tiempo, el cupo fue liberado automáticamente.
						</p>
						<p style="font-size: 14px; margin: 12px 0 0 0; color: #92400e;">
							Puede intentar agendar nuevamente si el horario sigue disponible en nuestro portal.
						</p>
					</div>
				</div>
			</div>
		`;
	},
};

export const otpTemplate: EmailTemplate = {
	subject: (ctx) => ctx.subject ?? "Codigo de acceso SIMUT Tulua",
	text: (ctx) => {
		const lines = [
			ctx.description ?? "Use este codigo para continuar el ingreso o registro transparente en SIMUT Tulua.",
			``,
			`Codigo: ${ctx.otp}`,
			``,
			`Si usted no solicito este codigo, ignore este correo.`,
		];
		return lines.join("\n");
	},
	html: (ctx) => {
		const title = ctx.title ?? "Codigo de acceso";
		const description = ctx.description ?? "Use este codigo para continuar el ingreso o registro transparente en SIMUT Tulua.";

		return `
			<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
				<h1 style="font-size: 24px; margin-bottom: 16px;">${title}</h1>
				<p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
					${description}
				</p>
				<div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
					<div style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">
						Codigo OTP
					</div>
					<div style="font-size: 32px; font-weight: 700; letter-spacing: 0.24em; color: #111827;">
						${ctx.otp}
					</div>
				</div>
				<p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
					Si usted no solicito este codigo, ignore este correo.
				</p>
			</div>
		`;
	},
};

export type { TemplateContext };
