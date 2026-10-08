# SPEC 02 — Home landing de `references/templates/home-about`

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-10-08
> **Objective:** Implementar la home landing de `references/templates/home-about/home.jsx` como raíz `/`, moviendo la biblioteca a `/games` y dejando el about para un spec futuro.

## Por qué existe este spec

SPEC 01 portó cinco pantallas y dejó la biblioteca en `/`. La plantilla `home-about` añade un landing que en la SPA vive en la raíz (`navigate({ name: "home" })`) y un `nav.jsx` con link "Inicio" cuyo destino es el home. Para no contradecir la plantilla hay que reubicar la biblioteca; además, el CSS de la home (~100 selectores: `home-*`, `feature-*`, `pricing-*`, `activity-*`, `reveal`) no está en `app/globals.css`.

## Scope

**In:**

- Pantalla home portada de `references/templates/home-about/home.jsx`: hero (siluetas SVG flotantes, título "EL ARCADE CLÁSICO ESTÁ DE VUELTA", CTAs "EXPLORAR JUEGOS" y "CREAR CUENTA"), secciones `reveal` (features `// 01`, mini-rail de juegos `// 02`, stats, actividad en vivo `// 03`, precios + FAQ `// 04`) y CTA final "INSERTAR MONEDA →".
- Reubicación de rutas: `/` pasa a ser home; la biblioteca se muda a `/games` (`app/games/page.tsx`, renderizando el `components/Biblioteca.tsx` existente sin cambios de UI).
- Destinos actualizados en componentes existentes: `Auth.tsx` (tras login y tras jugar como invitado), `Detalle.tsx` ("VOLVER AL VAULT"), `Reproductor.tsx` ("VOLVER AL VAULT") y `Salon.tsx` ("VOLVER A LA BIBLIOTECA") → todos a `/games`, como en la plantilla (que navega a `biblioteca`).
- `Nav.tsx`: logo → `/`; links **Inicio (`/`) · Biblioteca (`/games`) · Salón (`/salon`)** en escritorio y en el panel móvil; "Inicio" activo solo en `/`, "Biblioteca" activa en `/games`, `/juego/*` y `/jugar/*`. El botón de sesión/Auth queda como está.
- CSS: diff de selectores entre `references/templates/home-about/styles.css` y `app/globals.css`; añadir a `globals.css` solo las clases que `home.jsx` usa y faltan (secciones nuevas al final, sin reescribir lo existente). Incluye `reveal`/`.in` para las animaciones de scroll.
- Datos: `GAMES.slice(0, 6)` desde `lib/data.ts` para el mini-rail; los literales de "ACTIVIDAD EN VIVO" (ticker de últimas puntuaciones y "TOP JUGADORES · HOY"), features, stats y FAQ portados tal cual de la plantilla.
- Actualizar `specs/01-mvp-pantallas-vault.md`: las rutas y criterios de aceptación que asumen que la biblioteca vive en `/` pasan a `/games`.
- `components/Home.tsx` con `"use client"` (el `IntersectionObserver` del hook `useReveal` no corre en SSR).

**Out of scope (for future specs):**

- About (`about.jsx`: misión, highlights, formulario de contacto) y el link "Acerca de" del Nav. El link se agregará en el spec del about, cuando exista `/about` (hoy daría 404).
- Datos dinámicos de "ACTIVIDAD EN VIVO": derivar el ticker o el top de `av_scores`/`seededScores` en lugar de los literales.
- Juegos jugables, autenticación real, backend o API, puntuaciones en servidor (hereda la exclusión de SPEC 01).
- Tests automatizados.
- Cambios en `layout.tsx`, el footer o las fuentes (ya funcionan; el footer aparece en `/` automáticamente).

## Data model

Este spec no introduce estructuras de datos nuevas. Reutiliza `GAMES` de `lib/data.ts` (SPEC 01). El ticker de últimas puntuaciones y la lista "TOP JUGADORES · HOY" son literales dentro de `components/Home.tsx`, idénticos a la plantilla:

```ts
// solo literales locales en Home.tsx — no se persisten ni se comparten
const TICKER = [{ p: "NEONFOX", g: "Caída", s: 184220, t: "hace 2 min", c: "magenta" }, /* …7 filas */];
const TOP = [{ r: 1, p: "NEONFOX", s: 312840 }, /* …5 filas */];
```

## Implementation plan

1. **Biblioteca a `/games`.** Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (renderiza `Biblioteca`). Actualizar destinos: `Auth.tsx` (2× `push("/")`), `Detalle.tsx` ("VOLVER AL VAULT"), `Reproductor.tsx` ("VOLVER AL VAULT"), `Salon.tsx` ("VOLVER A LA BIBLIOTECA") y el link "Biblioteca" + `isLibrary` del `Nav.tsx` → `/games`. `app/page.tsx` sigue mostrando la biblioteca por ahora. Verificar: `/games` y `/` muestran la biblioteca; "VOLVER AL VAULT" llega a `/games`.
2. **CSS de la home.** Diff de selectores de `home-about/styles.css` contra `globals.css`; añadir al final de `globals.css` solo los que usa `home.jsx` y falten (`home-*`, `hero-eyebrow`, `hero-scroll`, `section-*`, `feature-*`, `mini-*`, `stats-*`, `activity-*`, `tick-*`, `top-*`, `tp-*`, `pricing-*`, `pc-*`, `faq-*`, `final-*`, `reveal`, `lb-link`, `rivet`…). Excluir clases `about-*`/`contact-*` (spec del about). Verificar: `npm run lint` y las rutas existentes se ven igual.
3. **Componente home.** Crear `components/Home.tsx` (`"use client"`): hook `useReveal` con `IntersectionObserver`, `FloatingSilhouettes`, `FeatureIcon`, `MiniCard` y todas las secciones en el orden de la plantilla. CTAs: EXPLORAR JUEGOS / VER TODOS / INSERTAR MONEDA → `/games`; CREAR CUENTA / EMPEZAR GRATIS → `/auth`; VER SALÓN → `/salon`; MiniCard → `/juego/[id]`. Reemplazar el contenido de `app/page.tsx` por `<Home />`. Verificar: `/` muestra la home completa, las secciones hacen reveal al scrollear, consola limpia.
4. **Nav con Inicio.** Añadir link "Inicio" (`/`) en escritorio y panel móvil, mover el logo a `/` y ajustar active states (Inicio solo en `/`; Biblioteca en `/games`, `/juego/*`, `/jugar/*`). No añadir "Acerca de". Verificar: el link activo corresponde a cada ruta y el logo va al home.
5. **Sincronizar SPEC 01.** En `specs/01-mvp-pantallas-vault.md`, cambiar la ruta de biblioteca de `/` a `/games` (lista de rutas, verbos de los criterios de aceptación y cualquier mención) para que no contradiga el estado real.

## Acceptance criteria

- [ ] `/` renderiza la home: hero con "▸ INSERTA UNA MONEDA_", las tres líneas del título, subtítulo y los dos CTAs; las siluetas SVG flotantes están presentes y ocultas para lectores de pantalla (`aria-hidden`).
- [ ] Las secciones con `reveal` adquieren la clase `in` al entrar en el viewport (threshold ~0.12) y no la pierden al salir.
- [ ] "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/games`.
- [ ] "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; "VER SALÓN →" navega a `/salon`.
- [ ] El mini-rail muestra los 6 primeros juegos de `GAMES` (`lib/data.ts`) con título y categoría; cada card navega a `/juego/[id]`.
- [ ] Las secciones 01–04 y el CTA final muestran el mismo contenido textual que la plantilla (4 features, 3 stats, 7 filas de ticker, 5 filas de top, plan único con 6 ítems, 3 FAQs).
- [ ] `/games` muestra la biblioteca con el mismo comportamiento que antes (buscador, chips, grilla, "NO HAY RESULTADOS").
- [ ] Tras iniciar sesión o entrar como invitado desde `/auth`, la navegación llega a `/games`.
- [ ] "VOLVER AL VAULT" (detalle y reproductor) y "VOLVER A LA BIBLIOTECA" (salón) navegan a `/games`.
- [ ] El Nav muestra Inicio · Biblioteca · Salón y el botón de sesión; el logo lleva a `/`; "Inicio" está activa solo en `/` y "Biblioteca" en `/games`, `/juego/*` y `/jugar/*`; el panel móvil repite los mismos links.
- [ ] No hay link "Acerca de" en el Nav.
- [ ] El footer "© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0" aparece en `/` y en `/games`.
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.
- [ ] `/` y `/games` cargan sin errores en la consola del navegador.
- [ ] `specs/01-mvp-pantallas-vault.md` ya no afirma que la biblioteca vive en `/`.

## Decisions

- **Sí:** `/` = home y biblioteca → `/games` (ajuste del usuario sobre la opción inicial `/biblioteca`). La raíz y el logo coinciden con la plantilla; los deep-links de la biblioteca quedan en una ruta explícita.
- **No:** link "Acerca de" en este spec. Decisión del usuario: el about va en su propio spec y el link se agrega cuando `/about` exista, para no publicar un 404.
- **No:** página placeholder en `/about`. Adelantaría trabajo del spec del about.
- **Sí:** literales hardcodeados en "ACTIVIDAD EN VIVO", como la plantilla. Derivarlos de `av_scores`/`seededScores` es alcance extra con valor dudoso para una landing.
- **Sí:** portar solo las clases que `home.jsx` usa a `globals.css`, no volcar el `styles.css` completo (1744 líneas incluyen `about-*`, `contact-*` y clases de otros componentes ajenos como `gp-*`/`dp-*`).
- **Sí:** post-login y back buttons → `/games`. La plantilla manda a `biblioteca` en todos esos casos; `biblioteca` se renombra a `/games`.
- **Sí:** actualizar SPEC 01 en este mismo spec. Dos specs contradictorios sobre a qué apunta `/` es deuda segura.
- **Sí:** `components/Home.tsx` con `"use client"`. El `IntersectionObserver` de `useReveal` necesita efectos del cliente; el estado inicial no toca `localStorage`, así que no hay riesgo de mismatch de hidratación.
- **No:** tocar `layout.tsx`, footer, fuentes ni `SessionProvider`. La home entra como cualquier otra pantalla del marco existente (decisión del SPEC 01 que se conserva).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `styles.css` de `home-about` es un superset con clases que no son de la home (`about-*`, `gp-*`, `dp-*`). | Portar solo las clases verificadas en los `className` de `home.jsx`; excluir explícitamente las del about. |
| Mover la biblioteca deja algún `push("/")` o `href="/"` sin actualizar. | Búsqueda de `"/"` en `components/*.tsx` durante el paso 1; el criterio de aceptación cubre cada back button. |
| Next 16 tiene breaking changes (`cacheComponents`). | Antes de escribir código Next, leer la guía relevante en `node_modules/next/dist/docs/` como indica CLAUDE.md. |
| Animaciones `reveal` sin IntersectionObserver (JS deshabilitado) dejan secciones invisibles. | Comportamiento idéntico a la plantilla; se acepta como está (la plantilla tampoco tiene fallback). |

## What is **not** in this spec

- About (`about.jsx`) y link "Acerca de" en el Nav — spec futuro, con `/about`.
- "ACTIVIDAD EN VIVO" alimentada por puntuaciones reales.
- Juegos jugables, autenticación real, backend, tests automatizados.
- Cambios en el layout, el footer o las fuentes.

Cada uno de estos, si llega, va en su propio spec.
