# SPEC 08 — Juego real de Tetris portado a Next.js (TETRIS/tetris)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-12
> **Objective:** Portar `references/started-games/03-tetris/game.js` a un componente React con dos canvases servido en la ruta dedicada `/jugar/tetris`, construido sobre el contrato compartido de un juego (SPEC 07) y guardando la puntuación final en `av_scores` (SPEC 06).

## Por qué existe este spec

SPEC 05 portó el primer juego real (Asteroids) a una ruta dedicada con su motor puro `lib/asteroids.ts` y su shell React. SPEC 06 puso el catálogo y el leaderboard en Supabase. SPEC 07 formalizó el contrato que todo motor debe seguir (`PlayableEngine` + `GameShell` + `useGameEngine`) y refactorizó Asteroids y el mock para usarlo. Este es el segundo juego real de la plataforma y el primero que se escribe **ya sobre la capa compartida**: no duplica el HUD, el marco CRT, la pausa ni el modal (viven en `GameShell`) — el spec describe el motor (`lib/tetris.ts`), el adapter (`components/TetrisGame.tsx`) y la ruta/rejilla del catálogo. La decisión no obvia es aprovechar la inversión de SPEC 07: de oro para el proyecto, y el contrato demuestra aquí su tesis.

## Scope

**In:**

- Puerto de `03-tetris/game.js` → motor puro `lib/tetris.ts` (`class TetrisEngine`), sin DOM y sin React, contra el contrato `PlayableEngine` (SPEC 07):
  - Tablero 10×20, celdas de 30 px; piezas IOTA-T-S-Z-J-L y una octava pieza "N" gris (tuerca) del original; colores canónicos.
  - Caída, rotación (transpose+reverse) con wall kicks `[0,-1,1,-2,2]`, fantasmas a `globalAlpha 0.2`, hard/soft drop con su puntuación (+2/celda, +1/row), `touch`/`gameover`.
  - `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel; nivel = `floor(lines/10) + 1`; `dropInterval = max(100, 1000 − (level−1)·90)` ms.
  - **Se retira el `getComputedStyle(...)` de `drawGrid`**: se reemplaza por un color fijo (el neon del CRT). _Se retira el theme toggle_ (Arcade Vault es dark-only). El HUD DOM (`#score/#lines/#level`) sale del motor y pasa a React vía `getSnapshot()`.
  - `getSnapshot()` devuelve el `GameSnapshot` compartido con `lives` en 3 y `extra: { lines }`.
- `components/TetrisGame.tsx` (`"use client"`), adapter sobre `useGameEngine` + `GameShell` (SPEC 07):
  - Un `<canvas>` `board` 300×600 (campo) y un `<canvas>` `next-canvas` 120×120 (preview), **lado a lado dentro del CRT** con letterboxing, ambos dibujados por el motor (`extras` = canvas del preview).
  - HUD con `GameShell`: score (campo core), Nivel y Líneas (de `extra.lines`); **sin tile de Vidas** (Tetris no tiene vidas — decisión de Fase C). Botes de pausa/FIN/SALIR.
  - Controles: ← → mover, Arriba/X rotar, ↓ soft drop, Espacio hard drop, P/F1 pausa — con `preventDefault` sobre las teclas de juego.
- Ruta `app/jugar/tetris/page.tsx` (server, `export const instant = false;`, `getGame('tetris')` → `notFound()`).
- Fila nueva en el catálogo `av_games` (SPEC 06): `id: 'tetris'`, `title: 'TETRIS'`, PUZZLE, `cover-tetro`, `color: magenta`, `sort: 9`. Se deja la fila de relleno `caida` (PUZZLE, `cover-tetro`, sort 1) intacta.
- Migración `supabase/migrations/0002_av_game_tetris.sql` con el `INSERT` en `av_games` (aplicada a mano en el dashboard, sin CLI).
- Guardado de la puntuación final en `av_scores` vía `saveScore` (SPEC 06) con el nombre de la sesión o `INVITADO`.

**Out of scope (for future specs):**

- Portar el resto de juegos (`04-arkanoid`, etc.): cada uno en su spec.
- El modo "próximo" fuera de los dos canvases, piezas extra además de la octava "N", hold de piezas, tabla de récords local, sonido, móvil/táctil, gamepad.
- Cambios visuales al diseño: el HUD, la pausa y el modal de SPEC 07 se reutilizan tal cual.
- Puntuaciones o validación en servidor, autenticación real, anti-cheat.

## Data model

El motor (`lib/tetris.ts`) — estructuras y constantes clave, fieles al original:

```ts
const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // px
const COLORS = [ /* 1..8: I cyan, O yellow, T purple, S green, Z red, J pale-blue, L orange, N gray */ ];
const PIECES = [ /* 8 matrices 4x4/rot states, incl. la "N" tuerca */ KICKS: [0,-1,1,-2,2] ];
const LINE_SCORES = [0, 100, 300, 500, 800];
// nivel = floor(lines/10)+1; dropInterval = max(100, 1000-(level-1)*90) ms; ghost @ alpha .2
```

Firma del motor contra el contrato (SPEC 07):

```ts
export class TetrisEngine {
  readonly width = 300; // canvas field
  readonly height = 600;
  update(dt: number): void; // dt seg, host limita a 50ms
  draw(
    ctx: CanvasRenderingContext2D,
    extras?: CanvasRenderingContext2D[],
  ): void; // ctx=board, extras[0]=preview
  input(code: string, down: boolean): void;
  restart(): void;
  endGame(): void;
  getSnapshot(): GameSnapshot; // { score, lives:3, level, over, extra:{ lines } }
}
```

El `GameSnapshot` compartido (`lib/engine.ts`): `{ score, lives, level, over, extra?: Record<string, number> }`. Aquí `extra: { lines }`, `lives` fija a 3 (Tetris no usa vidas; no se muestra tile). El preview se dibuja por el motor cada frame sobre `extras[0]`, **no** se guarda en estado.

Ruta: `app/jugar/tetris/page.tsx` — análoga a `app/jugar/asteroides/page.tsx`:

```ts
export const instant = false;
export default async function TetrisPage() {
  const game = await getGame('tetris');
  if (!game) notFound();
  return <TetrisGame game={game} />;
}
```

Fila de catálogo (`0002_av_game_tetris.sql`):

```sql
insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'tetris', 'TETRIS',
  'Alinea filas y encadena tetrominós.',
  'Duérmete y la torre te entierra. Rota, desplaza y encaja las siete piezas (y una octava tuerca) para completar líneas antes de que lleguen al techo.',
  'PUZZLE', 'cover-tetro', 'magenta', 9
);
```

## Implementation plan

1. **Motor.** Crear `lib/tetris.ts` portando `game.js` a una clase contra el contrato `PlayableEngine` (SPEC 07): estado, piezas, rotación/kicks, drops, líneas/nivel, ghost, `getSnapshot()`. Reemplazar `getComputedStyle` de `drawGrid` por un color fijo; borrar el theme toggle. Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el módulo importa sin efectos secundarios.
2. **Adapter.** Crear `components/TetrisGame.tsx` con `useGameEngine` + `GameShell` (SPEC 07): dos `useRef` (`board` 300×600, `next-canvas` 120×120) pasados como `canvas` y `extraCanvases`; `stats` sin Vidas (Nivel, Líneas). Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el componente renderiza sin errores en consola.
3. **Ruta.** Crear `app/jugar/tetris/page.tsx` (`export const instant = false;`, server, `getGame('tetris')` → `notFound()`). Verificar: `/jugar/tetris` carga el juego; `/jugar/asteroides` y `/jugar/<otros>` siguen sirviendo lo suyo; `npx tsc --noEmit` en verde.
4. **Catálogo.** Escribir `0002_av_game_tetris.sql`; aplicarlo en el SQL editor. Verificar: la card `TETRIS` aparece en `/games` con su cover/color; `/juego/tetris` y "JUGAR AHORA" navegan a `/jugar/tetris`.
5. **Layout.** Ajustar el CSS del CRT 4/3 para que los dos canvases queden lado a lado con letterboxing (board 300×600 + preview 120×120) sin deformarse y sin salirse. Verificar: en ventana estrecha se ven completos; el canvas interno sigue 300×600.
6. **Pulido.** Revisión final y verificación E2E contra los criterios (ver siguiente sección). `npx tsc --noEmit` y `npm run lint` en verde.

## Acceptance criteria

- [ ] `/games` muestra la card nueva "TETRIS" (PUZZLE, cover-tetro, magenta) sin alterar las demás.
- [ ] `/juego/tetris` renderiza el detalle y "JUGAR AHORA" navega a `/jugar/tetris`.
- [ ] `/jugar/tetris` monta el juego: tablero 10×20 y preview de la pieza siguiente; fondo CRT; nada en consola.
- [ ] ← → mueven la pieza; ↑/X rotan (con wall kicks); ↓ baja con soft drop (+1/fila); Espacio hace hard drop (+2/celda, llega hasta abajo).
- [ ] Al completar una línea se suma su puntuación (100/300/500/800 × nivel) y las líneas aparecen en el HUD (extra.lines).
- [ ] Cada 10 líneas sube de nivel; la velocidad de caída sigue `max(100, 1000-(level-1)*90)` ms.
- [ ] El HUD de React (GameShell) muestra Puntuación, Nivel y Líneas; **no** muestra Vidas.
- [ ] Llegar al techo termina la partida y abre el modal "FIN DEL JUEGO" de GameShell con la puntuación final.
- [ ] PAUSA congela y muestra "EN PAUSA" (GameShell); FIN termina; REANUDAR continúa.
- [ ] GUARDAR PUNTUACIÓN escribe en `av_scores` (sesión o `INVITADO`); JUGAR DE NUEVO reinicia (0, líneas 0, nivel 1); VOLVER AL VAULT navega a `/games`.
- [ ] El game over natural (no FIN) también abre el modal; guardar de identidad.
- [ ] Las flechas y Espacio no desplazan la página mientras se juega.
- [ ] Al desmontar (navegar fuera) se liberan el bucle y los listeners; no se acumulan al entrar/salir varias veces.
- [ ] Los dos canvases se ven completos y sin deformar dentro del CRT en ventana estrecha.
- [ ] `/jugar/asteroides` sigue total (sin regresión por el uso del contrato).
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** motor puro `lib/tetris.ts` contra `PlayableEngine` (SPEC 07). Coherente con Asteroids y con la tesis de la capa compartida.
- **Sí:** adapter `components/TetrisGame.tsx` con `useGameEngine` + `GameShell`. Reutiliza HUD/CRT/pausa/modal; no duplica chrome.
- **Sí:** ruta dedicada `/jugar/tetris` (segmento estático de `page.tsx`, prioridad sobre `/jugar/[id]`). Mismo patrón que SPEC 05.
- **Sí:** fila nueva `tetris` en `av_games` (decisión de Fase C, sobre reusar `caida`). Como Asteroids en SPEC 05: nueva ficha, relleno intacto.
- **Sí:** board 300×600 + preview 120×120 lado a lado dentro del 4/3 con letterboxing (decisión de Fase C).
- **Sí:** HUD sin Vidas, mostrando Líneas (decisión de Fase C). El snapshot conserva `lives:3` por el contrato, pero el tile no se pinta.
- **Sí:** retirar el theme toggle del original (Arcade Vault es dark-only) y `getComputedStyle` → color fijo. Preciso para un motor sin DOM.
- **Sí:** se conserva la octava pieza "N" (tuerca) del original — es cultura del juego, no un error.
- **No:** portar el resto de juegos, "hold", tabla local, sonido, móvil/táctil, gamepad, anti-cheat, validación en servidor. Van en specs propios.

## Risks

| Riesgo                                                                        | Mitigación                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Los dos canvases no caben/deforman dentro del CRT 4/3.                        | Layout con letterboxing del paso 5 (board + preview lado a lado); criterio de aceptación de ventana estrecha.    |
| El `getSnapshot()` reporta `lives` a 3 y el shell lo pinta igual que "Vidas". | El adapter omite el tile (decisión de Fase C); `extra.lines` es la fuente del HUD.                               |
| Doble montaje de `useEffect` (StrictMode) → bucles/listeners duplicados.      | Cleanup del hook (SPEC 07) cancela frame y quita listeners; criterio de aceptación de entrar/salir.              |
| Reusar `getGame('tetris')` exige la fila aplicada antes de la ruta.           | El paso 4 aplica la migración antes del paso 6 (verificación); `notFound()` da 404 hasta entonces, sin crashear. |
| El preview "N" no se dibuja / fuga de `lives` al snapshot.                    | `extras[0]` dibuja el preview cada frame; `getSnapshot` devuelve estado plano fiel al contrato.                  |
| Diferencias de timming vs el original (dt limitado a 50 ms en el host).       | Mismo host que Asteroids/Spec 07; el hueco es preexistente y afecta igual a todos los juegos.                    |

## What is **not** in this spec

- Portar el resto de juegos (cada uno en su spec).
- "Hold" de pieza, modos extra, tabla de récords local.
- Sonido, controles táctiles, gamepad.
- Cambios visuales al HUD/CRT/pausa/modal de SPEC 07.
- Puntuaciones en servidor, auth real, anti-cheat.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
