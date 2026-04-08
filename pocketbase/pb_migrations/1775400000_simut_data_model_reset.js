/// <reference path="../pb_data/types.d.ts" />

const USERS_COLLECTION = "users"
const OPERATORS_COLLECTION = "operators"
const SYSTEM_SETTINGS_COLLECTION = "system_settings"
const OTP_CHALLENGES_COLLECTION = "otp_challenges"
const PROCEDURE_TYPES_COLLECTION = "procedure_types"
const PROCEDURE_FORM_FIELDS_COLLECTION = "procedure_form_fields"
const PROCEDURE_REQUIRED_DOCUMENTS_COLLECTION = "procedure_required_documents"
const PROCEDURE_REQUESTS_COLLECTION = "procedure_requests"
const REQUEST_DOCUMENTS_COLLECTION = "request_documents"
const SCHEDULE_TEMPLATES_COLLECTION = "schedule_templates"
const SCHEDULE_EXCEPTIONS_COLLECTION = "schedule_exceptions"
const AGENDA_SLOTS_COLLECTION = "agenda_slots"
const SLOT_HOLDS_COLLECTION = "slot_holds"
const APPOINTMENTS_COLLECTION = "appointments"
const ADMIN_RESERVATIONS_COLLECTION = "admin_reservations"
const APPOINTMENT_ASSIGNMENTS_COLLECTION = "appointment_assignments"
const AUDIT_EVENTS_COLLECTION = "audit_events"

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

const LEGACY_COLLECTIONS = [
  "booking_settings",
  "service_types",
  "staff_members",
  "office_hour_templates",
  "office_hour_overrides",
  "staff_capacity_overrides",
  "manager_slot_templates",
  "manager_slot_overrides",
  "appointments",
]

const RESETTABLE_COLLECTIONS = [
  OPERATORS_COLLECTION,
  SYSTEM_SETTINGS_COLLECTION,
  OTP_CHALLENGES_COLLECTION,
  PROCEDURE_TYPES_COLLECTION,
  PROCEDURE_FORM_FIELDS_COLLECTION,
  PROCEDURE_REQUIRED_DOCUMENTS_COLLECTION,
  PROCEDURE_REQUESTS_COLLECTION,
  REQUEST_DOCUMENTS_COLLECTION,
  SCHEDULE_TEMPLATES_COLLECTION,
  SCHEDULE_EXCEPTIONS_COLLECTION,
  AGENDA_SLOTS_COLLECTION,
  SLOT_HOLDS_COLLECTION,
  APPOINTMENTS_COLLECTION,
  ADMIN_RESERVATIONS_COLLECTION,
  APPOINTMENT_ASSIGNMENTS_COLLECTION,
  AUDIT_EVENTS_COLLECTION,
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

function removeIndexIfExists(collection, indexName) {
  try {
    collection.removeIndex(indexName)
  } catch {}
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

function configureCitizenUsers(app, users) {
  addFieldIfMissing(users, new TextField({
    name: "first_names",
    max: 120,
  }))
  addFieldIfMissing(users, new TextField({
    name: "last_names",
    max: 120,
  }))
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
  addFieldIfMissing(users, new SelectField({
    name: "account_status",
    values: ["active", "blocked", "deleted"],
    maxSelect: 1,
  }))
  addFieldIfMissing(users, new DateField({
    name: "last_access_at",
  }))
  addFieldIfMissing(users, new JSONField({
    name: "verification_metadata",
    maxSize: 64 * 1024,
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
  users.otp.emailTemplate.subject = "Codigo de verificacion para {APP_NAME}"
  users.otp.emailTemplate.body = `
<p>Hola,</p>
<p>Tu codigo de verificacion para continuar en {APP_NAME} es:</p>
<p><strong style="font-size: 24px; letter-spacing: 0.12em;">{OTP}</strong></p>
<p>Este codigo vence pronto. Si no solicitaste el acceso, puedes ignorar este correo.</p>
<p>Gracias,<br />Equipo {APP_NAME}</p>
`.trim()

  removeIndexIfExists(users, "idx_users_document_number")
  removeIndexIfExists(users, "idx_users_document_identity")
  removeIndexIfExists(users, "idx_users_account_status")
  users.addIndex("idx_users_document_identity", true, "document_type, document_number", "document_number != ''")
  users.addIndex("idx_users_account_status", false, "account_status", "")

  app.save(users)
}

function restoreDefaultUsers(app, users) {
  removeFieldIfExists(users, "first_names")
  removeFieldIfExists(users, "last_names")
  removeFieldIfExists(users, "phone")
  removeFieldIfExists(users, "document_type")
  removeFieldIfExists(users, "document_number")
  removeFieldIfExists(users, "account_status")
  removeFieldIfExists(users, "last_access_at")
  removeFieldIfExists(users, "verification_metadata")

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

  removeIndexIfExists(users, "idx_users_document_identity")
  removeIndexIfExists(users, "idx_users_account_status")

  app.save(users)
}

function seedSystemSettings(app, collection) {
  try {
    app.findFirstRecordByFilter(collection, "key = {:key}", { key: "main" })
  } catch {
    saveRecord(app, collection, {
      key: "main",
      office_name: "Servicios Integrados de Movilidad Urbana de Tulua S.A.S.",
      timezone_label: "America/Bogota",
      locale: "es-CO",
      otp_expiration_seconds: 600,
      otp_max_attempts: 5,
      otp_max_resends: 3,
      slot_hold_expiration_seconds: 600,
      booking_horizon_days: 30,
      minimum_notice_minutes: 30,
      cancellation_window_minutes: 180,
      reschedule_window_minutes: 180,
      allow_cancellation: true,
      allow_reschedule: true,
      default_slot_minutes: 15,
      default_buffer_minutes: 0,
      default_daily_capacity_per_assistant: 25,
      manager_reserved_slots_per_assistant: 2,
      portal_texts: {
        landing_title: "Plataforma de Agendamiento SIMUT Tulua",
        support_email: "soporte@simut.gov.co",
      },
      policy_config: {
        allow_duplicate_procedure_appointments: false,
        require_documents_before_confirmation: true,
      },
    })
  }
}

function seedScheduleTemplates(app, collection) {
  if (app.countRecords(collection) > 0) {
    return
  }

  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]

  for (const weekday of weekdays) {
    saveRecord(app, collection, {
      weekday,
      shift_key: "morning",
      shift_label: "Jornada manana",
      start_minutes: 7 * 60,
      end_minutes: 11 * 60 + 40,
      slot_duration_minutes: 15,
      buffer_minutes: 0,
      slot_capacity: 1,
      is_active: true,
      sort_order: 10,
      metadata: {
        source: "default_seed",
      },
    })

    saveRecord(app, collection, {
      weekday,
      shift_key: "afternoon",
      shift_label: "Jornada tarde",
      start_minutes: 13 * 60 + 45,
      end_minutes: 17 * 60 + 5,
      slot_duration_minutes: 15,
      buffer_minutes: 0,
      slot_capacity: 1,
      is_active: true,
      sort_order: 20,
      metadata: {
        source: "default_seed",
      },
    })
  }
}

migrate((app) => {
  for (const collectionName of LEGACY_COLLECTIONS) {
    deleteCollectionIfExists(app, collectionName)
  }

  for (const collectionName of RESETTABLE_COLLECTIONS) {
    deleteCollectionIfExists(app, collectionName)
  }

  const users = app.findCollectionByNameOrId(USERS_COLLECTION)
  removeFieldIfExists(users, "last_vehicle_plate")
  configureCitizenUsers(app, users)

  const operators = createCollection(app, new Collection({
    type: "base",
    name: OPERATORS_COLLECTION,
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
        pattern: "^[A-Z0-9_-]{3,32}$",
        presentable: true,
      }),
      new TextField({
        name: "full_name",
        required: true,
        max: 140,
      }),
      new EmailField({
        name: "email",
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
        onlyInt: true,
        min: 0,
        max: 120,
      }),
      new TextField({
        name: "phone",
        max: 32,
      }),
      new JSONField({
        name: "availability_rules",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "operational_metadata",
        maxSize: 64 * 1024,
      }),
      new TextField({
        name: "notes",
        max: 2000,
      }),
    ],
  }))
  operators.addIndex("idx_operators_code", true, "code", "")
  operators.addIndex("idx_operators_email", true, "email", "email != ''")
  operators.addIndex("idx_operators_role_active", false, "role, is_active", "")

  const systemSettings = createCollection(app, new Collection({
    type: "base",
    name: SYSTEM_SETTINGS_COLLECTION,
    listRule: "",
    viewRule: "",
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
        max: 200,
      }),
      new TextField({
        name: "timezone_label",
        required: true,
        max: 120,
      }),
      new TextField({
        name: "locale",
        required: true,
        max: 16,
      }),
      new NumberField({
        name: "otp_expiration_seconds",
        required: true,
        onlyInt: true,
        min: 60,
        max: 3600,
      }),
      new NumberField({
        name: "otp_max_attempts",
        required: true,
        onlyInt: true,
        min: 1,
        max: 20,
      }),
      new NumberField({
        name: "otp_max_resends",
        required: true,
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new NumberField({
        name: "slot_hold_expiration_seconds",
        required: true,
        onlyInt: true,
        min: 60,
        max: 3600,
      }),
      new NumberField({
        name: "booking_horizon_days",
        required: true,
        onlyInt: true,
        min: 1,
        max: 365,
      }),
      new NumberField({
        name: "minimum_notice_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 2880,
      }),
      new NumberField({
        name: "cancellation_window_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 10080,
      }),
      new NumberField({
        name: "reschedule_window_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 10080,
      }),
      new BoolField({
        name: "allow_cancellation",
      }),
      new BoolField({
        name: "allow_reschedule",
      }),
      new NumberField({
        name: "default_slot_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new NumberField({
        name: "default_buffer_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 120,
      }),
      new NumberField({
        name: "default_daily_capacity_per_assistant",
        required: true,
        onlyInt: true,
        min: 1,
        max: 200,
      }),
      new NumberField({
        name: "manager_reserved_slots_per_assistant",
        required: true,
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new JSONField({
        name: "portal_texts",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "policy_config",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  systemSettings.addIndex("idx_system_settings_key", true, "key", "")

  const procedureTypes = createCollection(app, new Collection({
    type: "base",
    name: PROCEDURE_TYPES_COLLECTION,
    listRule: "is_active = true",
    viewRule: "is_active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "code",
        required: true,
        max: 40,
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
        max: 180,
        presentable: true,
      }),
      new TextField({
        name: "description",
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
      new BoolField({
        name: "requires_vehicle",
      }),
      new BoolField({
        name: "allows_physical_documents",
      }),
      new BoolField({
        name: "allows_digital_uploads",
      }),
      new BoolField({
        name: "requires_downloadable_forms",
      }),
      new TextField({
        name: "instructions",
        max: 8000,
      }),
      new JSONField({
        name: "eligibility_rules",
        maxSize: 128 * 1024,
      }),
      new JSONField({
        name: "intake_form_schema",
        maxSize: 256 * 1024,
      }),
      new JSONField({
        name: "policy_config",
        maxSize: 128 * 1024,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 128 * 1024,
      }),
    ],
  }))
  procedureTypes.addIndex("idx_procedure_types_code", true, "code", "")
  procedureTypes.addIndex("idx_procedure_types_slug", true, "slug", "")
  procedureTypes.addIndex("idx_procedure_types_sort", false, "is_active, sort_order", "")

  const procedureFormFields = createCollection(app, new Collection({
    type: "base",
    name: PROCEDURE_FORM_FIELDS_COLLECTION,
    listRule: "is_active = true",
    viewRule: "is_active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "procedure_type",
        required: true,
        collectionId: procedureTypes.id,
        maxSelect: 1,
      }),
      new TextField({
        name: "field_key",
        required: true,
        max: 80,
        pattern: "^[a-z][a-z0-9_]*$",
      }),
      new TextField({
        name: "label",
        required: true,
        max: 180,
      }),
      new SelectField({
        name: "field_type",
        required: true,
        values: [
          "text",
          "textarea",
          "number",
          "date",
          "email",
          "phone",
          "select",
          "checkbox",
          "radio",
          "file",
          "json",
        ],
        maxSelect: 1,
      }),
      new TextField({
        name: "placeholder",
        max: 180,
      }),
      new TextField({
        name: "helper_text",
        max: 500,
      }),
      new BoolField({
        name: "is_required",
      }),
      new TextField({
        name: "step_key",
        max: 60,
      }),
      new JSONField({
        name: "default_value",
        maxSize: 32 * 1024,
      }),
      new JSONField({
        name: "options_config",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "validation_rules",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "conditional_rules",
        maxSize: 64 * 1024,
      }),
      new SelectField({
        name: "visibility_scope",
        values: ["citizen", "operator", "both"],
        maxSelect: 1,
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
      new BoolField({
        name: "is_active",
      }),
    ],
  }))
  procedureFormFields.addIndex("idx_procedure_form_fields_unique", true, "procedure_type, field_key", "")
  procedureFormFields.addIndex("idx_procedure_form_fields_sort", false, "procedure_type, sort_order", "")

  const procedureRequiredDocuments = createCollection(app, new Collection({
    type: "base",
    name: PROCEDURE_REQUIRED_DOCUMENTS_COLLECTION,
    listRule: "is_active = true",
    viewRule: "is_active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "procedure_type",
        required: true,
        collectionId: procedureTypes.id,
        maxSelect: 1,
      }),
      new TextField({
        name: "code",
        required: true,
        max: 80,
        pattern: "^[a-z][a-z0-9_]*$",
      }),
      new TextField({
        name: "name",
        required: true,
        max: 180,
      }),
      new TextField({
        name: "description",
        max: 2000,
      }),
      new BoolField({
        name: "is_required",
      }),
      new FileField({
        name: "downloadable_file",
        maxSelect: 1,
        maxSize: 25 * 1024 * 1024,
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/zip",
        ],
      }),
      new URLField({
        name: "downloadable_url",
      }),
      new JSONField({
        name: "allowed_mime_types",
        maxSize: 16 * 1024,
      }),
      new NumberField({
        name: "max_file_size_bytes",
        onlyInt: true,
        min: 0,
        max: 150 * 1024 * 1024,
      }),
      new NumberField({
        name: "max_files",
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new BoolField({
        name: "allow_physical_delivery",
      }),
      new BoolField({
        name: "requires_upload_before_booking",
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
      new BoolField({
        name: "is_active",
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  procedureRequiredDocuments.addIndex("idx_required_documents_unique", true, "procedure_type, code", "")
  procedureRequiredDocuments.addIndex("idx_required_documents_sort", false, "procedure_type, sort_order", "")

  const scheduleTemplates = createCollection(app, new Collection({
    type: "base",
    name: SCHEDULE_TEMPLATES_COLLECTION,
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
        name: "shift_key",
        required: true,
        max: 40,
        pattern: "^[a-z][a-z0-9_-]*$",
      }),
      new TextField({
        name: "shift_label",
        max: 100,
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
      new NumberField({
        name: "slot_duration_minutes",
        required: true,
        onlyInt: true,
        min: 5,
        max: 240,
      }),
      new NumberField({
        name: "buffer_minutes",
        required: true,
        onlyInt: true,
        min: 0,
        max: 120,
      }),
      new NumberField({
        name: "slot_capacity",
        required: true,
        onlyInt: true,
        min: 0,
        max: 100,
      }),
      new BoolField({
        name: "is_active",
      }),
      new RelationField({
        name: "applies_to_procedure",
        collectionId: procedureTypes.id,
        maxSelect: 1,
      }),
      new NumberField({
        name: "sort_order",
        onlyInt: true,
        min: 0,
        max: 9999,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  scheduleTemplates.addIndex(
    "idx_schedule_templates_unique",
    true,
    "weekday, shift_key, start_minutes, applies_to_procedure",
    "",
  )
  scheduleTemplates.addIndex("idx_schedule_templates_lookup", false, "weekday, is_active, sort_order", "")

  const scheduleExceptions = createCollection(app, new Collection({
    type: "base",
    name: SCHEDULE_EXCEPTIONS_COLLECTION,
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
      new SelectField({
        name: "exception_type",
        required: true,
        values: ["closed", "reduced", "extended", "custom"],
        maxSelect: 1,
      }),
      new BoolField({
        name: "is_closed",
      }),
      new JSONField({
        name: "override_windows",
        maxSize: 128 * 1024,
      }),
      new NumberField({
        name: "capacity_override",
        onlyInt: true,
        min: 0,
        max: 1000,
      }),
      new NumberField({
        name: "slot_duration_override_minutes",
        onlyInt: true,
        min: 0,
        max: 240,
      }),
      new NumberField({
        name: "buffer_override_minutes",
        onlyInt: true,
        min: 0,
        max: 120,
      }),
      new TextField({
        name: "reason",
        max: 2000,
      }),
      new BoolField({
        name: "is_active",
      }),
      new RelationField({
        name: "created_by",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "updated_by",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  scheduleExceptions.addIndex("idx_schedule_exceptions_active_date", true, "office_date", "is_active = true")

  const agendaSlots = createCollection(app, new Collection({
    type: "base",
    name: AGENDA_SLOTS_COLLECTION,
    listRule: "is_active = true",
    viewRule: "is_active = true",
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
      new SelectField({
        name: "status",
        required: true,
        values: ["open", "blocked", "closed", "past"],
        maxSelect: 1,
      }),
      new NumberField({
        name: "base_capacity",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1000,
      }),
      new NumberField({
        name: "reserved_capacity",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1000,
      }),
      new NumberField({
        name: "confirmed_capacity",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1000,
      }),
      new NumberField({
        name: "available_capacity",
        required: true,
        onlyInt: true,
        min: 0,
        max: 1000,
      }),
      new RelationField({
        name: "procedure_type",
        collectionId: procedureTypes.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "generated_from",
        required: true,
        values: ["template", "exception", "manual", "recompute"],
        maxSelect: 1,
      }),
      new BoolField({
        name: "is_active",
      }),
      new JSONField({
        name: "source_metadata",
        maxSize: 64 * 1024,
      }),
      new DateField({
        name: "last_recomputed_at",
      }),
    ],
  }))
  agendaSlots.addIndex(
    "idx_agenda_slots_unique",
    true,
    "office_date, start_minutes, end_minutes, procedure_type",
    "",
  )
  agendaSlots.addIndex("idx_agenda_slots_lookup", false, "office_date, status, is_active", "")

  const procedureRequests = createCollection(app, new Collection({
    type: "base",
    name: PROCEDURE_REQUESTS_COLLECTION,
    listRule: "citizen = @request.auth.id",
    viewRule: "citizen = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "citizen = @request.auth.id",
    deleteRule: null,
    fields: [
      new RelationField({
        name: "citizen",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "procedure_type",
        required: true,
        collectionId: procedureTypes.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: [
          "draft",
          "pending_verification",
          "verified",
          "in_progress",
          "pending_confirmation",
          "confirmed",
          "cancelled",
          "expired",
          "operational_rejected",
          "attended",
        ],
        maxSelect: 1,
      }),
      new JSONField({
        name: "initial_form_data",
        maxSize: 256 * 1024,
      }),
      new JSONField({
        name: "full_form_data",
        maxSize: 512 * 1024,
      }),
      new JSONField({
        name: "eligibility_check",
        maxSize: 128 * 1024,
      }),
      new BoolField({
        name: "checklist_acknowledged",
      }),
      new BoolField({
        name: "data_treatment_accepted",
      }),
      new SelectField({
        name: "document_delivery_mode",
        values: ["digital_only", "physical_only", "hybrid"],
        maxSelect: 1,
      }),
      new JSONField({
        name: "snapshot_data",
        maxSize: 512 * 1024,
      }),
      new JSONField({
        name: "policy_snapshot",
        maxSize: 256 * 1024,
      }),
      new SelectField({
        name: "source_channel",
        required: true,
        values: ["public_portal", "backoffice", "api", "migration"],
        maxSelect: 1,
      }),
      new JSONField({
        name: "draft_progress",
        maxSize: 128 * 1024,
      }),
      new DateField({
        name: "last_submitted_at",
      }),
      new DateField({
        name: "verified_at",
      }),
      new DateField({
        name: "confirmed_at",
      }),
      new DateField({
        name: "cancelled_at",
      }),
      new DateField({
        name: "expired_at",
      }),
      new TextField({
        name: "operational_notes",
        max: 4000,
        hidden: true,
      }),
    ],
  }))
  procedureRequests.addIndex("idx_procedure_requests_citizen_status", false, "citizen, status, created", "")
  procedureRequests.addIndex("idx_procedure_requests_procedure_status", false, "procedure_type, status, created", "")

  const requestDocuments = createCollection(app, new Collection({
    type: "base",
    name: REQUEST_DOCUMENTS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "request",
        required: true,
        collectionId: procedureRequests.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "required_document",
        collectionId: procedureRequiredDocuments.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "delivery_type",
        required: true,
        values: ["pending", "digital_upload", "physical_delivery", "hybrid", "not_required"],
        maxSelect: 1,
      }),
      new FileField({
        name: "files",
        maxSelect: 12,
        maxSize: 25 * 1024 * 1024,
        protected: true,
        mimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/zip",
        ],
      }),
      new SelectField({
        name: "status",
        required: true,
        values: [
          "pending",
          "delivered_digital",
          "marked_physical",
          "in_review",
          "validated",
          "rejected",
        ],
        maxSelect: 1,
      }),
      new RelationField({
        name: "reviewer",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new DateField({
        name: "reviewed_at",
      }),
      new TextField({
        name: "notes",
        max: 4000,
      }),
      new JSONField({
        name: "validation_summary",
        maxSize: 64 * 1024,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  requestDocuments.addIndex("idx_request_documents_unique", true, "request, required_document", "required_document != ''")
  requestDocuments.addIndex("idx_request_documents_status", false, "request, status", "")

  const slotHolds = createCollection(app, new Collection({
    type: "base",
    name: SLOT_HOLDS_COLLECTION,
    listRule: "citizen = @request.auth.id",
    viewRule: "citizen = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "slot",
        required: true,
        collectionId: agendaSlots.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "citizen",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "request",
        required: true,
        collectionId: procedureRequests.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: ["active", "expired", "consumed", "cancelled"],
        maxSelect: 1,
      }),
      new TextField({
        name: "hold_token",
        required: true,
        max: 120,
      }),
      new NumberField({
        name: "held_units",
        required: true,
        onlyInt: true,
        min: 1,
        max: 20,
      }),
      new DateField({
        name: "expires_at",
        required: true,
      }),
      new DateField({
        name: "consumed_at",
      }),
      new DateField({
        name: "released_at",
      }),
      new TextField({
        name: "release_reason",
        max: 500,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  slotHolds.addIndex("idx_slot_holds_token", true, "hold_token", "")
  slotHolds.addIndex("idx_slot_holds_slot_status", false, "slot, status", "")
  slotHolds.addIndex("idx_slot_holds_request_active", true, "request", "status = 'active'")

  const appointments = createCollection(app, new Collection({
    type: "base",
    name: APPOINTMENTS_COLLECTION,
    listRule: "citizen = @request.auth.id",
    viewRule: "citizen = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "request",
        required: true,
        collectionId: procedureRequests.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "citizen",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "slot",
        required: true,
        collectionId: agendaSlots.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "assistant",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: [
          "confirmed",
          "pending_review",
          "rescheduled",
          "cancelled_by_user",
          "cancelled_by_operation",
          "no_show",
          "attended",
        ],
        maxSelect: 1,
      }),
      new SelectField({
        name: "origin",
        required: true,
        values: ["public_portal", "manager_reservation", "backoffice"],
        maxSelect: 1,
      }),
      new TextField({
        name: "confirmation_code",
        max: 20,
        pattern: "^SIM-[A-Z0-9]{8}$",
        autogeneratePattern: "SIM-[A-Z0-9]{8}",
        presentable: true,
      }),
      new TextField({
        name: "notes",
        max: 4000,
      }),
      new DateField({
        name: "confirmed_at",
      }),
      new DateField({
        name: "cancelled_at",
      }),
      new DateField({
        name: "attended_at",
      }),
      new TextField({
        name: "rescheduled_from_appointment_id",
        max: 15,
      }),
      new JSONField({
        name: "request_snapshot",
        maxSize: 512 * 1024,
      }),
      new JSONField({
        name: "assignment_snapshot",
        maxSize: 256 * 1024,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 128 * 1024,
      }),
    ],
  }))
  appointments.addIndex("idx_appointments_confirmation_code", true, "confirmation_code", "confirmation_code != ''")
  appointments.addIndex("idx_appointments_request_status", false, "request, status", "")
  appointments.addIndex("idx_appointments_slot_status", false, "slot, status", "")
  appointments.addIndex(
    "idx_appointments_request_active",
    true,
    "request",
    "status = 'confirmed' OR status = 'pending_review' OR status = 'rescheduled'",
  )

  const adminReservations = createCollection(app, new Collection({
    type: "base",
    name: ADMIN_RESERVATIONS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "reservation_code",
        max: 20,
        pattern: "^ADM-[A-Z0-9]{8}$",
        autogeneratePattern: "ADM-[A-Z0-9]{8}",
        presentable: true,
      }),
      new TextField({
        name: "office_date",
        required: true,
        max: 10,
        pattern: DATE_KEY_PATTERN,
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
      new TextField({
        name: "recurrence_rule",
        max: 150,
      }),
      new SelectField({
        name: "recurrence_days",
        values: WEEKDAYS,
        maxSelect: 7,
      }),
      new RelationField({
        name: "assistant",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: ["active", "moved", "released", "cancelled"],
        maxSelect: 1,
      }),
      new BoolField({
        name: "is_recurring",
      }),
      new TextField({
        name: "reason",
        max: 2000,
      }),
      new TextField({
        name: "parent_reservation_id",
        max: 15,
      }),
      new RelationField({
        name: "linked_slot",
        collectionId: agendaSlots.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "created_by",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "updated_by",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new NumberField({
        name: "moved_to_start_minutes",
        onlyInt: true,
        min: 0,
        max: 1439,
      }),
      new NumberField({
        name: "moved_to_end_minutes",
        onlyInt: true,
        min: 1,
        max: 1440,
      }),
      new DateField({
        name: "released_at",
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  adminReservations.addIndex("idx_admin_reservations_code", true, "reservation_code", "reservation_code != ''")
  adminReservations.addIndex("idx_admin_reservations_lookup", false, "office_date, status", "")
  adminReservations.addIndex(
    "idx_admin_reservations_unique_active",
    true,
    "assistant, office_date, start_minutes",
    "status = 'active'",
  )

  const appointmentAssignments = createCollection(app, new Collection({
    type: "base",
    name: APPOINTMENT_ASSIGNMENTS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "appointment",
        required: true,
        collectionId: appointments.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "assistant",
        required: true,
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new SelectField({
        name: "assignment_type",
        required: true,
        values: ["automatic", "manual", "reassignment", "mass_rebalance"],
        maxSelect: 1,
      }),
      new SelectField({
        name: "assignment_origin",
        required: true,
        values: ["system", "manager", "admin"],
        maxSelect: 1,
      }),
      new DateField({
        name: "assigned_at",
      }),
      new RelationField({
        name: "previous_assistant",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new BoolField({
        name: "is_active",
      }),
      new TextField({
        name: "reason",
        max: 1000,
      }),
      new RelationField({
        name: "assigned_by",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new JSONField({
        name: "metadata",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  appointmentAssignments.addIndex("idx_appointment_assignments_active", true, "appointment", "is_active = true")
  appointmentAssignments.addIndex("idx_appointment_assignments_assistant", false, "assistant, is_active", "")

  const otpChallenges = createCollection(app, new Collection({
    type: "base",
    name: OTP_CHALLENGES_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({
        name: "citizen",
        collectionId: users.id,
        maxSelect: 1,
      }),
      new EmailField({
        name: "email",
        required: true,
      }),
      new SelectField({
        name: "purpose",
        required: true,
        values: ["login", "booking", "confirmation", "recovery"],
        maxSelect: 1,
      }),
      new TextField({
        name: "code_hash",
        required: true,
        max: 255,
        hidden: true,
      }),
      new SelectField({
        name: "status",
        required: true,
        values: ["pending", "verified", "expired", "cancelled", "blocked"],
        maxSelect: 1,
      }),
      new DateField({
        name: "expires_at",
        required: true,
      }),
      new DateField({
        name: "sent_at",
      }),
      new DateField({
        name: "validated_at",
      }),
      new NumberField({
        name: "attempt_count",
        required: true,
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new NumberField({
        name: "resend_count",
        required: true,
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new NumberField({
        name: "max_attempts",
        required: true,
        onlyInt: true,
        min: 1,
        max: 20,
      }),
      new NumberField({
        name: "max_resends",
        required: true,
        onlyInt: true,
        min: 0,
        max: 20,
      }),
      new TextField({
        name: "request_ip",
        max: 64,
      }),
      new TextField({
        name: "request_user_agent",
        max: 1000,
      }),
      new JSONField({
        name: "security_context",
        maxSize: 64 * 1024,
      }),
    ],
  }))
  otpChallenges.addIndex("idx_otp_challenges_email_status", false, "email, status", "")
  otpChallenges.addIndex("idx_otp_challenges_expiration", false, "expires_at, status", "")

  const auditEvents = createCollection(app, new Collection({
    type: "base",
    name: AUDIT_EVENTS_COLLECTION,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new SelectField({
        name: "actor_type",
        required: true,
        values: ["citizen", "operator", "system", "superuser"],
        maxSelect: 1,
      }),
      new RelationField({
        name: "actor_user",
        collectionId: users.id,
        maxSelect: 1,
      }),
      new RelationField({
        name: "actor_operator",
        collectionId: operators.id,
        maxSelect: 1,
      }),
      new TextField({
        name: "action",
        required: true,
        max: 120,
      }),
      new TextField({
        name: "entity",
        required: true,
        max: 120,
      }),
      new TextField({
        name: "entity_id",
        required: true,
        max: 80,
      }),
      new TextField({
        name: "summary",
        max: 500,
      }),
      new JSONField({
        name: "payload_summary",
        maxSize: 128 * 1024,
      }),
      new TextField({
        name: "ip",
        max: 64,
      }),
      new TextField({
        name: "user_agent",
        max: 1000,
      }),
      new TextField({
        name: "request_id",
        max: 120,
      }),
      new SelectField({
        name: "severity",
        required: true,
        values: ["info", "warning", "error", "critical"],
        maxSelect: 1,
      }),
      new DateField({
        name: "happened_at",
        required: true,
      }),
    ],
  }))
  auditEvents.addIndex("idx_audit_events_entity", false, "entity, entity_id, happened_at", "")
  auditEvents.addIndex("idx_audit_events_actor", false, "actor_type, happened_at", "")
  auditEvents.addIndex("idx_audit_events_action", false, "action, happened_at", "")

  seedSystemSettings(app, systemSettings)
  seedScheduleTemplates(app, scheduleTemplates)
}, (app) => {
  deleteCollectionIfExists(app, AUDIT_EVENTS_COLLECTION)
  deleteCollectionIfExists(app, OTP_CHALLENGES_COLLECTION)
  deleteCollectionIfExists(app, APPOINTMENT_ASSIGNMENTS_COLLECTION)
  deleteCollectionIfExists(app, ADMIN_RESERVATIONS_COLLECTION)
  deleteCollectionIfExists(app, APPOINTMENTS_COLLECTION)
  deleteCollectionIfExists(app, SLOT_HOLDS_COLLECTION)
  deleteCollectionIfExists(app, REQUEST_DOCUMENTS_COLLECTION)
  deleteCollectionIfExists(app, PROCEDURE_REQUESTS_COLLECTION)
  deleteCollectionIfExists(app, AGENDA_SLOTS_COLLECTION)
  deleteCollectionIfExists(app, SCHEDULE_EXCEPTIONS_COLLECTION)
  deleteCollectionIfExists(app, SCHEDULE_TEMPLATES_COLLECTION)
  deleteCollectionIfExists(app, PROCEDURE_REQUIRED_DOCUMENTS_COLLECTION)
  deleteCollectionIfExists(app, PROCEDURE_FORM_FIELDS_COLLECTION)
  deleteCollectionIfExists(app, PROCEDURE_TYPES_COLLECTION)
  deleteCollectionIfExists(app, SYSTEM_SETTINGS_COLLECTION)
  deleteCollectionIfExists(app, OPERATORS_COLLECTION)

  const users = app.findCollectionByNameOrId(USERS_COLLECTION)
  restoreDefaultUsers(app, users)
})
