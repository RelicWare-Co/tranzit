/// <reference path="../pb_data/types.d.ts" />

const USERS_COLLECTION = "users"
const BOOKING_SETTINGS_COLLECTION = "booking_settings"
const SERVICE_TYPES_COLLECTION = "service_types"
const STAFF_MEMBERS_COLLECTION = "staff_members"
const OFFICE_HOUR_TEMPLATES_COLLECTION = "office_hour_templates"
const OFFICE_HOUR_OVERRIDES_COLLECTION = "office_hour_overrides"
const STAFF_CAPACITY_OVERRIDES_COLLECTION = "staff_capacity_overrides"
const MANAGER_SLOT_TEMPLATES_COLLECTION = "manager_slot_templates"
const MANAGER_SLOT_OVERRIDES_COLLECTION = "manager_slot_overrides"
const APPOINTMENTS_COLLECTION = "appointments"

const OFFICE_NAME = "Servicios Integrados de Movilidad Urbana de Tuluá S.A.S."
const DATE_KEY_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const DEFAULT_WINDOWS = [
  { label: "Jornada manana", startMinutes: 7 * 60, endMinutes: 11 * 60 + 40, sortOrder: 10 },
  { label: "Jornada tarde", startMinutes: 13 * 60 + 45, endMinutes: 17 * 60 + 5, sortOrder: 20 },
]

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(field)
  }
}

function removeFieldIfExists(collection, fieldName) {
  if (collection.fields.getByName(fieldName)) {
    collection.fields.removeByName(fieldName)
  }
}

function createCollection(app, collection) {
  app.save(collection)
  return app.findCollectionByNameOrId(collection.name)
}

function deleteCollectionIfExists(app, name) {
  try {
    const collection = app.findCollectionByNameOrId(name)
    app.delete(collection)
  } catch {}
}

function saveRecord(app, collection, data) {
  const record = new Record(collection)
  for (const key in data) {
    record.set(key, data[key])
  }
  app.save(record)
  return record
}

function seedBookingSettings(app, collection) {
  try {
    app.findFirstRecordByFilter(collection, "key = {:key}", { key: "main" })
  } catch {
    saveRecord(app, collection, {
      key: "main",
      office_name: OFFICE_NAME,
      timezone_label: "America/Bogota",
      utc_offset_minutes: -300,
      booking_horizon_days: 30,
      minimum_notice_minutes: 30,
      hold_duration_minutes: 10,
      slot_interval_minutes: 15,
      default_appointment_duration_minutes: 15,
      default_daily_capacity: 25,
      manager_reserved_slots_per_assistant: 2,
      locale: "es-CO",
    })
  }
}

function seedDefaultOfficeWindows(app, collection) {
  if (app.countRecords(collection) > 0) {
    return
  }

  for (const weekday of WEEKDAYS) {
    for (const window of DEFAULT_WINDOWS) {
      saveRecord(app, collection, {
        weekday,
        label: window.label,
        start_minutes: window.startMinutes,
        end_minutes: window.endMinutes,
        is_active: true,
        sort_order: window.sortOrder,
      })
    }
  }
}

migrate((app) => {
  const users = app.findCollectionByNameOrId(USERS_COLLECTION)

  addFieldIfMissing(users, new TextField({
    name: "phone",
    max: 32,
  }))
  addFieldIfMissing(users, new SelectField({
    name: "document_type",
    values: [
      "cedula_ciudadania",
      "cedula_extranjeria",
      "tarjeta_identidad",
      "pasaporte",
      "nit",
      "otro",
    ],
    maxSelect: 1,
  }))
  addFieldIfMissing(users, new TextField({
    name: "document_number",
    max: 32,
  }))
  addFieldIfMissing(users, new TextField({
    name: "last_vehicle_plate",
    max: 16,
    pattern: "^[A-Z0-9-]{0,16}$",
  }))

  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = null
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = null
  users.manageRule = "id = @request.auth.id"
  users.otp.enabled = true
  users.otp.duration = 600
  users.otp.length = 6
  users.otp.emailTemplate.subject = "Codigo de acceso para {APP_NAME}"
  users.otp.emailTemplate.body = `
<p>Hola,</p>
<p>Tu codigo de acceso para continuar en {APP_NAME} es:</p>
<p><strong style="font-size: 24px; letter-spacing: 0.12em;">{OTP}</strong></p>
<p>Este codigo vence pronto. Si no solicitaste el acceso, puedes ignorar este correo.</p>
<p>Gracias,<br />Equipo {APP_NAME}</p>
`.trim()
  users.addIndex("idx_users_document_number", true, "document_number", "document_number != ''")
  app.save(users)

  const bookingSettings = createCollection(app, new Collection({
    type: "base",
    name: BOOKING_SETTINGS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "key",
        required: true,
        max: 32,
        pattern: "^[a-z0-9_-]+$",
      }),
      new TextField({
        name: "office_name",
        required: true,
        max: 160,
      }),
      new TextField({
        name: "timezone_label",
        required: true,
        max: 120,
      }),
      new NumberField({
        name: "utc_offset_minutes",
        required: true,
        onlyInt: true,
        min: -720,
        max: 840,
      }),
      new NumberField({
        name: "booking_horizon_days",
        required: true,
        onlyInt: true,
        min: 1,
        max: 180,
      }),
      new NumberField({
        name: "minimum_notice_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1440,
      }),
      new NumberField({
        name: "hold_duration_minutes",
        required: true,
        onlyInt: true,
        min: 1,
        max: 60,
      }),
      new NumberField({
        name: "slot_interval_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 120,
      }),
      new NumberField({
        name: "default_appointment_duration_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new NumberField({
        name: "default_daily_capacity",
        required: true,
        onlyInt: true,
        min: 1,
        max: 60,
      }),
      new NumberField({
        name: "manager_reserved_slots_per_assistant",
        required: true,
        onlyInt: true,
        min: 0,
        max: 10,
      }),
      new TextField({
        name: "locale",
        required: true,
        max: 16,
      }),
    ],
  }))
  bookingSettings.addIndex("idx_booking_settings_key", true, "key", "")

  const serviceTypes = createCollection(app, new Collection({
    type: "base",
    name: SERVICE_TYPES_COLLECTION,
    listRule: "is_active = true",
    viewRule: "is_active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "code",
        required: true,
        max: 32,
        pattern: "^[A-Z0-9_-]+$",
      }),
      new TextField({
        name: "slug",
        required: true,
        max: 120,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      }),
      new TextField({
        name: "name",
        required: true,
        max: 120,
        presentable: true,
      }),
      new TextField({
        name: "description",
        max: 2000,
      }),
      new TextField({
        name: "instructions",
        max: 4000,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
      new NumberField({
        name: "appointment_duration_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new BoolField({
        name: "requires_vehicle_registered_locally",
      }),
      new BoolField({
        name: "requires_digital_form_upload",
      }),
      new BoolField({
        name: "allows_physical_delivery",
      }),
      new FileField({
        name: "form_template",
        maxSelect: 1,
        maxSize: 15 * 1024 * 1024,
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      }),
      new JSONField({
        name: "eligibility_schema",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "intake_schema",
        maxSize: 128 * 1024,
      }),
    ],
  }))
  serviceTypes.addIndex("idx_service_types_code", true, "code", "")
  serviceTypes.addIndex("idx_service_types_slug", true, "slug", "")

  const staffMembers = createCollection(app, new Collection({
    type: "base",
    name: STAFF_MEMBERS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "code",
        required: true,
        max: 32,
        pattern: "^[A-Z0-9_-]+$",
      }),
      new TextField({
        name: "full_name",
        required: true,
        max: 120,
        presentable: true,
      }),
      new EmailField({
        name: "email",
      }),
      new TextField({
        name: "phone",
        max: 32,
      }),
      new SelectField({
        name: "role",
        required: true,
        values: ["assistant", "manager", "admin"],
        maxSelect: 1,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "daily_capacity",
        required: true,
        onlyInt: true,
        min: 1,
        max: 60,
      }),
      new TextField({
        name: "color",
        max: 16,
      }),
      new NumberField({
        name: "display_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
    ],
  }))
  staffMembers.addIndex("idx_staff_members_code", true, "code", "")
  staffMembers.addIndex("idx_staff_members_email", true, "email", "email != ''")

  const officeHourTemplates = createCollection(app, new Collection({
    type: "base",
    name: OFFICE_HOUR_TEMPLATES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new SelectField({
        name: "weekday",
        required: true,
        values: WEEKDAYS,
        maxSelect: 1,
      }),
      new TextField({
        name: "label",
        required: true,
        max: 64,
      }),
      new NumberField({
        name: "start_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "end_minutes",
        required: true,
        onlyInt: true,
        min: 1,
        max: 1440,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
    ],
  }))
  officeHourTemplates.addIndex("idx_office_hour_templates_unique", true, "weekday, start_minutes, end_minutes", "")

  const officeHourOverrides = createCollection(app, new Collection({
    type: "base",
    name: OFFICE_HOUR_OVERRIDES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "office_date",
        required: true,
        max: 10,
        pattern: DATE_KEY_PATTERN,
      }),
      new TextField({
        name: "label",
        max: 64,
      }),
      new NumberField({
        name: "start_minutes",
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "end_minutes",
        onlyInt: true,
        min: 1,
        max: 1440,
      }),
      new BoolField({
        name: "is_active",
      }),
      new BoolField({
        name: "is_closed",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
      new TextField({
        name: "notes",
        max: 512,
      }),
    ],
  }))
  officeHourOverrides.addIndex("idx_office_hour_overrides_lookup", false, "office_date, sort_order, start_minutes", "")

  const staffCapacityOverrides = createCollection(app, new Collection({
    type: "base",
    name: STAFF_CAPACITY_OVERRIDES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "staff",
        required: true,
        collectionId: staffMembers.id,
        maxSelect: 1,
      }),
      new TextField({
        name: "office_date",
        required: true,
        max: 10,
        pattern: DATE_KEY_PATTERN,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "daily_capacity",
        onlyInt: true,
        min: 1,
        max: 60,
      }),
      new TextField({
        name: "notes",
        max: 512,
      }),
    ],
  }))
  staffCapacityOverrides.addIndex("idx_staff_capacity_overrides_unique", true, "staff, office_date", "")

  const managerSlotTemplates = createCollection(app, new Collection({
    type: "base",
    name: MANAGER_SLOT_TEMPLATES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "staff",
        required: true,
        collectionId: staffMembers.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "weekday",
        required: true,
        values: WEEKDAYS,
        maxSelect: 1,
      }),
      new TextField({
        name: "label",
        required: true,
        max: 64,
      }),
      new NumberField({
        name: "start_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "duration_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
    ],
  }))
  managerSlotTemplates.addIndex("idx_manager_slot_templates_unique", true, "staff, weekday, start_minutes", "")

  const managerSlotOverrides = createCollection(app, new Collection({
    type: "base",
    name: MANAGER_SLOT_OVERRIDES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "staff",
        required: true,
        collectionId: staffMembers.id,
        maxSelect: 1,
      }),
      new TextField({
        name: "office_date",
        required: true,
        max: 10,
        pattern: DATE_KEY_PATTERN,
      }),
      new TextField({
        name: "label",
        max: 64,
      }),
      new NumberField({
        name: "start_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "duration_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new BoolField({
        name: "is_active",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
    ],
  }))
  managerSlotOverrides.addIndex("idx_manager_slot_overrides_unique", true, "staff, office_date, start_minutes", "")

  const appointments = createCollection(app, new Collection({
    type: "base",
    name: APPOINTMENTS_COLLECTION,
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "reference",
        max: 32,
        pattern: "^TRZ-[A-Z0-9]{8}$",
        autogeneratePattern: "TRZ-[A-Z0-9]{8}",
        presentable: true,
      }),
      new RelationField({
        name: "user",
        collectionId: users.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "service",
        required: true,
        collectionId: serviceTypes.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "assistant",
        required: true,
        collectionId: staffMembers.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: ["held", "confirmed", "cancelled", "expired", "completed", "no_show"],
        maxSelect: 1,
      }),
      new SelectField({
        name: "source",
        required: true,
        values: ["public_portal", "manager", "admin"],
        maxSelect: 1,
      }),
      new TextField({
        name: "office_date",
        required: true,
        max: 10,
        pattern: DATE_KEY_PATTERN,
      }),
      new NumberField({
        name: "slot_start_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "slot_end_minutes",
        required: true,
        onlyInt: true,
        min: 1,
        max: 1440,
      }),
      new DateField({
        name: "hold_expires_at",
      }),
      new DateField({
        name: "confirmed_at",
      }),
      new DateField({
        name: "cancelled_at",
      }),
      new TextField({
        name: "applicant_name",
        max: 120,
      }),
      new EmailField({
        name: "applicant_email",
      }),
      new TextField({
        name: "applicant_phone",
        max: 32,
      }),
      new SelectField({
        name: "document_type",
        values: [
          "cedula_ciudadania",
          "cedula_extranjeria",
          "tarjeta_identidad",
          "pasaporte",
          "nit",
          "otro",
        ],
        maxSelect: 1,
      }),
      new TextField({
        name: "document_number",
        max: 32,
      }),
      new TextField({
        name: "vehicle_plate",
        max: 16,
        pattern: "^[A-Z0-9-]{0,16}$",
      }),
      new BoolField({
        name: "vehicle_registered_locally",
      }),
      new SelectField({
        name: "delivery_mode",
        values: ["digital_upload", "physical_delivery"],
        maxSelect: 1,
      }),
      new FileField({
        name: "attachments",
        maxSelect: 8,
        maxSize: 20 * 1024 * 1024,
        protected: true,
        mimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      }),
      new JSONField({
        name: "initial_checks",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "intake_payload",
        maxSize: 256 * 1024,
      }),
      new TextField({
        name: "internal_notes",
        max: 4000,
        hidden: true,
      }),
    ],
  }))
  appointments.addIndex("idx_appointments_reference", true, "reference", "reference != ''")
  appointments.addIndex("idx_appointments_user_date", false, "user, office_date", "")
  appointments.addIndex("idx_appointments_date_status", false, "office_date, status", "")
  appointments.addIndex(
    "idx_appointments_active_slot_per_assistant",
    true,
    "assistant, office_date, slot_start_minutes",
    "status = 'held' OR status = 'confirmed'",
  )

  seedBookingSettings(app, bookingSettings)
  seedDefaultOfficeWindows(app, officeHourTemplates)
}, (app) => {
  deleteCollectionIfExists(app, APPOINTMENTS_COLLECTION)
  deleteCollectionIfExists(app, MANAGER_SLOT_OVERRIDES_COLLECTION)
  deleteCollectionIfExists(app, MANAGER_SLOT_TEMPLATES_COLLECTION)
  deleteCollectionIfExists(app, STAFF_CAPACITY_OVERRIDES_COLLECTION)
  deleteCollectionIfExists(app, OFFICE_HOUR_OVERRIDES_COLLECTION)
  deleteCollectionIfExists(app, OFFICE_HOUR_TEMPLATES_COLLECTION)
  deleteCollectionIfExists(app, STAFF_MEMBERS_COLLECTION)
  deleteCollectionIfExists(app, SERVICE_TYPES_COLLECTION)
  deleteCollectionIfExists(app, BOOKING_SETTINGS_COLLECTION)

  const users = app.findCollectionByNameOrId(USERS_COLLECTION)
  removeFieldIfExists(users, "phone")
  removeFieldIfExists(users, "document_type")
  removeFieldIfExists(users, "document_number")
  removeFieldIfExists(users, "last_vehicle_plate")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = ""
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  users.manageRule = null
  users.otp.enabled = false
  users.otp.duration = 180
  users.otp.length = 8
  users.otp.emailTemplate.subject = "OTP for {APP_NAME}"
  users.otp.emailTemplate.body = `
<p>Hello,</p>
<p>Your one-time password is: <strong>{OTP}</strong></p>
<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>
<p>Thanks,<br />{APP_NAME} team</p>
`.trim()
  users.removeIndex("idx_users_document_number")
  app.save(users)
})
