import type { RecordModel } from "pocketbase"

export type DeliveryMode = "digital_upload" | "physical_delivery"
export type AppointmentStatus =
  | "held"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "completed"
  | "no_show"
export type AppointmentSource = "public_portal" | "manager" | "admin"
export type StaffRole = "assistant" | "manager" | "admin"
export type DocumentType =
  | "cedula_ciudadania"
  | "cedula_extranjeria"
  | "tarjeta_identidad"
  | "pasaporte"
  | "nit"
  | "otro"

export interface AuthUserRecord extends RecordModel {
  email: string
  name: string
  phone: string
  document_type: string
  document_number: string
  last_vehicle_plate: string
  verified: boolean
}

export interface BookingSettingsRecord extends RecordModel {
  key: string
  office_name: string
  timezone_label: string
  utc_offset_minutes: number
  booking_horizon_days: number
  minimum_notice_minutes: number
  hold_duration_minutes: number
  slot_interval_minutes: number
  default_appointment_duration_minutes: number
  default_daily_capacity: number
  manager_reserved_slots_per_assistant: number
  locale: string
}

export interface ServiceTypeRecord extends RecordModel {
  code: string
  slug: string
  name: string
  description?: string
  instructions?: string
  is_active: boolean
  sort_order: number
  appointment_duration_minutes: number
  requires_vehicle_registered_locally: boolean
  requires_digital_form_upload: boolean
  allows_physical_delivery: boolean
  form_template?: string | string[]
  eligibility_schema?: unknown
  intake_schema?: unknown
}

export interface StaffMemberRecord extends RecordModel {
  code: string
  full_name: string
  email?: string
  phone?: string
  role: StaffRole
  is_active: boolean
  daily_capacity: number
  color?: string
  display_order: number
}

export interface OfficeHourTemplateRecord extends RecordModel {
  weekday: string
  label: string
  start_minutes: number
  end_minutes: number
  is_active: boolean
  sort_order: number
}

export interface OfficeHourOverrideRecord extends RecordModel {
  office_date: string
  label?: string
  start_minutes: number
  end_minutes: number
  is_active: boolean
  is_closed: boolean
  sort_order: number
  notes?: string
}

export interface StaffCapacityOverrideRecord extends RecordModel {
  staff: string
  office_date: string
  is_active: boolean
  daily_capacity: number
  notes?: string
}

export interface ManagerSlotTemplateRecord extends RecordModel {
  staff: string
  weekday: string
  label: string
  start_minutes: number
  duration_minutes: number
  is_active: boolean
  sort_order: number
}

export interface ManagerSlotOverrideRecord extends RecordModel {
  staff: string
  office_date: string
  label?: string
  start_minutes: number
  duration_minutes: number
  is_active: boolean
  sort_order: number
}

export interface AppointmentRecord extends RecordModel {
  reference?: string
  user?: string
  service: string
  assistant: string
  status: AppointmentStatus
  source: AppointmentSource
  office_date: string
  slot_start_minutes: number
  slot_end_minutes: number
  hold_expires_at?: string
  confirmed_at?: string
  cancelled_at?: string
  applicant_name?: string
  applicant_email?: string
  applicant_phone?: string
  document_type?: string
  document_number?: string
  vehicle_plate?: string
  vehicle_registered_locally?: boolean
  delivery_mode?: DeliveryMode
  attachments?: string[] | string
  initial_checks?: unknown
  intake_payload?: unknown
  internal_notes?: string
}
