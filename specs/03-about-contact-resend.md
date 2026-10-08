# SPEC 03 — About page y contacto real con Resend

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-08
> **Objective:** Implementar la ruta `/sobre-nosotros` con el formulario de contacto de `references/templates/home-about/about.jsx` y enviar el mensaje por correo vía Resend desde un route handler.

## Por qué existe este spec

SPEC 02 portó la home y dejó explícito que el about (`about.jsx`), su link en el Nav y su CSS (`about-*`, `contact-*`) van a un spec futuro: hoy `/sobre-nosotros` daría 404 y el Nav no tiene ese link. Además, la plantilla solo valida en cliente y "envía" seteando estado local; este spec introduce el primer backend real del proyecto (un route handler con Resend), lo que obliga a definir estados que la plantilla no tiene: envío en curso y fallo.

## Scope

**In:**

- Ruta `/sobre-nosotros` (`app/sobre-nosotros/page.tsx`) renderizando `components/About.tsx` (`"use client"`): port exacto de `about.jsx` — hero (`▸ ACERCA DE`, título, misión), 3 highlights con `HighlightIcon` (HEART / BROWSER / PLANT), divider de 24 píxeles con `reveal`, sección de contacto (intro, 3 tips y formulario NOMBRE / CORREO ELECTRÓNICO / MENSAJE).
- Estados del formulario: `sending` (botón deshabilitado "▶ ENVIANDO…"), `sent` (terminal de éxito de la plantilla con el nombre en mayúsculas) y `error` (terminal de error con la misma estética VAULT-OS y botón REINTENTAR). Validación vacío → `shake` 400 ms, idéntica a la plantilla.
- POST del formulario a `/api/contact` con `fetch`; el `sent` se muestra solo tras respuesta 2xx.
- Route handler `app/api/contact/route.ts` (POST): valida no-vacío y formato de correo (400 si falla), descarta honeypot en silencio (200 sin enviar) y llama a `resend.emails.send()` con `from: FROM_EMAIL`, `to: CONTACT_TO_EMAIL`, `replyTo` = correo del formulario.
- Dependencia `resend` en `package.json`. Variables en `.env.local` (gitignored): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `FROM_EMAIL` (dominio verificado en Resend, confirmado por el usuario). Documentación en `.env.template` (sin valores reales; ya trackeado por el `.gitignore` con la excepción `!.env.template`).
- CSS: diff de los `className` de `about.jsx` contra `app/globals.css`; añadir al final solo las clases que falten (`about-*`, `contact-*`, `highlight`/`hl-*`, `about-divider`, `div-bar`, `div-pixels`, `tip*`, `shake`, `terminal-success`, `term-*`, `line`, `prompt`, `caret`…). `field`, `kicker`, `neon-*`, `btn`, `reveal` y `fade-in` ya existen.
- `Nav.tsx`: link **"Sobre Nosotros" → `/sobre-nosotros`** en escritorio y panel móvil, después de "Salón de la Fama" (mismo orden que la plantilla, que dice "Acerca de"), activo solo en `/sobre-nosotros`.
- Actualizar `specs/02-home-landing.md`: el criterio "No hay link 'Acerca de' en el Nav" y el "Out of scope" del about pasan a estar resueltos por este spec.

**Out of scope (for future specs):**

- Almacenar los mensajes recibidos (BD, tabla, inbox): solo llegan por correo.
- Rate limit por IP, CAPTCHA u otras protecciones anti-spam além del honeypot.
- Plantilla HTML del correo en Resend (React Email); se envía texto plano.
- Autenticación real, backend ampliado o tests automatizados (hereda las exclusiones de SPEC 01).
- Cambios en la home, el footer, `layout.tsx` o el diseño del about más allá de su CSS.

## Data model

No introduce persistencia. Las estructuras son el estado local del formulario y el contrato del endpoint:

```ts
// components/About.tsx — estado local, no persistido
const [form, setForm] = useState({ name: "", email: "", msg: "" });
const [sending, setSending] = useState(false);
const [sent, setSent] = useState<string | null>(null);   // nombre tras 2xx
const [error, setError] = useState<string | null>(null); // mensaje para la terminal de error

// POST /api/contact  →  body
type ContactRequest = { name: string; email: string; message: string; website?: string }; // website = honeypot

// respuestas
// 200 { ok: true }                  — enviado (o honeypot rellenado: descartado en silencio)
// 400 { ok: false, error: string }  — campo vacío o formato de correo inválido
// 500 { ok: false, error: string }  — falta RESEND_API_KEY / CONTACT_TO_EMAIL / FROM_EMAIL, o falló Resend
```

Correo saliente (texto plano): `subject: "Arcade Vault — Mensaje de {name}"`, `to: CONTACT_TO_EMAIL`, `from: FROM_EMAIL`, `replyTo: email` del formulario, cuerpo con nombre, correo y mensaje.

## Implementation plan

1. **Dependencia y entorno.** `npm install resend`; completar `.env.template` con las tres variables documentadas y crear `.env.local` local con los valores reales. Verificar: `npx tsc --noEmit` sigue en verde.
2. **CSS del about.** Diff de los `className` de `about.jsx` contra `globals.css`; añadir al final solo los que falten. Verificar: `npm run lint` y las rutas existentes se ven igual.
3. **Route handler.** Crear `app/api/contact/route.ts` (POST): parseo del body, validación vacío + formato, honeypot, envío con Resend y mapeo de errores a 400/500. Antes de escribirlo, leer la guía de route handlers en `node_modules/next/dist/docs/` (CLAUDE.md). Verificar: `curl -X POST localhost:3000/api/contact` con un body válido devuelve 200 (o 500 si faltan env vars) y con campos vacíos devuelve 400.
4. **Página about.** Crear `components/About.tsx` con `useReveal` (idéntico al de `Home.tsx`), `HighlightIcon` y todo el JSX de la plantilla; añadir `sending`/`error` y el `fetch` a `/api/contact`. Crear `app/sobre-nosotros/page.tsx`. Verificar: `/sobre-nosotros` renderiza completo, con `reveal` al scrollear; enviar con campos vacíos hace `shake`; con datos válidos muestra la terminal de éxito (o la de error si el endpoint falla); "ENVIAR OTRO MENSAJE" limpia el estado.
5. **Nav "Sobre Nosotros".** Añadir el link en escritorio y panel móvil con active en `/sobre-nosotros`. Verificar: el link activo corresponde a la ruta y el panel móvil lo incluye.
6. **Sincronizar SPEC 02.** Marcar como resueltos el criterio "No hay link 'Acerca de'" y el "Out of scope" del about en `specs/02-home-landing.md`. Verificar: `npx tsc --noEmit`, `npm run lint` y consola limpia en `/`, `/sobre-nosotros` y el POST del endpoint.

## Acceptance criteria

- [x] `/sobre-nosotros` renderiza el hero (`▸ ACERCA DE`, "ACERCA DE ARCADE VAULT", misión), los 3 highlights (HEART / BROWSER / PLANT) y el divider de 24 píxeles.
- [x] El contenido textual de `/sobre-nosotros` es idéntico a `about.jsx` (misión, highlights, tips, placeholders).
- [x] Las secciones con `reveal` de `/sobre-nosotros` adquieren la clase `in` al entrar en el viewport y no la pierden al salir.
- [x] Enviar con algún campo vacío muestra el `shake` de 400 ms y no hace `fetch`.
- [x] Enviar con datos válidos hace POST a `/api/contact` y muestra la terminal de éxito solo tras una respuesta 2xx, con el nombre en mayúsculas.
- [x] Durante el envío el botón está deshabilitado y muestra "▶ ENVIANDO…"; no se puede enviar dos veces en paralelo.
- [x] Si el endpoint devuelve 4xx/5xx, se muestra la terminal de error con la misma estética VAULT-OS y el botón REINTENTAR reintenta el envío.
- [x] "ENVIAR OTRO MENSAJE" limpia `sent`/`error` y vacía el formulario.
- [x] `POST /api/contact` con campos vacíos o correo con formato inválido responde 400 sin llamar a Resend.
- [x] `POST /api/contact` con `website` relleno responde 200 sin enviar correo (honeypot).
- [x] Con el formulario válido, el correo llega a `CONTACT_TO_EMAIL` con `replyTo` del remitente y asunto "Arcade Vault — Mensaje de {name}".
- [x] Falta alguna de las tres env vars → el endpoint responde 500 y el cliente muestra la terminal de error (nunca un crash ni un éxito falso).
- [x] `.env.template` documenta `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `FROM_EMAIL` sin valores reales; `.env.local` no está en el repo.
- [x] El Nav muestra Inicio · Biblioteca · Salón · Sobre Nosotros en escritorio y en el panel móvil; "Sobre Nosotros" está activo solo en `/sobre-nosotros`.
- [x] `specs/02-home-landing.md` ya no afirma que no hay link "Acerca de".
- [x] `npx tsc --noEmit` y `npm run lint` terminan sin errores.
- [x] `/sobre-nosotros` carga sin errores en la consola del navegador.

## Decisions

- **Sí:** ruta `/sobre-nosotros` y link "Sobre Nosotros" en lugar de `/about`/"Acerca de" (petición del usuario). URL en español consistente con el resto de rutas (`/juego`, `/jugar`, `/salon`); el interno `about.jsx`, los prefijos CSS `about-*` y `components/About.tsx` no cambian, son nombres de plantilla.
- **Sí:** route handler `app/api/contact/route.ts` + `fetch` desde el cliente (elegido por el usuario sobre Server Action). Explícito, testeable con curl y sin acoplar el form a las sorpresas de `cacheComponents`.
- **Sí:** env vars `CONTACT_TO_EMAIL` y `FROM_EMAIL` (elegido por el usuario sobre hardcodear). El destino cambia sin redeploy y no queda en el repo; `FROM_EMAIL` apunta a un dominio ya verificado en Resend (confirmado por el usuario).
- **Sí:** terminal de error con REINTENTAR, con la misma estética VAULT-OS que el éxito (elegido por el usuario). La plantilla no tenía ruta de fallo porque no enviaba nada; inventar un estilo nuevo rompería la coherencia.
- **Sí:** honeypot como única anti-spam (elegido por el usuario). Costo casi nulo; el rate limit queda fuera por ahora.
- **Sí:** servidor valida vacío + formato de correo (elegido por el usuario). El cliente ya valida vacío; el formato solo puede comprobarse de forma fiable en el servidor.
- **Sí:** honeypot relleno → 200 sin enviar. Responder 400 le dice al bot que fue detectado; el usuario real nunca llena ese campo.
- **Sí:** `sent` recién tras 2xx. Mostrar éxito antes de confirmar haría creer al usuario que escribió cuando no llegó.
- **Sí:** correo texto plano con asunto fijo "Arcade Vault — Mensaje de {name}" y `replyTo` del remitente. React Email / plantilla HTML es alcance extra sin valor ahora.
- **Sí:** `useReveal` local duplicado en `About.tsx`, no extraído a un hook compartido. Mismo patrón que la plantilla y que `Home.tsx`; tocar `Home.tsx` para compartirlo es deuda de refactor, no de este spec.
- **Sí:** portar solo las clases que faltan al final de `globals.css`, como hizo SPEC 02. El `styles.css` completo (1744 líneas) trae clases ajenas.
- **Sí:** actualizar el criterio obsoleto del SPEC 02. Mismo precedente que la sincronización de SPEC 01 en SPEC 02: specs contradictorios sobre el Nav son deuda segura.
- **No:** persistir mensajes en BD. Llegan por correo; una tabla de contacto no tiene consumidor.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Resend rechaza el `from` si el dominio no está verificado o la API key es inválida. | Dominio verificado confirmado por el usuario; el fallo cae en la terminal de error con REINTENTAR y el 500 está en los criterios de aceptación. |
| Endpoint público abusado (spam / bombeo). | Honeypot; rate limit documentado como fuera de scope si llega a hacer falta. |
| `resend.emails.send` tarda y el usuario reenvía. | Botón deshabilitado con estado `sending` mientras hay un POST en curso. |
| Next 16 tiene breaking changes (`cacheComponents`). | Leer la guía de route handlers en `node_modules/next/dist/docs/` antes del paso 3, como indica CLAUDE.md. |
| El diff de CSS omite una clase (`shake`, `term-*`…) y el about se ve roto. | El paso 2 es un diff de todos los `className` de `about.jsx`, no una lista a ojo; el criterio cubre la terminal de éxito y la de error. |

## What is **not** in este spec

- Almacenar o listar los mensajes recibidos (solo correo).
- Rate limit, CAPTCHA u otras anti-spam.
- Correo con plantilla HTML (React Email).
- Autenticación real, backend ampliado, tests automatizados.
- Cambios en la home, el footer o el layout.

Cada uno de estos, si llega, va en su propio spec.
