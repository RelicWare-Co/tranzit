# Autoresearch: Reducir complejidad del backend

## Objective
Reducir la complejidad del código del backend (packages/server/src) eliminando redundancias, consolidando lógica duplicada, simplificando abstracciones innecesarias, y mejorando la cohesión del código — todo sin perder validaciones ni funcionalidad existente.

El backend actual tiene:
- 63 archivos TypeScript (~9,800 líneas)
- 7 archivos de test
- Alta fragmentación en módulos de bookings/capacity (8+ archivos relacionados)
- Lógica de disponibilidad distribuida entre schedule y staff
- Validaciones redundantes en diferentes capas

## Metrics
- **Primary**: `total_lines` (count, lower is better) — líneas totales de código en packages/server/src
- **Secondary**: 
  - `test_lines` — líneas de código de test (queremos mantener o aumentar cobertura)
  - `files_count` — número de archivos (menor fragmentación es mejor)
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

## Simplification Strategies

### 1. Consolidar servicios fragmentados
Los módulos `bookings` y `capacity` tienen alta fragmentación:
- `capacity.service.ts` + `capacity-check.service.ts` + `capacity-consume.service.ts`
- `capacity-hold.service.ts` + `capacity-reassign.service.ts` + `capacity-reassign-tx.service.ts`
- `bookings-read.service.ts` + `bookings-mutations.service.ts` + `bookings-reassign.service.ts`
- `bookings-admin.service.ts`

Oportunidad: consolidar en un solo `capacity.service.ts` con funciones bien separadas pero en un archivo.

### 2. Eliminar abstracciones innecesarias
- Verificar si `capacity.types.ts` es necesario o puede inlinearse
- Revisar si hay interfaces que solo se usan en un lugar
- Verificar si hay utilidades que solo se usan una vez

### 3. Simplificar lógica de disponibilidad
La lógica de disponibilidad está distribuida entre:
- `schedule.service.ts`
- `staff.service.ts` (effectiveAvailability)
- Múltiples archivos de overrides

Oportunidad: unificar modelo de disponibilidad en un solo lugar.

### 4. Inline simples
- Funciones de 1-2 líneas que solo se usan una vez
- Types que pueden inferirse
- Re-exports innecesarios

### 5. Eliminar código muerto
- Imports no usados
- Funciones exportadas que nadie consume
- Comentarios obsoletos de TODO/FIXME resueltos

## What's Been Tried

### Baseline (2026-04-16)
- total_lines: 8,852
- files_count: 63
- test_files: 7
- Estado: tests pasan, types pasan, lint pasa

### Experimento 1: Eliminar funciones duplicadas en capacity-check.service.ts ✅
- Eliminadas: `getActiveBookingCountForSlot`, `getActiveBookingCountForStaffOnDate`
- Eran duplicados no usados de `countActiveSlotBookings`, `countActiveStaffBookingsOnDate`
- Resultado: -31 líneas, todos los tests pasan

### Experimento 2: Eliminar barrel file capacity.service.ts ✅
- Eliminado barrel file que solo re-exportaba
- Actualizados 10+ consumidores para imports directos
- Actualizados 3 archivos de test
- Resultado: -52 líneas, -1 archivo, todos los tests pasan

### Experimento 3: Extraer helpers en staff.router.ts ✅
- Agregados: `parseDefaultCapacity`, `validateBooleanField`
- Eliminada duplicación de validaciones en create/update
- Resultado: -18 líneas, código más mantenible

### Experimento 4: Consolidar capacity-reassign-tx.service.ts ✅
- Eliminado archivo split innecesario
- Funciones movidas a capacity-reassign.service.ts
- Resultado: -12 líneas, -1 archivo, mejor cohesión

### Experimento 5: Migrar staff.schemas.ts a Zod ✅
- Agregada dependencia Zod v4
- Reemplazadas validaciones manuales con schemas declarativos
- Resultado: -28 líneas, mejor type safety

### Experimento 6: Migrar citizen-portal.service.ts a Zod ✅
- Reemplazadas validaciones manuales de campos requeridos
- Simplificadas normalizeDateFrom y normalizeRangeDays
- Resultado: -23 líneas, mejor error messages

### Estado actual (Experimentos 1-6)
- total_lines: 8,705 (-147 líneas, -1.7%)
- files_count: 61 (-2 archivos, -3.2%)
- test_lines: 5,811 (sin cambios)
- type_errors: 0
- test_failures: 0
- zod_version: 4.3.6

### Conclusión (Sesión finalizada)

**Resultado final:**
- total_lines: 8,705 (-147 líneas, -1.7% desde baseline)
- files_count: 61 (-2 archivos, -3.2% desde baseline)
- test_lines: 5,811 (sin cambios, cobertura mantenida)
- type_errors: 0 (sin regresiones)
- test_failures: 0 (toda funcionalidad preservada)

**Cambios realizados:**
1. ✅ Eliminadas funciones duplicadas en capacity-check.service.ts (-31 líneas)
2. ✅ Eliminado barrel file capacity.service.ts (-52 líneas, -1 archivo)
3. ✅ Helpers extraídos en staff.router.ts (-18 líneas)
4. ✅ Consolidado capacity-reassign-tx.service.ts (-12 líneas, -1 archivo)
5. ✅ Migración a Zod v4: staff.schemas.ts (-28 líneas)
6. ✅ Migración a Zod v4: citizen-portal.service.ts (-23 líneas)

**Dependencia agregada:** Zod v4.3.6 para validaciones declarativas

**Lecciones aprendidas:**
- Los barrel files solo añaden indirección innecesaria
- Zod reduce código boilerplate de validación significativamente
- Funciones pequeñas (<3 validaciones) no siempre justifican Zod
- Consolidar archivos split mejora la cohesión
- Los tests son la red de seguridad esencial para refactors

**Estado:** Todas las validaciones y funcionalidad preservadas. Código más mantenible.
