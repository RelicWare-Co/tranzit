# Plan: unificar el inicio de sesión

## Context

Actualmente existen dos entradas separadas en la web: `/login` para ciudadanía y `/admin/login` para administración. Ambas implementaciones ya usan el mismo flujo de OTP por correo mediante `AuthContext`, pero duplican interfaz, estado y lógica. El objetivo es ofrecer un único acceso y redirigir a cada usuario según su rol después de validar el código.

Hallazgos iniciales:

- `packages/web/src/features/auth/components/LoginPage.tsx` envía y valida OTP, pero siempre redirige a `/mi-perfil`.
- `packages/web/src/features/admin/components/AdminLoginPage.tsx` repite el flujo OTP y redirige a `/admin` al detectar el rol `admin`; además contiene el flujo de creación del primer administrador.
- Las rutas actuales están definidas en `packages/web/src/routes/login.tsx` y `packages/web/src/routes/admin/login.tsx`.
- La autenticación compartida ya está centralizada en `packages/web/src/features/auth/components/AuthContext.tsx`.

## Approach

- Convertir `/login` en la única pantalla de autenticación OTP para todos los usuarios, conservando el correo, nombre opcional, envío/reenvío y validación del código de seis dígitos.
- Después de `signInEmailOtp`, dejar que la sesión refrescada determine el destino, evitando la redirección fija actual y carreras entre la validación y la carga del rol:
  - `admin`, `staff` o `auditor` → `/admin`.
  - Rol ciudadano/común → `/mi-perfil`.
- Consultar `orpc.admin.onboarding.status` desde el login único. Si el usuario autenticado no tiene rol administrativo y `adminExists` es `false`, mostrar la activación del primer administrador; al ejecutar `bootstrap`, refrescar la sesión y entrar a `/admin`. Si no puede comprobarse el estado, mostrar error/reintento en vez de elevar permisos o redirigir asumiendo un estado.
- Mantener `/admin/login` como URL de compatibilidad, pero hacer que redirija inmediatamente y con reemplazo de historial a `/login`; eliminar su componente duplicado.
- Simplificar `AdminLayout`: una sesión ausente va directamente a `/login`, una sesión sin rol de backoffice va a `/mi-perfil`, y solamente los roles autorizados renderizan el panel. Las navegaciones de guard deben reemplazar historial para evitar bucles al volver atrás.

## Files to modify

- `packages/web/src/features/auth/components/LoginPage.tsx`: flujo único, onboarding y decisión del destino.
- `packages/web/src/routes/admin/login.tsx`: redirección de compatibilidad a `/login`.
- `packages/web/src/features/admin/components/AdminLayout.tsx`: guard alineado con el acceso único.
- `packages/web/src/features/admin/components/AdminLoginPage.tsx`: eliminar al quedar reemplazado por el login único.
- `packages/web/src/features/auth/components/LoginPage.test.tsx`: pruebas del flujo y destinos por rol.
- `packages/web/src/features/admin/components/AdminLayout.test.tsx`: pruebas de los guards administrativos, si la cobertura del test de ruta no los incluye de forma suficiente.

No se prevén cambios de servidor ni de base de datos: Better Auth ya tiene OTP habilitado para todas las cuentas y el onboarding ya valida en backend que no exista un administrador.

## Reuse

- `useAuth`, `sendVerificationOtp`, `signInEmailOtp`, `hasRole` y `refreshUser` de `packages/web/src/features/auth/components/AuthContext.tsx`; `signInEmailOtp` ya refresca la sesión.
- Configuración OTP y envío de correo existentes en `packages/server/src/features/auth/auth.config.ts` y `packages/server/src/features/auth/auth.mailer.ts`.
- Consulta `orpc.admin.onboarding.status` y mutación `orpc.admin.onboarding.bootstrap` usadas por el flujo administrativo actual. El backend exige sesión y vuelve a comprobar que no haya un administrador antes de promover al usuario.
- Criterio de acceso existente de `packages/web/src/features/admin/components/AdminLayout.tsx`: roles `admin`, `staff` o `auditor`.
- Infraestructura Vitest/Testing Library existente en `packages/web/src/test/setup.ts` y `packages/web/src/test/render.tsx`.

## Steps

- [x] Confirmar OTP para todos, destinos por rol y conservación de la creación del primer administrador.
- [x] Revisar guards, roles, onboarding y referencias actuales a `/admin/login` y `/login`.
- [x] Incorporar al `LoginPage` la consulta de onboarding y estados de carga/error sin bloquear el OTP de usuarios no autenticados.
- [x] Reemplazar la navegación fija posterior al OTP por una decisión basada en la sesión y los roles, incluyendo sesiones que ya estaban activas al abrir `/login`.
- [x] Mover al login único la pantalla/acción para activar al primer administrador y refrescar el rol tras la mutación.
- [x] Convertir `/admin/login` en redirección compatible a `/login` y actualizar `AdminLayout` para usar los destinos unificados.
- [x] Eliminar `AdminLoginPage`, sus imports y condiciones especiales que ya no tengan consumidores.
- [x] Agregar pruebas de componente/guard para OTP, onboarding y redirección de usuarios comunes y roles administrativos.

## Verification

- Ejecutar `bun run --cwd packages/web test`, `bun run --cwd packages/web check`, `bun run tsc:web` y `bun run --cwd packages/web build`.
- Probar con MailDev el envío y reenvío de OTP, código válido, inválido y expirado desde `/login`.
- Ingresar como usuario común y comprobar `/mi-perfil`; repetir con `admin`, `staff` y `auditor` y comprobar `/admin`.
- Abrir `/login` con sesiones ya activas de ambos tipos y verificar que la redirección sea automática y sin parpadeos/bucles.
- Abrir `/admin/login` y una ruta protegida `/admin/*` sin sesión; ambas deben terminar en `/login`. Intentar `/admin/*` con un ciudadano autenticado y comprobar que termina en `/mi-perfil`.
- En una base sin administradores, autenticar un usuario común, verificar que aparece la activación del primer administrador, ejecutarla y confirmar que la sesión refrescada entra a `/admin`. Confirmar también que, si ya existe un administrador, un ciudadano nunca ve esa opción.
