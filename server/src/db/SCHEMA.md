# Esquema mínimo propuesto

Este esquema busca cubrir la operación real sin abrir tablas por cada detalle configurable.

## Decisiones clave

`user` + `verification`
La identidad vive en `better-auth`. La tabla `verification` se deja con el shape estándar del framework para que el plugin de email OTP maneje expiración, intentos y validación sin columnas propias en nuestro dominio.

`procedure_type`
Cada trámite guarda su formulario, reglas de elegibilidad, documentos requeridos y políticas como JSON. Eso evita una explosión de tablas de "campos", "secciones", "reglas" y "dependencias" en esta primera fase.

`service_request`
La solicitud es el contenedor del flujo del ciudadano. Guarda el estado, el borrador, el resultado de elegibilidad y el snapshot final que debe quedar congelado cuando se confirma.

`request_document`
Los documentos entregados sí quedan en tabla separada porque cambian de estado, pueden revisarse internamente y deben trazarse por solicitud.

`schedule_template` + `calendar_override` + `appointment_slot`
Los horarios base y sus excepciones viven por separado. Los slots se materializan para tener un punto claro de reserva, recalcular disponibilidad y emitir eventos en tiempo real sin depender de cálculos ambiguos en frontend.

`booking`
Esta es la simplificación principal del modelo.

Una sola tabla consume cupo para tres casos:
- reserva temporal del ciudadano,
- cita confirmada,
- reserva administrativa.

La diferencia se maneja con `kind` y `status`, no con tres tablas distintas. Esto reduce complejidad, hace más simple la auditoría y deja la concurrencia concentrada en un solo agregado.

`staff_profile` + `staff_date_override`
El auxiliar comparte identidad con `user`. Solo se agrega un perfil operativo con capacidad diaria y disponibilidad semanal en JSON. Los cambios puntuales por fecha se modelan en una tabla separada porque sí se consultan y auditan como excepciones.

`audit_event` + `notification_delivery`
Son tablas genéricas. No hace falta una bitácora por módulo ni una tabla por tipo de correo.

## Lo que todavía no estamos modelando

- motor relacional de formularios campo por campo,
- versionado formal de definiciones de trámite,
- series recurrentes como entidad propia,
- inventario por puesto/ventanilla,
- workflow documental complejo.

Si más adelante la operación lo exige, esas extensiones se pueden montar sobre este núcleo sin romper el flujo principal.
