# Autoresearch: Reducir complejidad del backend

## Objective
Reducir la complejidad del código del backend (packages/server/src) eliminando redundancias, consolidando lógica duplicada, simplificando abstracciones innecesarias, y mejorando la cohesión del código — todo sin perder validaciones ni funcionalidad existente.

## Metrics
- **Primary**: `total_lines` (count, lower is better) — líneas totales de código en packages/server/src
- **Secondary**: 
  - `files_count` — número de archivos (menor fragmentación es mejor)
  - `test_lines` — líneas de código de test (queremos mantener o aumentar cobertura)
  - `type_errors` — errores de TypeScript (debe ser 0)
  - `test_failures` — tests fallidos (debe ser 0)

## How to Run
`./autoresearch.sh` — outputs `METRIC total_lines=XXXX` lines.

## Files in Scope
Todo bajo `packages/server/src/` puede ser modificado:
- `features/*` — lógica de dominio (auth, bookings, capacity, reservations, schedule, staff)
- `orpc/modules/*` — routers oRPC (entry points)
- `middlewares/*` — middlewares HTTP
- `db/*` — schema y configuración de base de datos
- `lib/*` — utilidades compartidas
- `*.test.ts` — tests (mantener funcionales)

## Off Limits
- No eliminar funcionalidad de negocio
- No eliminar validaciones de seguridad (auth, permissions)
- No cambiar la estructura de la base de datos (schema.ts debe mantener compatibilidad)
- No modificar el comportamiento de los endpoints de la API

## Constraints
- Todos los tests deben pasar: `bun test` en packages/server
- TypeScript debe pasar: `bunx tsc --noEmit` en packages/server
- Lint debe pasar: `biome check` en packages/server
- El código simplificado debe ser igual de seguro (mismas validaciones)

## What's Been Tried

### Baseline (2026-04-16)
- total_lines: 8,852
- files_count: 63
- test_files: 7
- Estado: tests pasan, types pasan, lint pasa

### Experimento 1: Eliminar funciones duplicadas ✅
- Eliminadas: `getActiveBookingCountForSlot`, `getActiveBookingCountForStaffOnDate`
- Resultado: -31 líneas

### Experimento 2: Eliminar barrel file capacity.service.ts ✅
- Eliminado barrel file que solo re-exportaba
- Actualizados 10+ consumidores y 3 test files
- Resultado: -52 líneas, -1 archivo

### Experimento 3: Extraer helpers en staff.router.ts ✅
- Agregados: `parseDefaultCapacity`, `validateBooleanField`
- Resultado: -18 líneas

### Experimento 4: Consolidar capacity-reassign-tx.service.ts ✅
- Eliminado archivo split innecesario
- Resultado: -12 líneas, -1 archivo

### Experimento 5-6: Migración a Zod v4 ✅
- `staff.schemas.ts`: -28 líneas
- `citizen-portal.service.ts`: -23 líneas
- Agregada dependencia Zod v4.3.6

### Experimento 7-10: Eliminar barrel files restantes ✅
- Eliminados: `reservation-series.service.ts`, `reservations-admin.service.ts`, `reservations-instance-update.service.ts`, `bookings-admin.service.ts`, `schedule-admin.service.ts`
- Resultado: -82 líneas, -5 archivos

### Experimento 11: Helper para consolidación futura ✅
- Agregado `toBookingSummary` helper en capacity-reassign.service.ts
- Preparación para futura reducción de ~50 líneas

### Estado Actual (Después de 11 experimentos)
- **total_lines**: 8,664 (-188 líneas, -2.1% desde baseline)
- **files_count**: 56 (-7 archivos, -11.1% desde baseline)
- **test_lines**: 5,811 (sin cambios, cobertura mantenida)
- **type_errors**: 0
- **test_failures**: 0
- **zod_version**: 4.3.6

### Resumen de Cambios
1. ✅ 7 barrel files eliminados
2. ✅ 2 archivos consolidados (funciones duplicadas, split files)
3. ✅ 2 archivos migrados a Zod v4
4. ✅ Validaciones preservadas
5. ✅ Todos los tests pasan

### Oportunidades Futuras
- Aplicar helper `toBookingSummary` para reducir ~50 líneas
- Migrar más validaciones a Zod
- Consolidar lógica repetitiva en reservations
- Simplificar routers grandes (staff.router.ts, capacity-reassign.service.ts)
