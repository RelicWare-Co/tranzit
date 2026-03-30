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

function saveRecord(app, collection, data) {
  const record = new Record(collection)
  for (const key in data) {
    record.set(key, data[key])
  }
  app.save(record)
  return record
}

function deleteRecordsByFilter(app, collectionName, filter, params) {
  const records = app.findRecordsByFilter(collectionName, filter, "", 500, 0, params || {})
  for (const record of records) {
    app.delete(record)
  }
}

function ensureBookingSettingsRecord(app) {
  try {
    app.findFirstRecordByFilter(BOOKING_SETTINGS_COLLECTION, "key = {:key}", { key: "main" })
  } catch {
    const collection = app.findCollectionByNameOrId(BOOKING_SETTINGS_COLLECTION)
    saveRecord(app, collection, {
      key: "main",
      office_name: "Servicios Integrados de Movilidad Urbana de Tuluá S.A.S.",
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

function ensureOfficeWindows(app) {
  const existing = app.findRecordsByFilter(
    OFFICE_HOUR_TEMPLATES_COLLECTION,
    "weekday != ''",
    "",
    1,
    0,
    {},
  )

  if (existing.length > 0) {
    return
  }

  const collection = app.findCollectionByNameOrId(OFFICE_HOUR_TEMPLATES_COLLECTION)
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
  const serviceTypes = app.findCollectionByNameOrId(SERVICE_TYPES_COLLECTION)
  const staffMembers = app.findCollectionByNameOrId(STAFF_MEMBERS_COLLECTION)
  const bookingSettings = app.findCollectionByNameOrId(BOOKING_SETTINGS_COLLECTION)
  const officeHourTemplates = app.findCollectionByNameOrId(OFFICE_HOUR_TEMPLATES_COLLECTION)
  const officeHourOverrides = app.findCollectionByNameOrId(OFFICE_HOUR_OVERRIDES_COLLECTION)
  const staffCapacityOverrides = app.findCollectionByNameOrId(STAFF_CAPACITY_OVERRIDES_COLLECTION)
  const managerSlotTemplates = app.findCollectionByNameOrId(MANAGER_SLOT_TEMPLATES_COLLECTION)
  const managerSlotOverrides = app.findCollectionByNameOrId(MANAGER_SLOT_OVERRIDES_COLLECTION)
  const appointments = app.findCollectionByNameOrId(APPOINTMENTS_COLLECTION)

  bookingSettings.listRule = null
  bookingSettings.viewRule = null
  bookingSettings.createRule = null
  bookingSettings.updateRule = null
  bookingSettings.deleteRule = null
  addFieldIfMissing(bookingSettings, new TextField({
    name: "key",
    required: true,
    max: 32,
    pattern: "^[a-z0-9_-]+$",
  }))
  addFieldIfMissing(bookingSettings, new TextField({
    name: "office_name",
    required: true,
    max: 160,
  }))
  addFieldIfMissing(bookingSettings, new TextField({
    name: "timezone_label",
    required: true,
    max: 120,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "utc_offset_minutes",
    required: true,
    onlyInt: true,
    min: -720,
    max: 840,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "booking_horizon_days",
    required: true,
    onlyInt: true,
    min: 1,
    max: 180,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "minimum_notice_minutes",
    required: true,
    onlyInt: true,
    min: 0,
    max: 1440,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "hold_duration_minutes",
    required: true,
    onlyInt: true,
    min: 1,
    max: 60,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "slot_interval_minutes",
    required: true,
    onlyInt: true,
    min: 5,
    max: 120,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "default_appointment_duration_minutes",
    required: true,
    onlyInt: true,
    min: 5,
    max: 240,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "default_daily_capacity",
    required: true,
    onlyInt: true,
    min: 1,
    max: 60,
  }))
  addFieldIfMissing(bookingSettings, new NumberField({
    name: "manager_reserved_slots_per_assistant",
    required: true,
    onlyInt: true,
    min: 0,
    max: 10,
  }))
  addFieldIfMissing(bookingSettings, new TextField({
    name: "locale",
    required: true,
    max: 16,
  }))
  app.save(bookingSettings)

  serviceTypes.listRule = "is_active = true"
  serviceTypes.viewRule = "is_active = true"
  serviceTypes.createRule = null
  serviceTypes.updateRule = null
  serviceTypes.deleteRule = null
  addFieldIfMissing(serviceTypes, new TextField({
    name: "code",
    required: true,
    max: 32,
    pattern: "^[A-Z0-9_-]+$",
  }))
  addFieldIfMissing(serviceTypes, new TextField({
    name: "slug",
    required: true,
    max: 120,
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  }))
  addFieldIfMissing(serviceTypes, new TextField({
    name: "name",
    required: true,
    max: 120,
    presentable: true,
  }))
  addFieldIfMissing(serviceTypes, new TextField({
    name: "description",
    max: 2000,
  }))
  addFieldIfMissing(serviceTypes, new TextField({
    name: "instructions",
    max: 4000,
  }))
  addFieldIfMissing(serviceTypes, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(serviceTypes, new NumberField({
    name: "sort_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  addFieldIfMissing(serviceTypes, new NumberField({
    name: "appointment_duration_minutes",
    required: true,
    onlyInt: true,
    min: 5,
    max: 240,
  }))
  addFieldIfMissing(serviceTypes, new BoolField({
    name: "requires_vehicle_registered_locally",
  }))
  addFieldIfMissing(serviceTypes, new BoolField({
    name: "requires_digital_form_upload",
  }))
  addFieldIfMissing(serviceTypes, new BoolField({
    name: "allows_physical_delivery",
  }))
  addFieldIfMissing(serviceTypes, new FileField({
    name: "form_template",
    maxSelect: 1,
    maxSize: 15 * 1024 * 1024,
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  }))
  addFieldIfMissing(serviceTypes, new JSONField({
    name: "eligibility_schema",
    maxSize: 64 * 1024,
  }))
  addFieldIfMissing(serviceTypes, new JSONField({
    name: "intake_schema",
    maxSize: 128 * 1024,
  }))
  app.save(serviceTypes)

  staffMembers.listRule = null
  staffMembers.viewRule = null
  staffMembers.createRule = null
  staffMembers.updateRule = null
  staffMembers.deleteRule = null
  addFieldIfMissing(staffMembers, new TextField({
    name: "code",
    required: true,
    max: 32,
    pattern: "^[A-Z0-9_-]+$",
  }))
  addFieldIfMissing(staffMembers, new TextField({
    name: "full_name",
    required: true,
    max: 120,
    presentable: true,
  }))
  addFieldIfMissing(staffMembers, new EmailField({
    name: "email",
  }))
  addFieldIfMissing(staffMembers, new TextField({
    name: "phone",
    max: 32,
  }))
  addFieldIfMissing(staffMembers, new SelectField({
    name: "role",
    required: true,
    values: ["assistant", "manager", "admin"],
    maxSelect: 1,
  }))
  addFieldIfMissing(staffMembers, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(staffMembers, new NumberField({
    name: "daily_capacity",
    required: true,
    onlyInt: true,
    min: 1,
    max: 60,
  }))
  addFieldIfMissing(staffMembers, new TextField({
    name: "color",
    max: 16,
  }))
  addFieldIfMissing(staffMembers, new NumberField({
    name: "display_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  app.save(staffMembers)

  officeHourTemplates.listRule = null
  officeHourTemplates.viewRule = null
  officeHourTemplates.createRule = null
  officeHourTemplates.updateRule = null
  officeHourTemplates.deleteRule = null
  addFieldIfMissing(officeHourTemplates, new SelectField({
    name: "weekday",
    required: true,
    values: WEEKDAYS,
    maxSelect: 1,
  }))
  addFieldIfMissing(officeHourTemplates, new TextField({
    name: "label",
    required: true,
    max: 64,
  }))
  addFieldIfMissing(officeHourTemplates, new NumberField({
    name: "start_minutes",
    required: true,
    onlyInt: true,
    min: 0,
    max: 1439,
  }))
  addFieldIfMissing(officeHourTemplates, new NumberField({
    name: "end_minutes",
    required: true,
    onlyInt: true,
    min: 1,
    max: 1440,
  }))
  addFieldIfMissing(officeHourTemplates, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(officeHourTemplates, new NumberField({
    name: "sort_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  app.save(officeHourTemplates)

  officeHourOverrides.listRule = null
  officeHourOverrides.viewRule = null
  officeHourOverrides.createRule = null
  officeHourOverrides.updateRule = null
  officeHourOverrides.deleteRule = null
  addFieldIfMissing(officeHourOverrides, new TextField({
    name: "office_date",
    required: true,
    max: 10,
    pattern: DATE_KEY_PATTERN,
  }))
  addFieldIfMissing(officeHourOverrides, new TextField({
    name: "label",
    max: 64,
  }))
  addFieldIfMissing(officeHourOverrides, new NumberField({
    name: "start_minutes",
    onlyInt: true,
    min: 0,
    max: 1439,
  }))
  addFieldIfMissing(officeHourOverrides, new NumberField({
    name: "end_minutes",
    onlyInt: true,
    min: 1,
    max: 1440,
  }))
  addFieldIfMissing(officeHourOverrides, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(officeHourOverrides, new BoolField({
    name: "is_closed",
  }))
  addFieldIfMissing(officeHourOverrides, new NumberField({
    name: "sort_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  addFieldIfMissing(officeHourOverrides, new TextField({
    name: "notes",
    max: 512,
  }))
  app.save(officeHourOverrides)

  staffCapacityOverrides.listRule = null
  staffCapacityOverrides.viewRule = null
  staffCapacityOverrides.createRule = null
  staffCapacityOverrides.updateRule = null
  staffCapacityOverrides.deleteRule = null
  addFieldIfMissing(staffCapacityOverrides, new RelationField({
    name: "staff",
    required: true,
    collectionId: staffMembers.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(staffCapacityOverrides, new TextField({
    name: "office_date",
    required: true,
    max: 10,
    pattern: DATE_KEY_PATTERN,
  }))
  addFieldIfMissing(staffCapacityOverrides, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(staffCapacityOverrides, new NumberField({
    name: "daily_capacity",
    onlyInt: true,
    min: 1,
    max: 60,
  }))
  addFieldIfMissing(staffCapacityOverrides, new TextField({
    name: "notes",
    max: 512,
  }))
  app.save(staffCapacityOverrides)

  managerSlotTemplates.listRule = null
  managerSlotTemplates.viewRule = null
  managerSlotTemplates.createRule = null
  managerSlotTemplates.updateRule = null
  managerSlotTemplates.deleteRule = null
  addFieldIfMissing(managerSlotTemplates, new RelationField({
    name: "staff",
    required: true,
    collectionId: staffMembers.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(managerSlotTemplates, new SelectField({
    name: "weekday",
    required: true,
    values: WEEKDAYS,
    maxSelect: 1,
  }))
  addFieldIfMissing(managerSlotTemplates, new TextField({
    name: "label",
    required: true,
    max: 64,
  }))
  addFieldIfMissing(managerSlotTemplates, new NumberField({
    name: "start_minutes",
    required: true,
    onlyInt: true,
    min: 0,
    max: 1439,
  }))
  addFieldIfMissing(managerSlotTemplates, new NumberField({
    name: "duration_minutes",
    required: true,
    onlyInt: true,
    min: 5,
    max: 240,
  }))
  addFieldIfMissing(managerSlotTemplates, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(managerSlotTemplates, new NumberField({
    name: "sort_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  app.save(managerSlotTemplates)

  managerSlotOverrides.listRule = null
  managerSlotOverrides.viewRule = null
  managerSlotOverrides.createRule = null
  managerSlotOverrides.updateRule = null
  managerSlotOverrides.deleteRule = null
  addFieldIfMissing(managerSlotOverrides, new RelationField({
    name: "staff",
    required: true,
    collectionId: staffMembers.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(managerSlotOverrides, new TextField({
    name: "office_date",
    required: true,
    max: 10,
    pattern: DATE_KEY_PATTERN,
  }))
  addFieldIfMissing(managerSlotOverrides, new TextField({
    name: "label",
    max: 64,
  }))
  addFieldIfMissing(managerSlotOverrides, new NumberField({
    name: "start_minutes",
    required: true,
    onlyInt: true,
    min: 0,
    max: 1439,
  }))
  addFieldIfMissing(managerSlotOverrides, new NumberField({
    name: "duration_minutes",
    required: true,
    onlyInt: true,
    min: 5,
    max: 240,
  }))
  addFieldIfMissing(managerSlotOverrides, new BoolField({
    name: "is_active",
  }))
  addFieldIfMissing(managerSlotOverrides, new NumberField({
    name: "sort_order",
    onlyInt: true,
    min: 0,
    max: 9999,
  }))
  app.save(managerSlotOverrides)

  appointments.listRule = "user = @request.auth.id"
  appointments.viewRule = "user = @request.auth.id"
  appointments.createRule = null
  appointments.updateRule = null
  appointments.deleteRule = null
  addFieldIfMissing(appointments, new TextField({
    name: "reference",
    max: 32,
    pattern: "^TRZ-[A-Z0-9]{8}$",
    autogeneratePattern: "TRZ-[A-Z0-9]{8}",
    presentable: true,
  }))
  addFieldIfMissing(appointments, new RelationField({
    name: "user",
    collectionId: users.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new RelationField({
    name: "service",
    required: true,
    collectionId: serviceTypes.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new RelationField({
    name: "assistant",
    required: true,
    collectionId: staffMembers.id,
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new SelectField({
    name: "status",
    required: true,
    values: ["held", "confirmed", "cancelled", "expired", "completed", "no_show"],
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new SelectField({
    name: "source",
    required: true,
    values: ["public_portal", "manager", "admin"],
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new TextField({
    name: "office_date",
    required: true,
    max: 10,
    pattern: DATE_KEY_PATTERN,
  }))
  addFieldIfMissing(appointments, new NumberField({
    name: "slot_start_minutes",
    required: true,
    onlyInt: true,
    min: 0,
    max: 1439,
  }))
  addFieldIfMissing(appointments, new NumberField({
    name: "slot_end_minutes",
    required: true,
    onlyInt: true,
    min: 1,
    max: 1440,
  }))
  addFieldIfMissing(appointments, new DateField({
    name: "hold_expires_at",
  }))
  addFieldIfMissing(appointments, new DateField({
    name: "confirmed_at",
  }))
  addFieldIfMissing(appointments, new DateField({
    name: "cancelled_at",
  }))
  addFieldIfMissing(appointments, new TextField({
    name: "applicant_name",
    max: 120,
  }))
  addFieldIfMissing(appointments, new EmailField({
    name: "applicant_email",
  }))
  addFieldIfMissing(appointments, new TextField({
    name: "applicant_phone",
    max: 32,
  }))
  addFieldIfMissing(appointments, new SelectField({
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
  addFieldIfMissing(appointments, new TextField({
    name: "document_number",
    max: 32,
  }))
  addFieldIfMissing(appointments, new TextField({
    name: "vehicle_plate",
    max: 16,
    pattern: "^[A-Z0-9-]{0,16}$",
  }))
  addFieldIfMissing(appointments, new BoolField({
    name: "vehicle_registered_locally",
  }))
  addFieldIfMissing(appointments, new SelectField({
    name: "delivery_mode",
    values: ["digital_upload", "physical_delivery"],
    maxSelect: 1,
  }))
  addFieldIfMissing(appointments, new FileField({
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
  }))
  addFieldIfMissing(appointments, new JSONField({
    name: "initial_checks",
    maxSize: 64 * 1024,
  }))
  addFieldIfMissing(appointments, new JSONField({
    name: "intake_payload",
    maxSize: 256 * 1024,
  }))
  addFieldIfMissing(appointments, new TextField({
    name: "internal_notes",
    max: 4000,
    hidden: true,
  }))
  app.save(appointments)

  deleteRecordsByFilter(app, BOOKING_SETTINGS_COLLECTION, "key = ''", {})
  deleteRecordsByFilter(app, OFFICE_HOUR_TEMPLATES_COLLECTION, "weekday = ''", {})
  deleteRecordsByFilter(app, OFFICE_HOUR_OVERRIDES_COLLECTION, "office_date = ''", {})
  deleteRecordsByFilter(app, STAFF_MEMBERS_COLLECTION, "code = ''", {})
  deleteRecordsByFilter(app, STAFF_CAPACITY_OVERRIDES_COLLECTION, "office_date = ''", {})
  deleteRecordsByFilter(app, MANAGER_SLOT_TEMPLATES_COLLECTION, "weekday = ''", {})
  deleteRecordsByFilter(app, MANAGER_SLOT_OVERRIDES_COLLECTION, "office_date = ''", {})
  deleteRecordsByFilter(app, SERVICE_TYPES_COLLECTION, "code = ''", {})
  deleteRecordsByFilter(app, APPOINTMENTS_COLLECTION, "service = ''", {})

  bookingSettings.addIndex("idx_booking_settings_key", true, "key", "")
  app.save(bookingSettings)

  serviceTypes.addIndex("idx_service_types_code", true, "code", "")
  serviceTypes.addIndex("idx_service_types_slug", true, "slug", "")
  app.save(serviceTypes)

  staffMembers.addIndex("idx_staff_members_code", true, "code", "")
  staffMembers.addIndex("idx_staff_members_email", true, "email", "email != ''")
  app.save(staffMembers)

  officeHourTemplates.addIndex("idx_office_hour_templates_unique", true, "weekday, start_minutes, end_minutes", "")
  app.save(officeHourTemplates)

  officeHourOverrides.addIndex("idx_office_hour_overrides_lookup", false, "office_date, sort_order, start_minutes", "")
  app.save(officeHourOverrides)

  staffCapacityOverrides.addIndex("idx_staff_capacity_overrides_unique", true, "staff, office_date", "")
  app.save(staffCapacityOverrides)

  managerSlotTemplates.addIndex("idx_manager_slot_templates_unique", true, "staff, weekday, start_minutes", "")
  app.save(managerSlotTemplates)

  managerSlotOverrides.addIndex("idx_manager_slot_overrides_unique", true, "staff, office_date, start_minutes", "")
  app.save(managerSlotOverrides)

  appointments.addIndex("idx_appointments_reference", true, "reference", "reference != ''")
  appointments.addIndex("idx_appointments_user_date", false, "user, office_date", "")
  appointments.addIndex("idx_appointments_date_status", false, "office_date, status", "")
  appointments.addIndex(
    "idx_appointments_active_slot_per_assistant",
    true,
    "assistant, office_date, slot_start_minutes",
    "status = 'held' OR status = 'confirmed'",
  )
  app.save(appointments)

  ensureBookingSettingsRecord(app)
  ensureOfficeWindows(app)
}, (_app) => {})
