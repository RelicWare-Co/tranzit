## Design Brief: Flujo de Agendamiento Ciudadano (agendar.tsx)

**1. Resumen de la Función**
La página de agendamiento ciudadano es el núcleo del portal SIMUT. Permite a los ciudadanos explorar trámites, ver requisitos físicos, consultar disponibilidad y reservar una cita sin la fricción de un sistema tradicional de usuario/contraseña.

**2. Acción Principal del Usuario**
Seleccionar un trámite, comprender y descargar las plantillas de requisitos físicos necesarios, elegir un horario disponible y confirmar la reserva de forma ágil.

**3. Dirección de Diseño**
*Guiado, Limpio y Moderno.* Reemplazaremos el rígido asistente actual de 5 pasos con un flujo de divulgación progresiva.
- **Cambio Clave:** En lugar de forzar un inicio de sesión al principio, los ciudadanos pueden explorar trámites, requisitos y fechas inmediatamente. Solo cuando estén listos para asegurar un cupo, se solicitará el OTP de forma fluida (inline o modal), sin sacarlos de su contexto.

**4. Estrategia de Diseño Espacial**
En lugar de una sola columna centrada que parece un formulario largo y monótono, utilizaremos un diseño dividido (Split-pane o Master-Detail):
- **Panel Principal (Izquierdo/Central):** El constructor progresivo (Seleccionar Trámite -> Ver Requisitos -> Elegir Fecha/Hora -> Datos).
- **Panel de Resumen (Derecho/Flotante):** Un resumen fijo (sticky) de la cita que se está construyendo, brindando contexto constante al usuario.
- **Acceso OTP:** Una transición elegante que interrumpe solo para asegurar el cupo, tratándolo como una validación de seguridad y no como un muro de entrada.

**5. Estados Clave**
- **Exploración (Default):** Selección de trámites y visualización *inmediata* de los requisitos documentales y plantillas descargables.
- **Selección de Fecha:** Exploración optimista de fechas y cupos disponibles.
- **Autenticación (OTP):** Un estado enfocado para ingresar el código enviado al correo, manteniendo visible el trámite y horario seleccionados.
- **Reserva Activa (Hold):** Un temporizador visualmente tranquilo que indica la retención temporal del cupo mientras se confirman datos finales.
- **Éxito:** Una pantalla de confirmación clara y satisfactoria.

**6. Modelo de Interacción**
- **Divulgación Progresiva:** Al seleccionar un trámite, se despliegan suavemente sus requisitos. Solo después de revisar esto, el usuario avanza al calendario.
- **Fricción Cero:** El ingreso de OTP es un paso rápido, no una pantalla de inicio de sesión genérica.

**7. Requisitos de Contenido (Español)**
- Nombres de trámites y descripciones claras.
- Formato de fechas y horas en localización colombiana (`es-CO`).
- Instrucciones empáticas y directas (ej. "Descarga y diligencia estas plantillas para el día de tu cita").
- Toda la interfaz, alertas y validaciones estrictamente en español.

**8. Referencias Recomendadas**
- `spatial-design.md`: Para la estructura de panel dividido y evitar anidar tarjetas.
- `interaction-design.md`: Para la revelación progresiva de campos.
- `typography.md`: Para establecer jerarquía visual clara usando la fuente `Geist` sin depender de bordes pesados.
- `color-and-contrast.md`: Uso estratégico del rojo SIMUT solo para acciones primarias.

---
**Nota para implementación:** Las consultas `procedures.list` y `slots.range` son públicas en el backend, lo que permite esta experiencia de exploración sin login.
