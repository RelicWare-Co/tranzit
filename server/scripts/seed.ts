import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { listScheduleSlotsByDate } from "../src/features/schedule/schedule-slots-admin.service";
import { db, schema } from "../src/lib/db";

const { user, staffProfile, procedureType, scheduleTemplate, appointmentSlot } =
	schema;

function formatDateLocal(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function ensureBaseUsers() {
	const adminEmail = "admin@simut.gov.co";
	const staffEmail = "maria.garcia@simut.gov.co";

	let adminUser = await db.query.user.findFirst({
		where: eq(user.email, adminEmail),
	});

	if (!adminUser) {
		const adminId = "admin-001";
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
		adminUser = await db.query.user.findFirst({ where: eq(user.id, adminId) });
		console.log(`created admin user: ${adminEmail}`);
	} else {
		console.log(`admin user already exists: ${adminEmail}`);
	}

	let staffUser = await db.query.user.findFirst({
		where: eq(user.email, staffEmail),
	});

	if (!staffUser) {
		const staffId = "staff-001";
		await db.insert(user).values({
			id: staffId,
			name: "Maria Garcia",
			firstName: "Maria",
			lastName: "Garcia",
			email: staffEmail,
			emailVerified: true,
			role: "staff",
			status: "active",
		});
		staffUser = await db.query.user.findFirst({ where: eq(user.id, staffId) });
		console.log(`created staff user: ${staffEmail}`);
	} else {
		console.log(`staff user already exists: ${staffEmail}`);
	}

	if (!staffUser) {
		throw new Error("staff user could not be created or loaded");
	}

	const existingProfile = await db.query.staffProfile.findFirst({
		where: eq(staffProfile.userId, staffUser.id),
	});

	if (!existingProfile) {
		await db.insert(staffProfile).values({
			userId: staffUser.id,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 25,
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
			notes: "Perfil base para pruebas locales",
			metadata: {},
		});
		console.log(`created staff profile for user: ${staffUser.id}`);
	} else {
		console.log(`staff profile already exists for user: ${staffUser.id}`);
	}
}

async function ensureProcedureTypes() {
	const procedures = [
		{
			slug: "renovacion-licencia",
			name: "Renovacion de Licencia de Conduccion",
			description: "Renovacion de licencia vigente",
			requiresVehicle: false,
			allowsPhysicalDocuments: true,
			allowsDigitalDocuments: true,
			instructions: "Traer licencia anterior y recibo de pago",
		},
		{
			slug: "traspaso-vehiculo",
			name: "Traspaso de Vehiculo",
			description: "Traspaso de propiedad de vehiculo automotor",
			requiresVehicle: true,
			allowsPhysicalDocuments: true,
			allowsDigitalDocuments: false,
			instructions: "Documento de identidad, tarjeta de propiedad y formulario",
		},
		{
			slug: "matricula-vehiculo",
			name: "Matricula de Vehiculo",
			description: "Primera matricula de vehiculo nuevo",
			requiresVehicle: true,
			allowsPhysicalDocuments: true,
			allowsDigitalDocuments: true,
			instructions: "Factura de compra, SOAT y revision tecnico-mecanica",
		},
	];

	for (const procedure of procedures) {
		const existing = await db.query.procedureType.findFirst({
			where: eq(procedureType.slug, procedure.slug),
		});

		if (existing) {
			console.log(`procedure already exists: ${procedure.slug}`);
			continue;
		}

		await db.insert(procedureType).values({
			id: crypto.randomUUID(),
			slug: procedure.slug,
			name: procedure.name,
			description: procedure.description,
			isActive: true,
			configVersion: 1,
			requiresVehicle: procedure.requiresVehicle,
			allowsPhysicalDocuments: procedure.allowsPhysicalDocuments,
			allowsDigitalDocuments: procedure.allowsDigitalDocuments,
			instructions: procedure.instructions,
			eligibilitySchema: {},
			formSchema: {},
			documentSchema: {},
			policySchema: {},
		});
		console.log(`created procedure: ${procedure.slug}`);
	}
}

async function ensureScheduleTemplates() {
	const templates = [1, 2, 3, 4, 5].map((weekday) => ({
		weekday,
		morningStart: "08:00",
		morningEnd: "12:00",
		afternoonStart: "14:00",
		afternoonEnd: "17:00",
	}));

	for (const template of templates) {
		const existing = await db.query.scheduleTemplate.findFirst({
			where: eq(scheduleTemplate.weekday, template.weekday),
		});

		if (existing) {
			console.log(
				`schedule template already exists for weekday ${template.weekday}`,
			);
			continue;
		}

		await db.insert(scheduleTemplate).values({
			id: crypto.randomUUID(),
			weekday: template.weekday,
			isEnabled: true,
			morningStart: template.morningStart,
			morningEnd: template.morningEnd,
			afternoonStart: template.afternoonStart,
			afternoonEnd: template.afternoonEnd,
			slotDurationMinutes: 30,
			bufferMinutes: 5,
			slotCapacityLimit: null,
			notes: "Template base generado por script de seed",
		});
		console.log(`created schedule template for weekday ${template.weekday}`);
	}
}

async function ensureSlotsNextDays(days = 7) {
	const today = new Date();

	for (let offset = 0; offset < days; offset += 1) {
		const target = new Date(today);
		target.setDate(today.getDate() + offset);
		const dateStr = formatDateLocal(target);

		await listScheduleSlotsByDate(dateStr);

		const totalSlots = await db.query.appointmentSlot.findMany({
			where: eq(appointmentSlot.slotDate, dateStr),
		});

		console.log(`slots ready for ${dateStr}: ${totalSlots.length}`);
	}
}

async function printSummary() {
	const users = await db.query.user.findMany();
	const staff = await db.query.staffProfile.findMany();
	const procedures = await db.query.procedureType.findMany();
	const templates = await db.query.scheduleTemplate.findMany();

	const today = formatDateLocal(new Date());
	const todaySlots = await db.query.appointmentSlot.findMany({
		where: and(eq(appointmentSlot.slotDate, today)),
	});

	console.log("seed completed");
	console.log(`users: ${users.length}`);
	console.log(`staff profiles: ${staff.length}`);
	console.log(`procedure types: ${procedures.length}`);
	console.log(`schedule templates: ${templates.length}`);
	console.log(`today slots (${today}): ${todaySlots.length}`);
}

async function seed() {
	console.log("starting seed...");
	await ensureBaseUsers();
	await ensureProcedureTypes();
	await ensureScheduleTemplates();
	await ensureSlotsNextDays(7);
	await printSummary();
}

seed().catch((error) => {
	console.error("seed failed", error);
	process.exit(1);
});
