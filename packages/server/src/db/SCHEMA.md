# Esquema mínimo propuesto

Este esquema busca cubrir la operación real sin abrir tablas por cada detalle configurable. La idea sigue siendo la misma: un núcleo corto, pero con invariantes suficientes para no romper agenda, trazabilidad o recuperación de flujos.

## Decisiones clave

`user` + `verification`
La identidad vive en `better-auth`. La tabla `verification` se deja con el shape estándar del framework para que el plugin de email OTP maneje expiración, intentos y validación sin columnas propias en nuestro dominio.

`verification.identifier` tiene un índice UNIQUE para garantizar que solo exista un código vigente por identificador (email + tipo). Esto es necesario para que el flujo de reenvío de OTP invalide automáticamente el código anterior: el plugin `emailOTP` de Better Auth usa un patrón create-then-catch en `resolveOTP` que depende de esta restricción para eliminar el OTP previo antes de insertar el nuevo. Sin unicidad, el `.catch` nunca se ejecuta y ambos códigos coexisten, permitiendo que el OTP anterior siga siendo válido tras un reenvío.

`procedure_type`
Cada trámite guarda su formulario, reglas de elegibilidad, documentos requeridos y políticas como JSON. Eso evita una explosión de tablas de "campos", "secciones", "reglas" y "dependencias" en esta primera fase.

Por política operativa vigente, la carga digital ciudadana de documentos está deshabilitada. `allowsDigitalDocuments` se conserva por compatibilidad histórica del esquema, pero backend lo fuerza a `false` en las superficies activas y el flujo ciudadano opera en modo físico.

Además, `configVersion` permite distinguir cambios relevantes de configuración sin montar un sistema formal de versionado por entidad.

`service_request`
La solicitud es el contenedor del flujo del ciudadano. Guarda el estado, el borrador, el resultado de elegibilidad y el snapshot final que debe quedar congelado cuando se confirma.

Ahora también ancla:
- `procedureConfigVersion`: versión de la configuración usada para esa solicitud.
- `procedureSnapshot`: copia mínima de la definición del trámite usada para validar y rehidratar el flujo.
- `activeBookingId`: referencia canónica a la cita/reserva vigente de la solicitud.

`request_document`
Los documentos entregados quedan en tabla separada porque cambian de estado, pueden revisarse internamente y deben trazarse por solicitud. En el flujo ciudadano actual se usa principalmente para confirmación/registro de entrega física; no para subida digital desde portal.

Ya no se asume un solo archivo por requisito. Una solicitud puede tener múltiples filas para el mismo `requirementKey`. Para mantener trazabilidad liviana:
- `isCurrent` marca si el documento pertenece al set vigente.
- `replacesDocumentId` permite conservar cadena de reemplazos sin abrir un workflow documental aparte.

`schedule_template` + `calendar_override` + `appointment_slot`
Los horarios base y sus excepciones viven por separado. Los slots se materializan para tener un punto claro de reserva, recalcular disponibilidad y emitir eventos en tiempo real sin depender de cálculos ambiguos en frontend.

`booking`
Esta sigue siendo la simplificación principal del modelo.

Una sola tabla consume cupo para tres casos:
- reserva temporal del ciudadano,
- cita confirmada,
- reserva administrativa.

La diferencia se maneja con `kind` y `status`, no con tres tablas distintas. Para cerrar los huecos operativos que sí importan:
- `isActive` indica si la fila sigue siendo la reserva/cita vigente que consume capacidad.
- existe un índice único parcial para impedir más de una reserva/cita ciudadana activa por `service_request`.
- `activeBookingId` en la solicitud apunta a la fila vigente que debe mostrarse y operarse.

`booking_series`
Las reservas administrativas recurrentes ya no dependen solo de un `seriesKey` suelto. La regla de recurrencia queda persistida en una entidad mínima con:
- `recurrenceRule`,
- `timezone`,
- `metadata`,
- estado activo.

No es un motor avanzado de recurrencias; es solo el mínimo para editar series completas sin perder origen.

`idempotency_key`
Las mutaciones críticas usan una tabla de llaves de idempotencia para evitar duplicados por reintentos de red o reenvíos de la misma operación.

Cada registro guarda:
- `key`: identificador idempotente único por operación cliente.
- `operation` y `targetId`: contexto funcional de la mutación.
- `payloadHash`: hash del payload para detectar replay con cuerpo distinto.
- `responseStatus` y `responseBody`: respuesta canonizada para devolver exactamente el mismo resultado en replay válido.
- `expiresAt`: ventana de vigencia para limpieza y para limitar crecimiento.

`staff_profile` + `staff_date_override`
El auxiliar comparte identidad con `user`. Solo se agrega un perfil operativo con capacidad diaria y disponibilidad semanal en JSON.

`staff_date_override` mantiene la excepción por fecha, pero ahora también admite ventana parcial del día:
- `availableStartTime`
- `availableEndTime`

Eso cubre llegadas tarde, salidas anticipadas o disponibilidad parcial sin abrir una agenda separada por auxiliar.

`audit_event` + `notification_delivery`
Son tablas genéricas. No hace falta una bitácora por módulo ni una tabla por tipo de correo.

## Invariantes que futuros agentes deben respetar

- Al crear o actualizar una `service_request`, copiar `procedure_type.configVersion` en `procedureConfigVersion`.
- Antes de mover una solicitud a confirmación, persistir `procedureSnapshot` con la configuración efectiva usada.
- Si cambia la cita vigente de una solicitud, actualizar `service_request.activeBookingId`.
- Solo una fila `booking` ciudadana por solicitud puede permanecer con `isActive = true`.
- Cuando una cita/reserva deja de ser vigente por cancelación, expiración, atención o reprogramación, marcar `isActive = false`.
- Las reservas administrativas recurrentes deben colgar de `booking_series`; `seriesKey` no debe usarse como string libre.
- Para una misma `idempotency_key`, el `payloadHash` debe mantenerse estable; si cambia, debe tratarse como conflicto y no como replay exitoso.
- Si un documento reemplaza otro, crear nueva fila y enlazarla con `replacesDocumentId` en lugar de sobrescribir evidencia histórica.
- No reintroducir carga digital ciudadana de documentos sin una decisión explícita de producto/regulatoria; el flujo vigente es descarga de plantillas + entrega física en cita.
- Si un auxiliar solo atiende una parte del día en una fecha puntual, usar `availableStartTime` y `availableEndTime` antes de crear otra abstracción.

## Lo que todavía no estamos modelando

- motor relacional de formularios campo por campo,
- versionado formal e histórico completo de definiciones de trámite,
- excepciones complejas por ocurrencia dentro de una serie recurrente,
- inventario por puesto/ventanilla,
- workflow documental complejo.

Si más adelante la operación lo exige, esas extensiones se pueden montar sobre este núcleo sin romper el flujo principal.
