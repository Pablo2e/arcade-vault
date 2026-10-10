# SPEC 04 — Integración base de Supabase

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 03
> **Date:** 2026-10-10
> **Objective:** Integrar Supabase en Arcade Vault con clientes de navegador y servidor, variables de entorno documentadas y un endpoint de salud que verifique la conexión, sin consumirlos todavía en ninguna pantalla.

## Por qué existe este spec

SPEC 01–03 dejaron fuera de scope, una y otra vez, "autenticación real, backend o API, puntuaciones en servidor". Hoy el repo no tiene ningún paquete de Supabase (`package.json` solo llega hasta `resend`), `lib/` contiene únicamente `data.ts`, y el `.env.template` ya arrastra un `SUPABASE_DB_PASSWORD` sin commitear cuyo destino no está definido. Los specs de auth y de puntuaciones van a necesitar una base común: clientes ya instalados, env vars ya resueltas y una prueba de que las credenciales funcionan. Este spec es esa base, y nada más.

## Scope

**In:**

- Proyecto de Supabase: paso explícito para crearlo (o localizarlo si ya existe) y extraer Project URL y publishable key. El usuario no tiene claro si el proyecto existe; el plan lo contempla en cualquier caso.
- Dependencias `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- `lib/supabase/client.ts`: factory con `createBrowserClient` para componentes de cliente.
- `lib/supabase/server.ts`: factory con `createServerClient` para Server Components y route handlers, usando las cookies de `next/headers`.
- `.env.template`: documentar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales; aclarar en el comentario que `SUPABASE_DB_PASSWORD` es opcional, solo para conexión directa a la base (psql, futuras migraciones) y que la app no lo lee. `.env.local` (gitignored, regla ya existente) lleva los valores reales.
- Route handler `app/api/supabase-health/route.ts` (GET): smoke test de conexión — 500 si faltan las env vars; con ellas, `fetch` a `${SUPABASE_URL}/auth/v1/health` con el header `apikey`; 200 `{ ok: true }` si Supabase responde, 500 `{ ok: false, error }` si no. No lee ni escribe tablas.
- Antes de escribir el route handler, leer la guía relevante (route handlers, cookies, caching) en `node_modules/next/dist/docs/` como indica CLAUDE.md (`cacheComponents: true`).

**Out of scope (for future specs):**

- Autenticación (signup / login / logout / sesión en el Nav): spec propio.
- Tablas, migraciones, RLS y la CLI de Supabase (`supabase init`): spec del primer dato persistente.
- Puntuaciones del Salón de la Fama en BD: spec propio.
- Storage, Realtime, service role key.
- Cualquier cambio de UI o de `Nav.tsx`.
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos nuevas ni crea tablas. Las únicas estructuras son el contrato del endpoint de salud:

```ts
// GET /api/supabase-health → respuestas
// 200 { ok: true }                  — env vars presentes y Supabase respondió
// 500 { ok: false, error: string }  — faltan env vars, o el fetch a Supabase falló
```

Variables de entorno (en `.env.template` sin valores; reales solo en `.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=     # Project URL del dashboard de Supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=# publishable key (pública por diseño; NO confundir con service_role)
SUPABASE_DB_PASSWORD=         # opcional; la app no la lee
```

## Implementation plan

1. **Proyecto y variables de entorno.** Crear el proyecto en supabase.com (o localizar el existente) y copiar Project URL y publishable key a `.env.local`. Ampliar `.env.template` con las dos variables nuevas sin valores y el comentario sobre `SUPABASE_DB_PASSWORD`. Verificar: `.env.local` tiene las dos variables y `npx tsc --noEmit` sigue en verde.
2. **Dependencias.** `npm install @supabase/supabase-js @supabase/ssr`. Verificar: `npx tsc --noEmit` y `npm run lint` en verde.
3. **Clientes.** Leer en `node_modules/next/dist/docs/` lo relativo a route handlers, cookies y `cacheComponents`. Crear `lib/supabase/client.ts` (factory `createBrowserClient` con las env vars `NEXT_PUBLIC_*`) y `lib/supabase/server.ts` (factory `createServerClient` con get/set de cookies sobre `next/headers`). Verificar: `npx tsc --noEmit` en verde; ambos módulos importan sin efectos secundarios.
4. **Endpoint de salud.** Crear `app/api/supabase-health/route.ts` (GET): si faltan las env vars → 500 `{ ok: false }`; si están → usar el cliente de servidor y hacer `fetch` a `${SUPABASE_URL}/auth/v1/health` con header `apikey`; 200 `{ ok: true }` si responde ok, 500 `{ ok: false, error }` si no. Verificar con curl: sin `.env.local` → 500; con credenciales reales → 200; con la URL apuntando a un host inalcanzable → 500.

## Acceptance criteria

- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [x] `lib/supabase/client.ts` exporta una factory que crea el cliente de navegador sin tocar cookies de servidor.
- [x] `lib/supabase/server.ts` exporta una factory que crea el cliente de servidor leyendo y escribiendo las cookies de Next.
- [x] `.env.template` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales, y aclara que `SUPABASE_DB_PASSWORD` es opcional y la app no lo lee.
- [x] `.env.local` contiene las dos variables reales y no está en el repo (regla `.env*` / `!.env.template` de `.gitignore`).
- [x] `GET /api/supabase-health` sin las env vars responde 500 con `ok: false` (nunca un crash).
- [x] `GET /api/supabase-health` con env vars válidas y Supabase accesible responde 200 con `{ ok: true }`.
- [x] Con la URL apuntando a un host inalcanzable responde 5xx con `ok: false` (nunca un 200 falso).
- [x] El endpoint no lee ni escribe tablas, no necesita usuarios y no usa la service role key.
- [x] Ningún componente ni ruta existente cambia: `/`, `/games`, `/auth`, `/juego/*`, `/jugar/*`, `/salon` y `/sobre-nosotros` se ven y navegan igual; `Nav.tsx` intacto.
- [x] `npx tsc --noEmit` y `npm run lint` terminan sin errores.
- [x] El repo no contiene valores reales de Supabase (solo `.env.local` local).
- [x] La app arranca y funciona sin tener instalada la CLI de Supabase.

## Decisions

- **Sí:** alcance solo de integración base (cliente + env vars + smoke test). Decisión del usuario: auth, puntuaciones y el resto van en specs propios.
- **Sí:** clientes browser + server desde el día uno (elegido por el usuario sobre solo browser o solo server). Los specs de auth y puntuaciones lo heredan; agregarlo después obligaría a reabrir este spec.
- **Sí:** route handler `/api/supabase-health` como smoke test (elegido por el usuario sobre script npm o sin smoke test). Mismo patrón testeable con curl que el `/api/contact` del SPEC 03.
- **Sí:** `@supabase/ssr` además de `@supabase/supabase-js`. Es el paquete oficial para App Router con cookies; sin él, el cliente server no podrá mantener sesión cuando llegue el spec de auth.
- **Sí:** el smoke test = env vars presentes + `fetch` a `${SUPABASE_URL}/auth/v1/health` con `apikey`. Es lo más liviano que prueba URL, red y Kong sin crear tablas ni usuarios, que son fuera de scope.
- **Sí:** paso explícito de creación/localización del proyecto antes del código. El usuario no tiene claro si existe; el plan lo cubre en los dos casos.
- **Sí:** mantener `SUPABASE_DB_PASSWORD` documentado en `.env.template` como opcional. Lo agregó el usuario sin commitear; la app con la publishable key no lo usa, pero sirve para conexión directa (psql) y futuras migraciones. Quitarlo sería tirar trabajo del usuario.
- **Sí:** env vars con prefijo `NEXT_PUBLIC_`. Estándar de Supabase en Next.js; la publishable key es pública por diseño, por eso el comentario que la distingue de la service role.
- **Sí:** depender de SPEC 01 (la app existe) y SPEC 03 (patrón de route handler + `.env.template` que este spec amplía).
- **No:** CLI de Supabase ni `supabase init`. Las migraciones llegan con el spec que cree la primera tabla; la CLI no debe ser requisito para arrancar la app.
- **No:** service role key en ninguna parte. Solo la publishable key; la service role es secreto de servidor y este spec no tiene operaciones que la requieran.
- **No:** crear una tabla mínima para que el health la consulte. Rompería el "solo integración" y adelantaría el spec de datos.
- **No:** tocar UI, Nav o cualquier pantalla. El endpoint no se enlaza desde ningún lado; se prueba con curl.

## Risks

| Riesgo                                                                                                        | Mitigación                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El proyecto de Supabase no existe (usuario no seguro).                                                        | Paso 1 del plan lo crea o lo localiza antes de tocar código; sin credenciales no se avanza.                                                                                               |
| `${SUPABASE_URL}/auth/v1/health` no responde como se espera en este proyecto.                                 | El fallo cae en 500 `{ ok: false }` (visible, nunca un 200 falso); si aparece, usar `${SUPABASE_URL}/rest/v1/` como alternativa, que siempre responde vía Kong.                           |
| Next 16 con `cacheComponents: true` trata el GET del route handler de forma inesperada (cachea la respuesta). | Leer la guía de route handlers y caching en `node_modules/next/dist/docs/` antes del paso 4, como indica CLAUDE.md; verificar el 500 sin env vars y el 200 con curl en el mismo arranque. |
| Confundir la publishable key con la service role y filtrarla en el cliente.                                   | Solo se pide la publishable key; `.env.template` la comenta como pública y la service role no aparece en ningún lado.                                                                     |
| El `fetch` a Supabase cuelga si la URL está mal pero resuelve DNS.                                            | El `fetch` lleva `AbortSignal.timeout`; el criterio de aceptación cubre el host inalcanzable con 5xx.                                                                                     |

## What is **not** in this spec

- Autenticación (signup, login, sesión en el Nav).
- Tablas, migraciones, RLS o la CLI de Supabase.
- Puntuaciones del Salón en BD, storage o realtime.
- Cualquier cambio de UI, Nav o pantalla existente.
- Service role key.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
