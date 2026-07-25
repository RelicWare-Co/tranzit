---
name: deslop
description: Rediseña UI de producto en Tranzit cuando se vea genérica, incoherente, saturada de cards, con tablas sin jerarquía, formularios organizados al azar o modales descuidados. Úsala para limpiar y reconstruir páginas administrativas, settings, CRUD, tablas, formularios y overlays con Mantine sin cambiar el comportamiento del producto.
version: 1.0.0
user-invocable: true
argument-hint: "[ruta, página o feature]"
---

# Deslop para Tranzit

Convierte interfaces funcionales pero genéricas en UI de producto clara, coherente y lista para producción. Esta skill está calibrada para el backoffice de Tranzit: personal interno de SIMUT, trabajo frecuente en escritorio, información densa, decisiones operativas y necesidad de confianza.

No es una skill para landing pages. No agrega decoración por decoración. Su objetivo es reducir ruido, ordenar decisiones, hacer legible la información y conservar toda la funcionalidad real.

## Dirección del proyecto

Lee primero:

- `AGENTS.md`
- `.impeccable.md`
- `.agents/skills/mantine-tranzit/SKILL.md`
- `packages/web/package.json`
- `packages/web/src/shared/styles/design-tokens.css`
- `packages/web/src/app/main.tsx`
- Los componentes y tests del feature que se va a modificar

Mantén estas decisiones:

- Producto público-institucional: oficial, amable, claro y sobrio.
- Backoffice organizado, eficiente y más denso que el portal ciudadano.
- Light mode, salvo decisión explícita en contrario.
- Acento rojo de marca usado con moderación.
- Colores semánticos reservados para estados reales: éxito, alerta, error e información.
- Tipografía y tokens obtenidos del sistema actual; no hardcodear una identidad paralela.
- Mantine es el sistema de componentes. No introducir shadcn ni otro design system.
- Lucide es la familia de iconos existente. No mezclar familias.

## Preparación obligatoria

1. Ejecuta desde la raíz:

```bash
bunx @tanstack/intent@latest list
```

1. Inspecciona antes de editar:
   - La página completa.
   - Sus modales, drawers, formularios, tablas y estados vacíos.
   - Componentes compartidos que ya utiliza.
   - Tests existentes y contratos de datos.
2. Si se usa o cambia una API de Mantine, abre `https://mantine.dev/llms.txt` y luego la página LLM específica del componente. Verifica contra Mantine `9.4.x`.
3. Declara mentalmente este design read:

> UI operativa para personal de SIMUT; debe sentirse institucional, directa, coherente y eficiente, no decorativa ni genérica.

## Diagnóstico anti-slop

Antes de diseñar, busca sistemáticamente estos problemas.

### Card soup

- Una card por sección sin necesidad real.
- Cards dentro de cards.
- Formularios en un `Paper` dentro de un `SectionCard` dentro de otra superficie.
- Bordes, radios y sombras repetidos en cada nivel.
- Todo parece tener el mismo peso visual.

### Tablas sin sistema

- `withTableBorder` y `withColumnBorders` usados por defecto.
- Encabezados, filas y acciones con estilos distintos entre tablas hermanas.
- Badges multicolor sin significado.
- Demasiadas columnas que podrían agruparse semánticamente.
- Acciones diminutas, sin `aria-label` o solo visibles al hover.
- Valores ausentes mostrados como guiones o JSON técnico.

### Formularios aleatorios

- Campos puestos en grids de 3 o 4 columnas solo porque caben.
- Inicio y fin de una jornada separados visualmente.
- Switches mezclados con campos numéricos sin jerarquía.
- Campos avanzados con el mismo peso que los obligatorios.
- Labels ambiguos, placeholders usados como labels o falta de helper text.
- Acciones flotando en posiciones diferentes entre formularios.

### Modales descuidados

- Un bloque continuo de inputs sin secciones.
- Títulos que no explican si se crea o edita.
- Cierre permitido mientras se guarda.
- Sin error inline de la operación.
- Botones inconsistentes o sin jerarquía.
- `window.confirm`, `window.alert` o JSON crudo como experiencia final.

### Falta de estados

- Loading genérico que no conserva la forma del contenido.
- Estado vacío que no enseña la siguiente acción.
- Errores solo en notificaciones cuando pertenecen al formulario.
- Operaciones async sin `loading` ni bloqueo de doble envío.
- Resultado técnico en lugar de información operativa legible.

## Estrategia de rediseño

### 1. Ordena la arquitectura antes de estilizar

Dibuja la jerarquía del feature:

1. Página.
2. Áreas de trabajo pares.
3. Encabezado de sección.
4. Contenido principal.
5. Acciones y estados.

Si varias áreas son pares y no necesitan verse simultáneamente, usa `Tabs`. Si forman una secuencia, usa un flujo o stepper. Si una es secundaria, usa progressive disclosure. No apiles cuatro grandes cards solo para separar dominios.

Una página administrativa normalmente necesita:

- Un `AdminPageHeader`.
- Un único shell o superficie principal, si ayuda a delimitar el área.
- Navegación secundaria clara.
- Panels planos con separación mediante espacio y dividers.

### 2. Aplana superficies

Usa cards únicamente cuando exista una frontera funcional real: un elemento independiente, seleccionable, comparable o elevado.

Prefiere para agrupar:

- Proximidad.
- Espaciado del sistema de 4 puntos.
- Encabezados de sección.
- Dividers de 1px.
- Fondos neutros suaves.
- Una única superficie envolvente.

Nunca anides cards. No sustituyas una card por otro rectángulo con borde y sombra que cumple exactamente el mismo papel.

### 3. Construye jerarquía consistente

Cada área principal debe tener un encabezado reutilizable con:

- Título en sentence case.
- Descripción corta, concreta y con ancho limitado.
- Metadata útil, por ejemplo cantidad de elementos.
- Una acción primaria como máximo.

La acción debe describir el resultado: `Nueva excepción`, `Crear plantilla`, `Generar slots`. Evita `Agregar`, `Aceptar` o `Continuar` sin contexto.

### 4. Diseña tablas como herramientas, no como hojas de cálculo

Patrón preferido:

- Marco exterior sutil solo si ayuda a contener el scroll.
- Sin bordes verticales entre columnas.
- Header con fondo neutro y tipografía discreta.
- Separadores horizontales suaves.
- Hover de fila solo para feedback.
- Números con `font-variant-numeric: tabular-nums`.
- Primera columna con mayor peso.
- Valores relacionados agrupados en una celda.
- Ausencias traducidas a lenguaje humano: `Sin límite`, `Jornada habitual`, `Sin cambios`.
- Acciones al final, consistentes entre todas las tablas.
- `Table.ScrollContainer` en anchos pequeños; no ocultar columnas críticas.

Para acciones icon-only:

- Usa `Tooltip`.
- Añade `aria-label` específico.
- Mantén target táctil de al menos 44×44px.
- Usa neutro para editar y rojo solo para eliminar.

Los badges indican estado, no decoran. No asignes un color distinto a cada día o fila si el color no comunica una regla.

### 5. Organiza formularios por significado

Primero agrupa los campos en bloques del dominio, por ejemplo:

- Fecha y motivo.
- Regla base.
- Ventanas de atención.
- Estado del día.
- Límites de capacidad.
- Contexto interno.

Después elige el grid.

Reglas:

- Dos columnas es el default para formularios administrativos medianos.
- Tres columnas solo cuando hay exactamente un trío lógico equivalente.
- Nunca uses tres columnas para cuatro campos: produce una segunda fila accidental.
- Inicio y fin deben aparecer juntos.
- Mañana y tarde deben tener el mismo patrón visual.
- Booleanos se presentan con `Switch` cuando activan una regla persistente.
- Opciones destructivas o de cierre deben tener copy explícito.
- Campos opcionales explican qué pasa al dejarlos vacíos.
- En móvil, todo colapsa a una columna sin perder funcionalidad.

Usa labels reales de Mantine. El placeholder ofrece un ejemplo o estado por defecto, nunca reemplaza el label.

### 6. Decide correctamente entre inline y modal

No uses modales para cambios triviales que se entienden mejor inline. Sí usa modal cuando:

- Crear o editar requiere varios grupos de campos.
- El formulario compite visualmente con una tabla o listado.
- Se necesita foco temporal en una operación puntual.
- Crear y editar comparten el mismo modelo.

Patrón para modales de formulario:

- `PremiumModal` como base existente.
- Título distinto para crear y editar.
- Subtítulo breve que explique el alcance.
- Secciones internas planas separadas por dividers.
- Error del submit dentro del modal.
- Footer de acciones estable o sticky.
- `Cancelar` secundario; acción específica como primaria.
- `loading` durante submit.
- Deshabilita cierre exterior y Escape mientras guarda.
- Restaura el formulario al abrir para crear o editar.
- Conserva el modal abierto ante error de API.

Para eliminación, usa un confirm modal coherente, no `window.confirm`. Debe nombrar el objeto, explicar la consecuencia y usar rojo solo en la acción destructiva.

### 7. Traduce datos técnicos

Nunca muestres `JSON.stringify` como resultado final para operadores.

Transforma la respuesta en:

- Estado principal.
- Fecha o entidad consultada.
- Origen de la regla.
- Capacidad efectiva.
- Horario efectivo.
- Explicación humana de códigos del backend.

Conserva los tipos inferidos desde el cliente oRPC. Si la unión es amplia, usa type guards seguros; no uses `any`.

### 8. Diseña todos los estados

Cada sección debe cubrir:

- Loading con skeletons compatibles con la tabla o formulario.
- Empty state con explicación y acción para poblarlo.
- Error de carga contextual.
- Error de submit dentro del overlay.
- Loading en botones async.
- Resultado exitoso visible o notificación concreta.
- Disabled state que explique por qué la acción no está disponible.

### 9. Responsive real

No te limites a reducir tamaños.

- Tabs: scroll horizontal sin scrollbar visible cuando no caben.
- Encabezados: acciones pasan a ancho completo en móvil.
- Forms: 2/3 columnas a 1 columna según el contenido.
- Utilidades secundarias: layout split en escritorio, stack en tablet/móvil.
- Tablas: scroll horizontal contenido, no overflow de la página.
- Modales: padding menor y acciones de ancho completo en móvil.
- Touch targets: mínimo 44×44px.
- No ocultes funcionalidad crítica.

## Implementación con Mantine

Orden de preferencia:

1. Props del componente Mantine.
2. CSS Modules para layout repetido, Styles API y responsive.
3. Style props para 3–4 ajustes puntuales como máximo.
4. `styles` solo cuando no exista una alternativa más mantenible.

Reglas:

- Usa tokens `--mantine-*` o tokens semánticos de Tranzit.
- No uses variables privadas `--_*`.
- Mantén estilos locales del feature en un CSS Module local.
- Extrae primitivas locales solo si se repiten de verdad, por ejemplo header de sección o confirmación destructiva.
- No conviertas una solución local en componente global sin revisar otros consumidores.
- No agregues otro `MantineProvider`.
- No cambies contratos backend para resolver un problema visual.
- No edites manualmente `routeTree.gen.ts`.

### Nota de tests para Textarea

`Textarea autosize` depende de APIs del navegador que pueden no estar configuradas en jsdom. Si los tests del proyecto fallan en `TextareaAutosize`, usa `rows` para esa interfaz o actualiza explícitamente el test harness. No ignores el fallo ni elimines el test.

## CSS anti-slop

Usa el spacing de 4 puntos y nombres/tokens existentes. Crea ritmo: gaps pequeños dentro de grupos y separación generosa entre grupos.

Evita:

- Valores arbitrarios repetidos.
- Una sombra en cada contenedor.
- Radios gigantes en elementos internos.
- `border-left` o `border-right` grueso como acento.
- Gradient text.
- Glassmorphism en UI operativa.
- Escalas o rebotes grandes en botones administrativos.
- `transition: all` en listas largas.
- Z-index arbitrarios.
- Colores hardcodeados cuando existe un token.

El hover debe estar protegido para dispositivos que realmente soportan hover, mediante `@mixin hover` cuando el pipeline lo acepte o `@media (hover: hover)` si evita warnings del tooling.

## Arquitectura de código

- Mantén los archivos de `routes` delgados.
- Las páginas viven en `features/<dominio>`.
- Separa modales grandes de la tabla principal.
- Conserva hooks y mutaciones existentes.
- Haz operaciones independientes en paralelo con `Promise.all`.
- No introduzcas estado derivado innecesario ni effects para cálculos que pueden ocurrir durante render.
- No rompas tests ni nombres accesibles existentes sin actualizar la cobertura de forma intencional.

## Referencia aplicada en el repositorio

Para ver este patrón implementado, consulta:

- `packages/web/src/features/admin/components/configuracion/AdminConfiguracionPage.tsx`
- `packages/web/src/features/admin/components/configuracion/Configuracion.module.css`
- `packages/web/src/features/admin/components/configuracion/ConfigurationSectionHeader.tsx`
- `packages/web/src/features/admin/components/configuracion/ConfirmDeleteModal.tsx`
- `packages/web/src/features/admin/components/configuracion/sections/TemplateSection/`
- `packages/web/src/features/admin/components/configuracion/sections/OverrideSection/`
- `packages/web/src/features/admin/components/configuracion/sections/StaffAvailabilitySection/`
- `packages/web/src/features/admin/components/configuracion/sections/SlotGenerationSection/`

Toma estos archivos como referencia de composición, no como plantilla para copiar sin pensar. La estructura debe responder al dominio del feature nuevo.

## Flujo de trabajo

### Fase 1 — Inventario

- Enumera secciones, acciones, modales y estados.
- Identifica repetición, card nesting y grids arbitrarios.
- Confirma qué comportamiento no puede cambiar.

### Fase 2 — Arquitectura visual

- Decide qué debe verse simultáneamente.
- Elige navegación, shell y jerarquía.
- Reduce superficies antes de añadir estilos.

### Fase 3 — Componentes de datos

- Unifica tablas, acciones, badges, loading y empty states.
- Traduce valores técnicos a copy operacional.

### Fase 4 — Formularios y overlays

- Agrupa campos por dominio.
- Crea una cuadrícula deliberada.
- Implementa submit, error, loading y cierre seguro.
- Sustituye confirmaciones nativas.

### Fase 5 — Responsive y accesibilidad

- Revisa móvil, tablet y escritorio.
- Verifica labels, `aria-label`, foco, Escape, tab order y targets táctiles.

### Fase 6 — Verificación

Ejecuta primero diagnósticos LSP del feature y después los checks más estrechos:

```bash
cd packages/web
bunx biome check src/features/<feature>
bunx vitest run <tests-relevantes> --maxWorkers=1
bunx tsc --noEmit
bun run build
```

Si `bun run check` global falla por deuda previa fuera del alcance, demuestra que el check scoped pasa y reporta claramente los fallos preexistentes. No ocultes errores nuevos.

## Pre-flight obligatorio

Antes de terminar, verifica:

- [ ] No hay cards anidadas.
- [ ] Cada superficie tiene una razón funcional.
- [ ] La página tiene una jerarquía reconocible al hacer squint test.
- [ ] Las tablas hermanas comparten estructura y acciones.
- [ ] Los badges solo comunican estados.
- [ ] Los formularios están agrupados por significado.
- [ ] No quedan grids con filas accidentales.
- [ ] Crear, editar y eliminar tienen patrones coherentes.
- [ ] No se usa `window.alert` ni `window.confirm`.
- [ ] No se muestra JSON crudo a usuarios.
- [ ] Loading, empty, error, success y disabled están cubiertos.
- [ ] Todos los inputs tienen label.
- [ ] Acciones icon-only tienen tooltip y nombre accesible.
- [ ] Targets táctiles alcanzan 44×44px.
- [ ] Móvil conserva toda la funcionalidad.
- [ ] Se usaron tokens y CSS Modules, no un sistema paralelo.
- [ ] Tests, typecheck y build relevantes pasan.

Una interfaz está deslopeada cuando se entiende antes de sentirse “diseñada”: menos contenedores, mejores relaciones, decisiones claras y estados completos.
