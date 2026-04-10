# Mission Architecture — Backoffice Operativo + Auth Separada

## 1) System Context

- **Actors**
  - **Ciudadano**: autentica por OTP de correo y gestiona su solicitud/cita.
  - **Staff/Admin**: autentica por login interno separado y opera backoffice.
  - **SMTP (MailDev en dev)**: canal externo para OTP y notificaciones.
- **Bounded surfaces**
  - **Auth/API pública**: `/api/auth/*` para sesiones, OTP y capacidades admin del proveedor de auth.
  - **Backoffice/API interna**: `/api/admin/*` para agenda, capacidad, reservas, reasignaciones, auditoría.
- **System boundary**
  - **Backend = fuente de verdad** para disponibilidad, capacidad, expiraciones, permisos y trazabilidad.
  - Frontend/UI es consumidor; no decide capacidad ni conflictos.
- **Core persistence context**
  - Identidad/sesiones (`user`, `session`, `verification`), agenda (`schedule_template`, `calendar_override`, `appointment_slot`), operación (`staff_profile`, `staff_date_override`, `booking`, `booking_series`, `service_request`), trazas (`audit_event`, `notification_delivery`).

## 2) Domain Components

- **Auth Separation Layer**
  - **Ciudadano OTP (passwordless)**: emisión/validación OTP por correo.
  - **Staff/Admin login interno**: autenticación separada para superficie administrativa.
  - **Authorization boundary**: sesiones ciudadanas no acceden a `/api/admin/*`.

- **Scheduling Model**
  - `schedule_template`: horario base semanal por weekday.
  - `calendar_override`: excepción por fecha específica.
  - `appointment_slot`: slots materializados y reservables.
  - **Precedence**: override por fecha prevalece sobre horario base.

- **Combined Capacity Model**
  - **Cupo global por slot** (`appointment_slot.capacityLimit`).
  - **Cupo por auxiliar por día/fecha** (`staff_profile.defaultDailyCapacity` + `staff_date_override.capacityOverride`).
  - **Disponibilidad por auxiliar**: activo/asignable + excepción por fecha + ventana parcial (`availableStartTime`/`availableEndTime`).

- **Booking & Request Lifecycle**
  - `booking` unifica hold ciudadano, cita confirmada y reserva administrativa.
  - `booking.isActive` determina vigencia y consumo de capacidad.
  - `service_request.activeBookingId` referencia la reserva/cita vigente de la solicitud.

- **Administrative Recurrence**
  - `booking_series` define recurrencia administrativa.
  - Instancias viven en `booking` enlazadas por `seriesKey`.
  - Soporta operaciones por **serie completa**, **instancia individual** y **desde fecha**.

- **Reassignment Domain**
  - Reasignación manual/masiva cambia responsable operativo sin romper consistencia de capacidad ni vigencia de booking.
  - Soporta evaluación de conflictos antes de aplicar.

- **Traceability Layer**
  - `audit_event`: rastro obligatorio de acciones críticas.
  - `notification_delivery` + SMTP: estado de entrega para OTP y notificaciones operativas.

## 3) Core Flows

1. **Ciudadano OTP → sesión → solicitud/cita**
   - OTP emitido/validado en auth.
   - Solicitud (`service_request`) evoluciona hasta hold/confirmación de booking.
   - Al consolidar cita vigente: `activeBookingId` apunta al booking activo.

2. **Staff/Admin login separado → operación backoffice**
   - Sesión interna habilita gestión de agenda, capacidad, reservas y reasignaciones.
   - Matriz de acceso: no sesión `401`, no-admin `403`, admin/staff autorizado según endpoint.

3. **Agenda base + override → disponibilidad efectiva**
   - Plantilla semanal define base.
   - Override por fecha puede cerrar o modificar ventana/capacidad.
   - Slots resultantes reflejan precedencia override > base.

4. **Decisión de capacidad en reservas/reasignaciones**
   - Se valida simultáneamente cupo global del slot y cupo/estado operativo del auxiliar.
   - La operación solo aplica si ambos límites permiten asignación.

5. **Reservas administrativas recurrentes**
   - Creación/edición/liberación impacta capacidad visible en cada ocurrencia.
   - Alcance explícito: toda serie, una instancia o desde fecha de corte.

6. **Reasignación de citas**
   - Debe preservar una sola reserva/cita vigente por solicitud.
   - Recalcula carga entre auxiliares y mantiene consistencia de capacidad.

7. **Auditoría y notificación**
   - Toda mutación crítica genera evento auditable.
   - OTP y comunicaciones de negocio quedan trazadas en entrega de notificaciones.

## 4) Invariants (non-negotiable)

- **Separación de auth**: ciudadano OTP y login interno administrativo son flujos distintos.
- **Backend authority**: disponibilidad/capacidad/permisos se resuelven en backend, no en cliente.
- **Agenda**: `calendar_override` prevalece sobre `schedule_template`.
- **Modelo de bookings unificado**: no separar hold/cita/admin en tablas distintas para esta misión.
- **Vigencia única por solicitud ciudadana**:
  - máximo un `booking` ciudadano activo por `service_request`,
  - `service_request.activeBookingId` debe apuntar al vigente.
- **Consumo de capacidad por estado activo**: solo bookings `isActive=true` consumen cupo.
- **Sin sobrecupo**:
  - no exceder cupo global del slot,
  - no exceder cupo efectivo por auxiliar.
- **Reservas administrativas consumen la misma capacidad** que los demás tipos de booking.
- **Recurrencia administrativa anclada a `booking_series`** (sin llaves libres no controladas).
- **Reasignación consistente**: transferencia operativa sin dejar estados híbridos.
- **Trazabilidad obligatoria**: acciones críticas con `audit_event`; notificaciones con estado observable.

## 5) Failure/Conflict Model

- **Auth failures**
  - OTP inválido/expirado/agotado/rate-limited.
  - Sesión ausente o rol insuficiente para endpoints administrativos.

- **Schedule/override conflicts**
  - Duplicados por weekday o fecha override.
  - Payload inválido de fecha/ventanas/estado contradictorio.

- **Capacity conflicts**
  - Slot sin cupo global.
  - Auxiliar sin cupo diario o fuera de disponibilidad efectiva.

- **Recurrence conflicts**
  - Colisiones en creación/edición masiva de serie.
  - Reintentos concurrentes/idempotentes sobre la misma operación.
  - Alcance “desde fecha” fuera de contrato esperado.

- **Reassignment conflicts**
  - Fuente obsoleta (`activeBookingId` desalineado).
  - Destino no asignable/no disponible/sin capacidad.
  - Drift entre preview y apply en ejecución masiva.

- **Concurrency model**
  - En carreras por último cupo o mutaciones simultáneas, debe existir un único resultado ganador consistente.
  - La política de ejecución (atómica o best-effort) debe ser explícita y observable en resultados.

- **Notification failure isolation**
  - Falla SMTP no debe corromper estado de booking/capacidad.
  - Debe quedar traza de entrega fallida/reintentable.

## 6) Validation Surface Mapping (API/HTTP/SMTP only)

| Architecture concern | Validation surface | Observable contract signals |
|---|---|---|
| Auth ciudadano OTP | **HTTP** `/api/auth/*` + **SMTP** MailDev | envío OTP, login OTP, sesión válida, OTP single-use/expiry/ratelimit |
| Auth staff/admin separado | **HTTP** `/api/auth/sign-in/email`, `/api/auth/admin/*`, `/api/admin/*` | matriz 401/403/2xx según sesión y rol |
| Agenda base + overrides | **HTTP** `/api/admin/schedule/templates`, `/api/admin/schedule/overrides`, `/api/admin/schedule/slots` | precedencia override, cierre total/parcial, validación de fechas/ventanas |
| Capacidad combinada slot+auxiliar | **HTTP** `/api/admin/staff*`, `/api/admin/bookings*`, endpoints de capacidad/disponibilidad | bloqueo por sobrecupo global o por auxiliar, liberación al cancelar/expirar |
| Reservas administrativas recurrentes | **HTTP** `/api/admin/reservation-series*`, `/api/admin/reservations*` | operaciones por serie/instancia/desde fecha, idempotencia, consistencia de capacidad |
| Reasignación manual/masiva | **HTTP** `/api/admin/bookings/{id}/reassign*`, `/api/admin/bookings/reassignments*` | preview/apply, conflictos, atomicidad o best-effort verificable |
| Auditoría operativa | **HTTP** `/api/admin/audit-events*` | evento por write crítico, actor y payload correlacionables |
| Trazas de notificación | **SMTP** MailDev + **HTTP** notificaciones | OTP/notificación emitida, estado de entrega/fallo observable sin romper negocio |

- **Out of scope de validación para esta misión**: pruebas UI/browser; el contrato se verifica en superficies **API/HTTP/SMTP**.

## 7) Compact API Contract Appendix (milestone-critical)

### 7.1 Endpoint families + required payload fields + validation expectations

| Endpoint family | Required payload fields (high-level) | Validation expectations (high-level) |
|---|---|---|
| `/api/auth/otp/*` | `email`, `otpCode` (cuando aplique), contexto de flujo (`citizen`) | email normalizado, OTP vigente/single-use, límites de intento y rate-limit |
| `/api/admin/schedule/templates*` | `weekday`, `startTime`, `endTime`, `slotDurationMinutes`, `capacityLimit` | ventana válida (`start < end`), duración positiva, unicidad por `weekday`/trámite |
| `/api/admin/schedule/overrides*` | `date`, `status(open/closed)`, `startTime/endTime` opcional, `capacityOverride` opcional | fecha válida, no contradicción de estado, override único por fecha/trámite, precedencia sobre plantilla |
| `/api/admin/schedule/slots*` | filtros (`dateRange`, `procedureTypeId`, `staffId` opcional) | rango de fechas válido, límites de página/rango, consistencia con override vigente |
| `/api/admin/staff*` + `/api/admin/staff-date-overrides*` | `staffId`, estado operativo, `defaultDailyCapacity` o `capacityOverride`, ventana parcial opcional | capacidad no negativa, ventanas válidas, reglas de auto-solapamiento por fecha |
| `/api/admin/bookings*` | `slotId`, `serviceRequestId` o `adminReservationContext`, `staffId` opcional, `bookingType`, `idempotencyKey` en writes críticos | existencia de referencias, una sola booking ciudadana activa por solicitud, no sobrecupo global ni por auxiliar |
| `/api/admin/reservation-series*` | `seriesRule` (frecuencia/alcance), `startsAt`, `endsAt` o límite, `staffAssignmentPolicy`, `idempotencyKey` | regla de recurrencia válida, alcance explícito (serie/instancia/desde fecha), conflicto de capacidad detectable |
| `/api/admin/bookings/{id}/reassign*` + `/api/admin/bookings/reassignments*` | `bookingId` o lote de IDs, `targetStaffId`, `effectiveDate/scope`, `idempotencyKey` | booking vigente, destino asignable/disponible, detección de drift preview/apply, contrato de atomicidad explícito |
| `/api/admin/audit-events*` | filtros (`actorId`, `entityType`, `dateRange`, `actionType`) | filtros válidos, solo lectura, paginación estable |

### 7.2 Canonical error taxonomy

| HTTP status | Canonical code | Meaning / when used |
|---|---|---|
| `400` | `VALIDATION_ERROR` | payload incompleto, formato inválido, regla básica violada |
| `401` | `UNAUTHENTICATED` | sesión ausente o inválida |
| `403` | `FORBIDDEN` | sesión válida sin permisos para la ruta/acción |
| `404` | `NOT_FOUND` | recurso no existe o no visible para el actor |
| `409` | `CONFLICT` | colisión de concurrencia/capacidad/estado vigente |
| `410` | `EXPIRED` | hold u OTP expirado |
| `422` | `DOMAIN_RULE_VIOLATION` | regla de dominio incumplida (p. ej., booking activa única) |
| `429` | `RATE_LIMITED` | exceso de intentos (OTP o writes protegidos) |
| `503` | `DEPENDENCY_UNAVAILABLE` | dependencia externa (SMTP u otra) no disponible |

- Regla de contrato: respuestas de error deben incluir **`code` canónico**, **mensaje estable para operador** y, cuando aplique, **`retryable: true/false`**.

## 8) Concurrency & Transaction Policy Table

| Operation | Policy (atomic vs best-effort) | Conflict response | Idempotency expectation |
|---|---|---|---|
| Crear hold ciudadano | **Atomic** (slot + vigencia de solicitud) | `409 CONFLICT` si cupo/estado cambió | Reintento con misma `idempotencyKey` debe devolver mismo resultado lógico |
| Confirmar cita desde hold vigente | **Atomic** (transición hold→confirmado) | `409 CONFLICT` o `410 EXPIRED` | Confirmación duplicada no crea segunda cita |
| Cancelar booking activa | **Atomic** (desactivar + liberar capacidad) | `409 CONFLICT` si ya no está activa | Repetición es no-op observable (misma entidad inactiva) |
| Crear reserva administrativa individual | **Atomic** | `409 CONFLICT` por sobrecupo o colisión de estado | Write idempotente por `idempotencyKey` |
| Crear/editar serie administrativa (alcance total) | **Best-effort controlado** con resultado por ocurrencia | `409 CONFLICT` por ocurrencias rechazadas; reporte parcial obligatorio | Reintentos no deben duplicar ocurrencias ya aplicadas |
| Editar serie “desde fecha” | **Best-effort controlado** | `409 CONFLICT` para subconjunto en conflicto | Reaplicación con misma clave conserva subconjunto exitoso |
| Reasignación individual | **Atomic** (origen/destino en una sola decisión) | `409 CONFLICT` si destino no disponible o booking obsoleta | Repetición no cambia estado más de una vez |
| Reasignación masiva (batch) | **Best-effort controlado** o **Atomic por lote** (debe declararse por endpoint) | Resumen explícito de éxitos/fallos; conflictos en `409` por ítem o lote | Reintentos deben ser seguros y no duplicar mutaciones exitosas |
| Expiración automática de holds | **Atomic por hold** | no aplica al cliente; estado final consistente | Job/reintento no reactiva holds expirados |

- Regla operativa: cuando una operación sea **best-effort**, el contrato debe retornar detalle por ítem (`applied`, `rejected`, motivo canónico) para permitir reconciliación.

## 9) Route-Level Authorization Matrix (`/api/admin/*`)

Legend: **RW** = read/write, **R** = read-only, **—** = sin acceso.

| Route family | Admin | Staff | Citizen session | No session |
|---|---:|---:|---:|---:|
| `/api/admin/schedule/templates*` | RW | R | — (`403`) | — (`401`) |
| `/api/admin/schedule/overrides*` | RW | R | — (`403`) | — (`401`) |
| `/api/admin/schedule/slots*` | R | R | — (`403`) | — (`401`) |
| `/api/admin/staff*` | RW | R (solo perfil propio y contexto operativo permitido) | — (`403`) | — (`401`) |
| `/api/admin/staff-date-overrides*` | RW | R (propio) | — (`403`) | — (`401`) |
| `/api/admin/bookings*` | RW | RW (dentro de alcance operativo asignado) | — (`403`) | — (`401`) |
| `/api/admin/reservation-series*` | RW | R | — (`403`) | — (`401`) |
| `/api/admin/bookings/{id}/reassign*` | RW | RW (si política lo habilita) | — (`403`) | — (`401`) |
| `/api/admin/bookings/reassignments*` | RW | R (preview) / RW (apply si política lo habilita) | — (`403`) | — (`401`) |
| `/api/admin/audit-events*` | R | R (scope operacional) | — (`403`) | — (`401`) |

- Regla de seguridad de superficie: **ninguna sesión ciudadana** puede mutar ni leer datos de backoffice por `/api/admin/*`.
