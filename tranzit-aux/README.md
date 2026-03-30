# tranzit-aux

Backend auxiliar en Bun/Hono para la logica de negocio que no conviene ejecutar en `pb_hooks`.

## Enfoque

Se sigue la recomendacion de PocketBase para web apps SPA:

- PocketBase queda como auth, data store, archivos y realtime de colecciones.
- `tranzit-aux` corre las validaciones de negocio y opera contra PocketBase como superuser por HTTP.
- La autenticacion del ciudadano sigue siendo token de PocketBase; `tranzit-aux` valida ese token por request con un cliente aislado.

## Configuracion

1. Instala dependencias:

```sh
bun install
```

2. Crea tu archivo `.env` a partir de `.env.example`.

3. Configura una de estas dos opciones para el acceso admin a PocketBase:

- `POCKETBASE_SUPERUSER_TOKEN` recomendado
- `POCKETBASE_SUPERUSER_EMAIL` y `POCKETBASE_SUPERUSER_PASSWORD`

## Desarrollo

```sh
bun run dev
```

Por defecto corre en [http://127.0.0.1:8787](http://127.0.0.1:8787).

## Endpoints

- `GET /api/tranzit/services`
- `GET /api/tranzit/availability`
- `POST /api/tranzit/auth/request-otp`
- `POST /api/tranzit/auth/verify-otp`
- `POST /api/tranzit/appointments/hold`
- `POST /api/tranzit/appointments/confirm`
