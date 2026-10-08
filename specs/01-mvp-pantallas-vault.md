# SPEC 01 — MVP visual de Arcade Vault (pantallas de references/templates)

> **Status:** Implementado
> **Depends on:** ninguna
> **Date:** 2026-10-07
> **Objective:** Implementar como MVP visual las cinco pantallas de `references/templates/` (biblioteca, detalle, reproductor, autenticación y salón de la fama) en Next.js App Router, sin implementar ningún juego.

## Por qué existe este spec

Las plantillas están escritas como SPA en JSX con routing por hash (`app.jsx`) y datos en `window`, mientras que el repo es una app Next.js 16 App Router en TypeScript, verde en features. La decisión no obvia es cómo adaptar la SPA a rutas de archivo sin perder el comportamiento de las plantillas.

## Scope

**In:**

- Cinco pantallas portadas desde `references/templates/`: biblioteca (`biblioteca.jsx`), detalle (`detalle.jsx`), reproductor (`reproductor.jsx`), autenticación (`auth.jsx`) y salón de la fama (`salon.jsx`).
- Chrome compartido: `Nav` (escritorio + panel móvil) y footer "© 2026 ARCADE VAULT", añadidos dentro del `app/layout.tsx` actual (se conservan sus fuentes, `av-bg` y metadata).
- Rutas del App Router: `/games` (biblioteca), `/juego/[id]` (detalle), `/jugar/[id]` (reproductor), `/auth`, `/salon`.
- Datos mock de `references/templates/data.jsx` portados a TypeScript en `lib/data.ts` (8 juegos, categorías, `seededScores`).
- Persistencia mock en localStorage: sesión (`av_user`) y puntuaciones (`av_scores`), igual que `app.jsx`.
- Toda la interactividad visual de las plantillas: búsqueda y filtros de la biblioteca, tabs del salón, pestañas del login, pausa y modal "FIN DEL JUEGO" del reproductor.
- Componentes en `components/*.tsx` con `"use client"` donde haya estado.

**Out of scope (for future specs):**

- Juegos jugables: cualquier lógica de juego real (el reproductor conserva solo el mock visual de la plantilla).
- Autenticación real: OAuth de Google/GitHub, contraseñas, backend. Los botones sociales quedan decorativos.
- Puntuaciones o sesión en servidor; sincronización entre dispositivos.
- Cualquier backend o API.
- Añadir pantallas o quitar las que traen las plantillas.
- Tests automatizados.

## Data model

```ts
// lib/data.ts — port de references/templates/data.jsx
type Game = {
  id: string;          // p. ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;       // clase CSS, p. ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;       // p. ej. "12.4K"
};

const GAMES: Game[];                              // 8 juegos, idénticos a la plantilla
const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

type ScoreRow = { rank: number; name: string; score: number; date: string };
function seededScores(seed: number, count?: number): ScoreRow[];

// Sesión — localStorage "av_user" → JSON de:
type User = { name: string };                     // name: mayúsculas, máx. 10 chars
// Puntuaciones — localStorage "av_scores" → JSON de:
type SavedScore = { game: string; score: number; name: string; at: number };
```

Estado local del reproductor (no persistido, vive en el componente): `score`, `lives`, `level`, `paused`, `over`, `saved`.

## Implementation plan

1. **Datos mock.** Crear `lib/data.ts` con `Game`, `GAMES`, `CATS`, `PLAYERS` y `seededScores()` portados de `references/templates/data.jsx`. Verificar: `npx tsc --noEmit` compila.
2. **Contexto de sesión.** Crear `components/SessionProvider.tsx` (`"use client"`) con `user`, `login`, `signOut` y `saveScore` sobre `av_user`/`av_scores`; envolver `children` desde `app/layout.tsx`. Verificar: `/games` renderiza sin errores.
3. **Nav + footer.** Crear `components/Nav.tsx` desde `nav.jsx` (links con `next/link`, hamburguesa, sesión desde el contexto) y añadir el footer de `app.jsx` en `app/layout.tsx`. Verificar: el nav aparece en `/games`, los links navegan, la hamburguesa abre el panel en vista estrecha.
4. **Ruta `/games` — biblioteca.** Crear `app/games/page.tsx` con `components/Biblioteca.tsx` (hero, buscador, chips de categoría, `GameCard` con efecto tilt). Verificar: buscar y filtrar cambian la grilla; sin resultados aparece "NO HAY RESULTADOS".
5. **Ruta `/juego/[id]` — detalle.** Crear `components/Detalle.tsx` y `app/juego/[id]/page.tsx`. "JUGAR AHORA" → `/jugar/[id]`. Id desconocido → `notFound()`. Verificar: se llega desde una card y se vuelve con "VOLVER AL VAULT".
6. **Ruta `/auth`.** Crear `components/Auth.tsx` y `app/auth/page.tsx` (pestañas iniciar/crear cuenta, jugar como invitado, sociales decorativos). Verificar: al enviar, el Nav muestra el nombre y persiste tras recargar.
7. **Ruta `/salon`.** Crear `components/Salon.tsx` y `app/salon/page.tsx` (podio, tabla, tabs por juego, fila "TU MEJOR MARCA" si hay sesión). Verificar: cambiar de tab cambia el leaderboard; la fila de usuario aparece tras login.
8. **Ruta `/jugar/[id]` — reproductor.** Crear `components/Reproductor.tsx` y `app/jugar/[id]/page.tsx` con el mock de la plantilla: HUD, CRT, puntuación automática, pausa, modal "FIN DEL JUEGO" con guardado en `av_scores`. Verificar: pausa, fin, guardar y reinicio funcionan.

## Acceptance criteria

- [ ] `/games` renderiza la biblioteca con hero, buscador y chips; buscar y filtrar reducen la grilla; sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Hacer clic en una card o en "JUGAR" navega a `/juego/[id]`.
- [ ] `/juego/[id]` muestra portada, tags, estadísticas y leaderboard; "JUGAR AHORA" navega a `/jugar/[id]`; un id inexistente devuelve 404.
- [ ] `/auth` alterna entre pestañas (el campo de correo solo aparece en "CREAR CUENTA") y al enviar guarda `av_user` en localStorage.
- [ ] Tras iniciar sesión y recargar la página, el Nav sigue mostrando el nombre de usuario.
- [ ] El botón de usuario en el Nav cierra sesión y vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra podio (01/02/03) y tabla; cambiar de tab cambia el leaderboard; con sesión activa aparece la fila "TU MEJOR MARCA" resaltada en amarillo.
- [ ] `/jugar/[id]` muestra HUD con puntuación que aumenta sola; "PAUSA" muestra el overlay "EN PAUSA"; "FIN" abre el modal "FIN DEL JUEGO".
- [ ] Guardar la puntuación escribe una entrada en `av_scores` y muestra "PUNTUACIÓN GUARDADA_"; "JUGAR DE NUEVO" resetea score/vidas/nivel.
- [ ] El Nav marca como activo el link correcto según la ruta y el logo lleva a `/`; el contador "CRÉDITOS · 03" está visible en escritorio y en el panel móvil.
- [ ] El footer "© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0" aparece en las cinco rutas.
- [ ] Ninguna ruta implementa lógica de juego real (el CRT solo corre el mock visual de la plantilla).
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.
- [ ] Las cinco rutas cargan sin errores en la consola del navegador.

## Decisions

- **Sí:** rutas del App Router (`/games`, `/juego/[id]`, `/jugar/[id]`, `/auth`, `/salon`) en lugar del hash routing de `app.jsx`. El hash no aporta nada en Next y las rutas dan deep-links reales.
- **No:** replicar el estado de ruta central de `app.jsx`. Cada pantalla vive en su página; el estado compartido (usuario) va en un contexto.
- **Sí:** `SessionProvider` (contexto cliente en `layout.tsx`) para compartir `user` entre `Nav` y las páginas. Es la consecuencia técnica de pasar de SPA a App Router: el nav necesita el usuario sin prop-drilling entre rutas.
- **Sí:** conservar el mock temporal del reproductor (puntuación automática cada 220 ms, pausa, modal). Es el comportamiento de la plantilla, no un juego.
- **Sí:** persistencia en localStorage con las mismas claves que la plantilla (`av_user`, `av_scores`), con `try/catch` en cada acceso.
- **Sí:** conservar el `layout.tsx` actual (fuentes `Press_Start_2P`/`JetBrains_Mono`/`Courier_Prime`, `av-bg`, `av-noise`, metadata) y solo añadirle Nav y footer. Decisión del usuario: no reemplazar el armazón.
- **Sí:** el CSS ya está portado en `app/globals.css` (rama `01-styles`). No se reescribe con Tailwind ni se copia `styles.css` de nuevo; solo se verifica que no falte ninguna clase.
- **Sí:** botones sociales decorativos en el auth. OAuth real merece su propio spec.
- **Sí:** organización `components/*.tsx` + `lib/data.ts`.
- **Sí:** id desconocido en `/juego/[id]` → `notFound()` (404 de Next por defecto) en lugar del `return null` de la plantilla, que dejaría la pantalla en blanco.
- **No:** leer `localStorage` en el initializer de `useState` (como hace la plantilla). Eso rompe la hidratación de SSR: el estado inicial es `null` y se lee en `useEffect`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `localStorage` en el render inicial causa mismatch de hidratación en Next. | Estado inicial `null`; leer `av_user`/`av_scores` solo en `useEffect` tras montar. |
| `globals.css` (CRLF, 959 líneas) podría diferir de `styles.css` de la plantilla. | Antes de empezar, diff de selectores: si falta una clase, portarla; no reescribir el resto. |
| Next 16 tiene breaking changes (`cacheComponents`). | Antes de escribir código Next, leer la guía relevante en `node_modules/next/dist/docs/` como indica CLAUDE.md. |

## What is **not** in this spec

- Juegos reales (cualquier juego jugable va en otro spec).
- Autenticación real y login social funcional.
- Backend, API o puntuaciones en servidor.
- Tests automatizados.
- Pantallas nuevas o eliminadas respecto a `references/templates/`.

Cada uno de estos, si llega, va en su propio spec.
