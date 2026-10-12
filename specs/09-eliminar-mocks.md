# SPEC 09 — Eliminar los mocks y dejar solo juegos reales (+ TETRIS en Supabase)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-10-12
> **Objective:** Eliminar todo lo mockeado (`Reproductor` + comodín `/jugar/[id]` + filas de relleno de `av_games`) para que el catálogo contenga solo juegos reales —`asteroides` y `tetris`— y que el Tetris quede conectado a Supabase guardando en `av_scores`.

## Por qué existe este spec

SPEC 05 portó Asteroids y dejó intacto el `Reproductor` mock; SPEC 07 extrajo el contrato compartido y lo convirtió en un "conductor mock" de `GameShell` con su arena decorativa y un ticker de puntuación (+10..+99 cada 220 ms); SPEC 08 portó el Tetris a una ruta dedicada. Hoy el catálogo `av_games` tiene **10 ids** pero solo **2 juegos reales**: los otros 8 (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`) no tienen ruta estática y caen en el comodín `/jugar/[id]` → `Reproductor`. Además, la fila `tetris` del catálogo (spec 08) **aún no está aplicada** en Supabase, así que `/jugar/tetris` devuelve 404 y no hay card TETRIS. Este spec retira el simulacro por completo —el usuario quiere que en la plataforma solo existan juegos que de verdad se juegan— y termina de conectar el Tetris a la base (fila + guardado en `av_scores`).

## Scope

**In:**

- **Quitar el mock:** eliminar `components/Reproductor.tsx`, su uso en el comodín, el CSS solo-mock (`.game-arena`, `.grid-floor`, `.player-ship`, `.enemy`, `.e1/.e2/.e3` y `@keyframes bob`/`drift`), y las 8 filas de relleno de `av_games` (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`).
- **`/jugar/[id]` deja de servir mock:** reescribe el comodín para que **redirija a `/juego/[id]`** (la validación final con `notFound()` la hace la página de detalle). Cualquier id del catálogo con ruta estática (`asteroides`, `tetris`) gana sobre el comodín; los ids fuera de catálogo acaban en 404 natural en `/juego/[id]`.
- **Tetris en Supabase:** aplicar la migración `0002_av_game_tetris.sql` (INSERT de la fila `tetris`, pendiente) vía conexión directa, y confirmar que el guardado de puntuación escribe en `av_scores` (vía `GameShell.saveScore` → `@/lib/supabase/client`, RLS permite insert).
- **Limpieza de la skill `/add-game`** (`.claude/skills/add-game/` y `.agents/skills/add-game/`, espejadas): retirar la mención al refactor de `Reproductor` en la Fase D y el caso "conductor mock" / `.game-arena` de `engine-contract.md`, ya obsoletos.
- **Migración `0003_remove_mock_games.sql`:** `DELETE` de las 8 filas de relleno (con el FK `av_scores.game … on delete cascade` asociado).
- Aplicar el SQL por **conexión directa de Postgres** (rol `postgres`, bypasea RLS) con la DSN construida de `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_DB_PASSWORD`, **previo visto bueno del usuario sobre el texto SQL**.

**Out of scope (for future specs):**

- Portar el resto de juegos (cada uno en su spec con `/add-game`; el catálogo queda abierto a filas nuevas).
- Auth real / anti-cheat / validación de puntuaciones en servidor (spec futuro, como en 06/08).
- Rediseño visual del HUD/CRT/pausa/modal.
- Sonido, móvil/táctil, gamepad.

## Data model

No introduce estructuras nuevas. Cambios sobre el modelo existente (SPEC 06/08):

- Catálogo `av_games` pasa de 10 filas a **2**: solo `asteroides` (sort 6) y `tetris` (sort 9).
- La fila `tetris` (migración 0002, pendiente de aplicar) = `{ id:'tetris', title:'TETRIS', cat:'PUZZLE', cover:'cover-tetro', color:'magenta', sort:9 }`.
- Migración `0003` borra las 8 filas sin ruta estática; el FK `on delete cascade` limpia sus puntajes de `av_scores`.

La ruta comodín queda así:

```ts
// app/jugar/[id]/page.tsx
export const instant = false;
export default async function JugarPage({ params }: PageProps<'/jugar/[id]'>) {
  const { id } = await params;
  redirect(`/juego/${id}`); // la validación final (notFound) la hace /juego/[id]
}
```

## Implementation plan

1. **Spec 09 (este archivo).** Documenta el plan y los criterios. Estado `Borrador`.
2. **Código app.** Reescribir `app/jugar/[id]/page.tsx` a un `redirect('/juego/' + id)` puro (import de `next/navigation`; sin `getGames()` ni `Reproductor`); eliminar `components/Reproductor.tsx`.
3. **CSS.** Quitar de `app/globals.css` el bloque solo-mock: `.game-arena` (y `.grid-floor`, `.player-ship`, `.enemy`, `.e1/.e2/.e3`) y `@keyframes bob`/`drift`. Releer el rango antes de editar.
4. **Skill `/add-game`.** En ambas carpetas: quitar de `SKILL.md` (Fase D) la referencia a refactor `Reproductor`; en `engine-contract.md` quitar el caso "conductor mock" y la reutilización de `.game-arena`.
5. **Chequeos.** `npx tsc --noEmit` y `npm run lint` → 0 errores.
6. **Migración `0003_remove_mock_games.sql`.** Crear el `DELETE` de las 8 filas; **mostrar el SQL al usuario para aprobarlo** antes de ejecutar.
7. **Aplicar SQL en Supabase.** Aprobar y ejecutar `0002_av_game_tetris.sql` (INSERT tetris) + `0003` (DELETE mocks) vía `npx supabase db query --db-url "$DSN"` (fallback: pegar en el SQL editor del dashboard).
8. **Verificación.** REST del catálogo antes/después; navegación e2e; confirmar guardado de TETRIS en `av_scores`.

## Acceptance criteria

- [ ] `components/Reproductor.tsx` ya no existe; ningún archivo de `app/` lo importa.
- [ ] `/jugar/[id]` redirige a `/juego/[id]`; `/jugar/caida` (u otro id fuera) acaba en 404 vía `/juego/[id]`.
- [ ] No queda CSS solo-mock en `app/globals.css` (`.game-arena`, `bob`, `drift`).
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores (refactor + borrado).
- [ ] El catálogo remoto `av_games` contiene **solo** `asteroides` y `tetris` (REST).
- [ ] `/games` muestra solo 2 cards (ASTEROIDES, TETRIS); `/salon` solo esos 2 tabs + GLOBAL.
- [ ] `/jugar/tetris` monta board 300×600 + preview y juega (mover/rotar/drop/línea).
- [ ] GUARDAR PUNTUACIÓN en Tetris escribe en `av_scores` y el récord aparece en `/juego/tetris` y `/salon`.
- [ ] `/jugar/asteroides` sin regresión (jugar, pausar, fin, guardar, reiniciar).
- [ ] La skill `/add-game` (ambas carpetas) ya no menciona `Reproductor` ni `.game-arena`.

## Decisions

- **Sí:** eliminar el mock por completo (`Reproductor`, comodín con `redirect`, CSS, filas de relleno). El usuario quiere "solo juegos reales".
- **Sí:** `/jugar/[id]` → `redirect('/juego/[id]')`. El comodín deja de fabricar simulacros; la validación final la hace `notFound()` de `/juego/[id]`. No se devuelve un 404 crudo desde `/jugar`.
- **Sí:** aplicar la migración del catálogo con **conexión directa de Postgres** (`SUPABASE_DB_PASSWORD`), no por REST (RLS solo permite SELECT en `av_games`). El guardado de puntuaciones sigue por el cliente publishable (RLS permite insert en `av_scores`).
- **Sí:** confirmación explícita del usuario sobre el texto SQL antes de ejecutar contra la base real.
- **Sí:** borrado de las 8 filas; el cascade limpia sus `av_scores` (puntajes de mock, sin valor).
- **No:** portar el resto de juegos aquí; el catálogo queda abierto a que `/add-game` añada filas reales.
- **No:** tocar la skill `/spec`/`/spec-impl` ni `specs/*` anteriores (historia; el cambio se documenta en este spec 09).

## Risks

| Riesgo                                                                                               | Mitigación                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| La conexión directa a `db.<ref>.supabase.co:5432` se bloquea (red/Supabase permite solo IPv6, etc.). | Fallback: pegar el SQL en el SQL editor del dashboard. El SQL queda versionado en `supabase/migrations/`.                    |
| Caracteres especiales en `SUPABASE_DB_PASSWORD` rompen la DSN.                                       | Construir la DSN extrayendo valores sin imprimirlos; si falla, script Node con `pg` + `--env-file`, o dashboard.             |
| El redirect `/jugar/[id]`↔`/juego/[id]` cae en bucle.                                                | Solo los ids sin ruta estática llegan al comodín (los estáticos ganan); `/juego/[id]` valida con `notFound()`. No hay bucle. |
| Queda CSS sin uso o se borra algo compartido.                                                        | El mock-era el único consumidor de esas clases (verificado); se relee el rango antes de editar.                              |
| `av_scores` de juegos borrados (cascade).                                                            | Aceptable: son puntajes generados por el mock; se documenta aquí.                                                            |

## What is **not** in this spec

- Portar `04-arkanoid` ni el resto de juegos (cada uno en su spec con `/add-game`).
- Auth real, anti-cheat, validación de puntuaciones en servidor.
- Rediseño visual del HUD/CRT/pausa/modal, sonido, móvil/táctil, gamepad.

Cada uno de estos, si llega, va en su propio spec.
