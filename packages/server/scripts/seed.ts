import "dotenv/config";
import { hashPassword } from "@better-auth/utils/password";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";

const {
  user,
  account,
  staffProfile,
  staffDateOverride,
  procedureType,
  scheduleTemplate,
  calendarOverride,
  appointmentSlot,
  serviceRequest,
  booking,
  bookingSeries,
  auditEvent,
  notificationDelivery,
  appSetting,
} = schema;

/* ─────────────── helpers ─────────────── */

function uuid(): string {
  return crypto.randomUUID();
}

function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function timeStr(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ─────────────── entities ─────────────── */

async function seedAppSettings() {
  const rows = [
    {
      key: "onboarding_completed",
      value: { completed: true, completedAt: new Date().toISOString() },
      description: "Indica si el onboarding inicial del sistema fue completado",
    },
    {
      key: "citizen_otp_ttl_seconds",
      value: { value: 300 },
      description: "Tiempo de vida del código OTP ciudadano en segundos",
    },
  ];

  for (const row of rows) {
    const existing = await db.query.appSetting.findFirst({
      where: eq(appSetting.key, row.key),
    });
    if (!existing) {
      await db.insert(appSetting).values({ ...row, updatedByUserId: null });
      console.log(`appSetting created: ${row.key}`);
    }
  }
}

type CitizenUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
};

async function seedUsersAndStaff(): Promise<{
  adminId: string | null;
  citizenUsers: CitizenUser[];
}> {
  const adminEmail = "admin@simut.gov.co";
  const adminPassword = "admin123";

  let adminUser = await db.query.user.findFirst({
    where: eq(user.email, adminEmail),
  });

  if (!adminUser) {
    const adminId = uuid();
    await db.insert(user).values({
      id: adminId,
      name: "Administrador SIMUT",
      firstName: "Administrador",
      lastName: "SIMUT",
      email: adminEmail,
      emailVerified: true,
      role: "admin",
      status: "active",
    });
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(account).values({
      id: uuid(),
      accountId: adminEmail,
      providerId: "credential",
      userId: adminId,
      password: passwordHash,
    });
    adminUser = await db.query.user.findFirst({ where: eq(user.id, adminId) });
    console.log(`admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`admin already exists: ${adminEmail}`);
  }

  const staffFixtures = [
    {
      email: "maria.garcia@simut.gov.co",
      name: "Maria Garcia",
      firstName: "Maria",
      lastName: "Garcia",
      capacity: 25,
      notes: "Auxiliar de trámites de licencias y matrículas",
    },
    {
      email: "carlos.lopez@simut.gov.co",
      name: "Carlos Lopez",
      firstName: "Carlos",
      lastName: "Lopez",
      capacity: 20,
      notes: "Auxiliar especializado en traspasos",
    },
  ];

  for (const fixture of staffFixtures) {
    let staffUser = await db.query.user.findFirst({
      where: eq(user.email, fixture.email),
    });
    if (!staffUser) {
      const id = uuid();
      await db.insert(user).values({
        id,
        name: fixture.name,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        email: fixture.email,
        emailVerified: true,
        role: "staff",
        status: "active",
      });
      staffUser = await db.query.user.findFirst({ where: eq(user.id, id) });
      console.log(`staff user created: ${fixture.email}`);
    } else {
      console.log(`staff user already exists: ${fixture.email}`);
    }

    if (!staffUser) continue;

    const existingProfile = await db.query.staffProfile.findFirst({
      where: eq(staffProfile.userId, staffUser.id),
    });

    if (!existingProfile) {
      await db.insert(staffProfile).values({
        userId: staffUser.id,
        isActive: true,
        isAssignable: true,
        defaultDailyCapacity: fixture.capacity,
        weeklyAvailability: {
          "1": {
            enabled: true,
            morningStart: "08:00",
            morningEnd: "12:00",
            afternoonStart: "14:00",
            afternoonEnd: "17:00",
          },
          "2": {
            enabled: true,
            morningStart: "08:00",
            morningEnd: "12:00",
            afternoonStart: "14:00",
            afternoonEnd: "17:00",
          },
          "3": {
            enabled: true,
            morningStart: "08:00",
            morningEnd: "12:00",
            afternoonStart: "14:00",
            afternoonEnd: "17:00",
          },
          "4": {
            enabled: true,
            morningStart: "08:00",
            morningEnd: "12:00",
            afternoonStart: "14:00",
            afternoonEnd: "17:00",
          },
          "5": {
            enabled: true,
            morningStart: "08:00",
            morningEnd: "12:00",
            afternoonStart: "14:00",
            afternoonEnd: "17:00",
          },
        },
        notes: fixture.notes,
        metadata: {},
      });
      console.log(`staff profile created for ${fixture.email}`);
    }
  }

  const citizenFixtures = [
    {
      email: "ciudadano1@ejemplo.com",
      name: "Juan Perez",
      firstName: "Juan",
      lastName: "Perez",
      documentType: "CC",
      documentNumber: "1234567890",
      phone: "+573001234567",
    },
    {
      email: "ciudadano2@ejemplo.com",
      name: "Ana Martinez",
      firstName: "Ana",
      lastName: "Martinez",
      documentType: "CC",
      documentNumber: "0987654321",
      phone: "+573009876543",
    },
  ];

  const citizenUsers: CitizenUser[] = [];

  for (const fixture of citizenFixtures) {
    let existing = await db.query.user.findFirst({
      where: eq(user.email, fixture.email),
    });
    if (!existing) {
      const id = uuid();
      await db.insert(user).values({
        id,
        name: fixture.name,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        email: fixture.email,
        emailVerified: true,
        documentType: fixture.documentType,
        documentNumber: fixture.documentNumber,
        phone: fixture.phone,
        role: "user",
        status: "active",
      });
      existing = await db.query.user.findFirst({ where: eq(user.id, id) });
      console.log(`citizen created: ${fixture.email}`);
    } else {
      console.log(`citizen already exists: ${fixture.email}`);
    }

    if (existing) {
      citizenUsers.push({
        id: existing.id,
        email: existing.email,
        name: existing.name,
        phone: existing.phone,
        documentType: existing.documentType,
        documentNumber: existing.documentNumber,
      });
    }
  }

  return { adminId: adminUser?.id ?? null, citizenUsers };
}

async function seedStaffOverrides() {
  const staffList = await db.query.staffProfile.findMany();
  if (staffList.length === 0) return;

  const today = new Date();
  const overrideDate = formatDateLocal(addDays(today, 2));

  for (const staff of staffList) {
    const existing = await db.query.staffDateOverride.findFirst({
      where: eq(staffDateOverride.staffUserId, staff.userId),
    });
    if (existing) continue;

    await db.insert(staffDateOverride).values({
      id: uuid(),
      staffUserId: staff.userId,
      overrideDate,
      isAvailable: true,
      capacityOverride: 15,
      availableStartTime: "08:00",
      availableEndTime: "12:00",
      notes: "Disponibilidad reducida por capacitación interna",
    });
    console.log(`staff override created for ${staff.userId} on ${overrideDate}`);
    break; // solo un override de ejemplo
  }
}

async function seedProcedureTypes() {
  const procedures = [
    {
      slug: "renovacion-licencia",
      name: "Renovación de Licencia de Conducción",
      description: "Renovación de licencia de conducción vigente",
      requiresVehicle: false,
      allowsPhysicalDocuments: true,
      allowsDigitalDocuments: false,
      instructions:
        "Traer licencia anterior, recibo de pago y realizar examen médico. La cita es presencial.",
      eligibilitySchema: {
        fields: [
          { key: "hasValidLicense", label: "¿Tiene licencia vigente?", type: "boolean" },
          { key: "medicalCheck", label: "¿Aprobó examen médico?", type: "boolean" },
        ],
      },
      formSchema: {
        sections: [
          {
            title: "Datos del solicitante",
            fields: [
              { key: "fullName", label: "Nombre completo", type: "text", required: true },
              { key: "document", label: "Número de documento", type: "text", required: true },
              { key: "licenseCategory", label: "Categoría de licencia", type: "select", options: ["A1", "A2", "B1", "B2", "C1", "C2"] },
            ],
          },
        ],
      },
      documentSchema: {
        required: [
          { key: "licenciaAnterior", label: "Licencia anterior" },
          { key: "reciboPago", label: "Recibo de pago" },
          { key: "certificadoMedico", label: "Certificado médico" },
        ],
      },
      policySchema: {
        cancellationHours: 24,
        reschedulingAllowed: true,
        maxReschedules: 2,
      },
    },
    {
      slug: "traspaso-vehiculo",
      name: "Traspaso de Vehículo",
      description: "Traspaso de propiedad de vehículo automotor",
      requiresVehicle: true,
      allowsPhysicalDocuments: true,
      allowsDigitalDocuments: false,
      instructions:
        "Documento de identidad de ambas partes, tarjeta de propiedad, SOAT vigente y formulario de traspaso debidamente diligenciado.",
      eligibilitySchema: {
        fields: [
          { key: "hasSOAT", label: "¿Tiene SOAT vigente?", type: "boolean" },
          { key: "noPendingFines", label: "¿Sin comparendos pendientes?", type: "boolean" },
        ],
      },
      formSchema: {
        sections: [
          {
            title: "Datos del vendedor",
            fields: [
              { key: "sellerName", label: "Nombre del vendedor", type: "text", required: true },
              { key: "sellerDocument", label: "Documento del vendedor", type: "text", required: true },
            ],
          },
          {
            title: "Datos del comprador",
            fields: [
              { key: "buyerName", label: "Nombre del comprador", type: "text", required: true },
              { key: "buyerDocument", label: "Documento del comprador", type: "text", required: true },
            ],
          },
          {
            title: "Datos del vehículo",
            fields: [
              { key: "plate", label: "Placa", type: "text", required: true },
              { key: "brand", label: "Marca", type: "text" },
              { key: "model", label: "Modelo", type: "text" },
              { key: "year", label: "Año", type: "number" },
            ],
          },
        ],
      },
      documentSchema: {
        required: [
          { key: "tarjetaPropiedad", label: "Tarjeta de propiedad" },
          { key: "soat", label: "SOAT vigente" },
          { key: "formularioTraspaso", label: "Formulario de traspaso" },
          { key: "cedulaVendedor", label: "Cédula del vendedor" },
          { key: "cedulaComprador", label: "Cédula del comprador" },
        ],
      },
      policySchema: {
        cancellationHours: 48,
        reschedulingAllowed: true,
        maxReschedules: 1,
      },
    },
    {
      slug: "matricula-vehiculo",
      name: "Matrícula de Vehículo",
      description: "Primera matrícula de vehículo nuevo o importado",
      requiresVehicle: true,
      allowsPhysicalDocuments: true,
      allowsDigitalDocuments: false,
      instructions:
        "Factura de compra, SOAT, revisión técnico-mecánica y certificado de importación si aplica.",
      eligibilitySchema: {
        fields: [
          { key: "isNewVehicle", label: "¿Es vehículo nuevo?", type: "boolean" },
          { key: "hasInvoice", label: "¿Tiene factura de compra?", type: "boolean" },
        ],
      },
      formSchema: {
        sections: [
          {
            title: "Información del vehículo",
            fields: [
              { key: "vin", label: "VIN / Chasis", type: "text", required: true },
              { key: "engineNumber", label: "Número de motor", type: "text", required: true },
              { key: "brand", label: "Marca", type: "text", required: true },
              { key: "model", label: "Línea / Modelo", type: "text", required: true },
              { key: "year", label: "Año de fabricación", type: "number", required: true },
              { key: "color", label: "Color", type: "text" },
            ],
          },
        ],
      },
      documentSchema: {
        required: [
          { key: "facturaCompra", label: "Factura de compra" },
          { key: "soat", label: "SOAT" },
          { key: "revisionTecnomecanica", label: "Revisión técnico-mecánica" },
        ],
      },
      policySchema: {
        cancellationHours: 24,
        reschedulingAllowed: false,
        maxReschedules: 0,
      },
    },
  ];

  for (const proc of procedures) {
    const existing = await db.query.procedureType.findFirst({
      where: eq(procedureType.slug, proc.slug),
    });
    if (existing) {
      console.log(`procedure already exists: ${proc.slug}`);
      continue;
    }

    await db.insert(procedureType).values({
      id: uuid(),
      slug: proc.slug,
      name: proc.name,
      description: proc.description,
      isActive: true,
      configVersion: 1,
      requiresVehicle: proc.requiresVehicle,
      allowsPhysicalDocuments: proc.allowsPhysicalDocuments,
      allowsDigitalDocuments: proc.allowsDigitalDocuments,
      instructions: proc.instructions,
      eligibilitySchema: proc.eligibilitySchema,
      formSchema: proc.formSchema,
      documentSchema: proc.documentSchema,
      policySchema: proc.policySchema,
    });
    console.log(`procedure created: ${proc.slug}`);
  }
}

async function seedScheduleTemplates() {
  const templates = [
    { weekday: 1, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00" },
    { weekday: 2, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00" },
    { weekday: 3, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00" },
    { weekday: 4, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00" },
    { weekday: 5, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00" },
  ];

  for (const t of templates) {
    const existing = await db.query.scheduleTemplate.findFirst({
      where: eq(scheduleTemplate.weekday, t.weekday),
    });
    if (existing) {
      console.log(`schedule template already exists for weekday ${t.weekday}`);
      continue;
    }

    await db.insert(scheduleTemplate).values({
      id: uuid(),
      weekday: t.weekday,
      isEnabled: true,
      morningStart: t.morningStart,
      morningEnd: t.morningEnd,
      afternoonStart: t.afternoonStart,
      afternoonEnd: t.afternoonEnd,
      slotDurationMinutes: 30,
      bufferMinutes: 5,
      slotCapacityLimit: null,
      notes: "Horario base de atención al público",
    });
    console.log(`schedule template created for weekday ${t.weekday}`);
  }
}

async function seedCalendarOverrides() {
  const today = new Date();
  const holidayDate = formatDateLocal(addDays(today, 5));

  const existing = await db.query.calendarOverride.findFirst({
    where: eq(calendarOverride.overrideDate, holidayDate),
  });

  if (!existing) {
    await db.insert(calendarOverride).values({
      id: uuid(),
      overrideDate: holidayDate,
      isClosed: true,
      morningEnabled: false,
      afternoonEnabled: false,
      reason: "Día festivo - No hay atención al público",
    });
    console.log(`calendar override created (closed): ${holidayDate}`);
  }
}

async function seedAppointmentSlots(days = 14) {
  const today = new Date();
  const slotDuration = 30;
  const buffer = 5;

  for (let offset = 0; offset < days; offset++) {
    const target = addDays(today, offset);
    const dateStr = formatDateLocal(target);
    const weekday = target.getDay();

    if (weekday === 0 || weekday === 6) continue;

    const override = await db.query.calendarOverride.findFirst({
      where: eq(calendarOverride.overrideDate, dateStr),
    });
    if (override?.isClosed) continue;

    const template = await db.query.scheduleTemplate.findFirst({
      where: eq(scheduleTemplate.weekday, weekday),
    });
    if (!template || !template.isEnabled) continue;

    const periods: Array<{ start: string; end: string }> = [];
    if (template.morningStart && template.morningEnd) {
      periods.push({ start: template.morningStart, end: template.morningEnd });
    }
    if (template.afternoonStart && template.afternoonEnd) {
      periods.push({ start: template.afternoonStart, end: template.afternoonEnd });
    }

    for (const period of periods) {
      const [sh, sm] = period.start.split(":").map(Number);
      const [eh, em] = period.end.split(":").map(Number);
      let current = sh * 60 + sm;
      const end = eh * 60 + em;

      while (current + slotDuration <= end) {
        const startH = Math.floor(current / 60);
        const startM = current % 60;
        const endH = Math.floor((current + slotDuration) / 60);
        const endM = (current + slotDuration) % 60;
        const startTime = timeStr(startH, startM);
        const endTime = timeStr(endH, endM);

        const allDateSlots = await db.query.appointmentSlot.findMany({
          where: eq(appointmentSlot.slotDate, dateStr),
        });
        const already = allDateSlots.find((s) => s.startTime === startTime);

        if (!already) {
          await db.insert(appointmentSlot).values({
            id: uuid(),
            slotDate: dateStr,
            startTime,
            endTime,
            status: "open",
            capacityLimit: null,
            generatedFrom: "seed",
          });
        }

        current += slotDuration + buffer;
      }
    }
  }
  console.log(`appointment slots seeded for next ${days} days`);
}

async function seedBookingsAndRequests(citizenUsers: CitizenUser[]) {
  const procedures = await db.query.procedureType.findMany();
  const slots = await db.query.appointmentSlot.findMany({
    where: eq(appointmentSlot.status, "open"),
  });

  if (citizenUsers.length === 0 || procedures.length === 0 || slots.length === 0) {
    console.log("skipping bookings: missing citizens, procedures or slots");
    return;
  }

  const combos: Array<{ citizenIdx: number; procIdx: number; slotIdx: number; status: string }> = [
    { citizenIdx: 0, procIdx: 0, slotIdx: 0, status: "confirmed" },
    { citizenIdx: 1, procIdx: 1, slotIdx: 2, status: "confirmed" },
    { citizenIdx: 0, procIdx: 2, slotIdx: 4, status: "hold" },
  ];

  for (const combo of combos) {
    const citizen = citizenUsers[combo.citizenIdx % citizenUsers.length];
    const proc = procedures[combo.procIdx % procedures.length];
    const slot = slots[combo.slotIdx % slots.length];

    const requestId = uuid();
    const bookingId = uuid();
    const now = new Date();
    const holdExpires = combo.status === "hold" ? addDays(now, 1) : null;

    // 1. Insert service_request without activeBookingId to break circular FK
    await db.insert(serviceRequest).values({
      id: requestId,
      procedureTypeId: proc.id,
      citizenUserId: citizen.id,
      email: citizen.email,
      phone: citizen.phone,
      documentType: citizen.documentType,
      documentNumber: citizen.documentNumber,
      status: combo.status === "confirmed" ? "confirmed" : "draft",
      procedureConfigVersion: proc.configVersion,
      draftData: {
        procedureSlug: proc.slug,
        applicantName: citizen.name,
        applicantDocument: citizen.documentNumber,
      },
      procedureSnapshot: {
        name: proc.name,
        instructions: proc.instructions,
      },
      confirmedAt: combo.status === "confirmed" ? now : null,
    });

    // 2. Insert booking referencing the service_request
    await db.insert(booking).values({
      id: bookingId,
      slotId: slot.id,
      requestId,
      citizenUserId: citizen.id,
      kind: "citizen",
      status: combo.status,
      isActive: true,
      holdToken: combo.status === "hold" ? uuid() : null,
      holdExpiresAt: holdExpires,
      snapshot: {
        citizenName: citizen.name,
        procedureName: proc.name,
      },
      confirmedAt: combo.status === "confirmed" ? now : null,
    });

    // 3. Update service_request with activeBookingId
    await db.update(serviceRequest)
      .set({ activeBookingId: bookingId })
      .where(eq(serviceRequest.id, requestId));

    console.log(`booking created: ${combo.status} for ${citizen.email} on ${slot.slotDate} ${slot.startTime}`);
  }

  // Create an administrative booking series
  const seriesId = uuid();
  await db.insert(bookingSeries).values({
    id: seriesId,
    kind: "administrative",
    recurrenceRule: {
      freq: "WEEKLY",
      byday: ["MO", "WE"],
      count: 4,
    },
    timezone: "America/Bogota",
    isActive: true,
    notes: "Bloque administrativo para revisión de documentos",
  });

  const adminSlots = slots.slice(6, 8);
  for (const slot of adminSlots) {
    await db.insert(booking).values({
      id: uuid(),
      slotId: slot.id,
      kind: "administrative",
      status: "active",
      isActive: true,
      seriesKey: seriesId,
      notes: "Reserva administrativa recurrente",
    });
  }
  console.log(`administrative series created with ${adminSlots.length} bookings`);
}

async function seedAuditAndNotifications(adminId: string | null) {
  if (adminId) {
    await db.insert(auditEvent).values({
      id: uuid(),
      actorType: "user",
      actorUserId: adminId,
      entityType: "procedure_type",
      entityId: "system",
      action: "seed",
      summary: "Ejecución inicial del script de seed",
      payload: { source: "seed.ts", timestamp: new Date().toISOString() },
    });
    console.log("audit event created");
  }

  const requests = await db.query.serviceRequest.findMany();
  for (const req of requests.slice(0, 2)) {
    await db.insert(notificationDelivery).values({
      id: uuid(),
      channel: "email",
      templateKey: "booking_confirmation",
      entityType: "service_request",
      entityId: req.id,
      recipient: req.email,
      status: "pending",
      attemptCount: 0,
      payload: { requestId: req.id },
    });
  }
  console.log(`notification deliveries created: ${Math.min(requests.length, 2)}`);
}

async function printSummary() {
  const counts = {
    users: await db.query.user.findMany(),
    staff: await db.query.staffProfile.findMany(),
    procedures: await db.query.procedureType.findMany(),
    templates: await db.query.scheduleTemplate.findMany(),
    overrides: await db.query.calendarOverride.findMany(),
    slots: await db.query.appointmentSlot.findMany(),
    requests: await db.query.serviceRequest.findMany(),
    bookings: await db.query.booking.findMany(),
    series: await db.query.bookingSeries.findMany(),
    audit: await db.query.auditEvent.findMany(),
    notifications: await db.query.notificationDelivery.findMany(),
  };

  console.log("\n=== SEED COMPLETED ===");
  console.log(`users:              ${counts.users.length}`);
  console.log(`staff profiles:     ${counts.staff.length}`);
  console.log(`procedure types:    ${counts.procedures.length}`);
  console.log(`schedule templates: ${counts.templates.length}`);
  console.log(`calendar overrides: ${counts.overrides.length}`);
  console.log(`appointment slots:  ${counts.slots.length}`);
  console.log(`service requests:   ${counts.requests.length}`);
  console.log(`bookings:           ${counts.bookings.length}`);
  console.log(`booking series:     ${counts.series.length}`);
  console.log(`audit events:       ${counts.audit.length}`);
  console.log(`notifications:      ${counts.notifications.length}`);
  console.log("======================\n");
}

/* ─────────────── main ─────────────── */

async function seed() {
  console.log("starting seed...\n");
  await seedAppSettings();
  const { adminId, citizenUsers } = await seedUsersAndStaff();
  await seedStaffOverrides();
  await seedProcedureTypes();
  await seedScheduleTemplates();
  await seedCalendarOverrides();
  await seedAppointmentSlots(14);
  await seedBookingsAndRequests(citizenUsers);
  await seedAuditAndNotifications(adminId);
  await printSummary();
}

seed().catch((error) => {
  console.error("seed failed:", error);
  process.exit(1);
});
