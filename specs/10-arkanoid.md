# SPEC 10 — Juego real de Arkanoid portado a Next.js (ARKANOID/arkanoid)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-10-13
> **Objective:** Portar `references/started-games/04-arkanoid/game.js` a un motor puro `lib/arkanoid.ts` y un adapter `components/ArkanoidGame.tsx` sobre la capa compartida (`GameShell` + `useGameEngine`), servido en la ruta dedicada `/jugar/arkanoid` con su fila en `av_games` y guardado de puntuación en `av_scores`.

## Por qué existe este spec

SPEC 05 portó Asteroids y SPEC 08 portó Tetris, ambos sobre el contrato compartido de SPEC 07 (`PlayableEngine` + `GameShell` + `useGameEngine`). SPEC 09 limpió el catálogo dejando solo juegos reales. Este spec añade el tercer juego real de la plataforma: Arkanoid. La decisión no obvia es aprovechar la inversión de SPEC 07: el motor no dibuja HUD ni overlays (viven en `GameShell`), el input llega por `input()` y `pointer()`, y el adapter solo compone `useGameEngine` + `GameShell` + dos canvases (spritesheet + sonidos) sin lógica de juego.

## Scope

**In:**

- Puerto de `04-arkanoid/game.js` → motor puro `lib/arkanoid.ts` (`class ArkanoidEngine`), sin DOM y sin React, contra el contrato `PlayableEngine` (SPEC 07):
  - Canvas lógico 800×600 (4:3); paddle 81×14 @ y=560, velocidad 400 px/s; bola 16×16, velocidad base (200, −300).
  - 5 niveles, 10×6 bloques (64×24), patrones idénticos al original (parrilla, pirámide, ajedrez, huecos, marco+cruz); colores por fila: red, yellow, cyan, magenta, hotpink, green, gray.
  - Multiplicadores de velocidad por nivel: 1.0, 1.1, 1.21, 1.33, 1.46.
  - 3 vidas; puntuación 10 pts/bloque; colisiones AABB bola-paddle, bola-paredes, bola-bloques.
  - Animación de explosión 4 frames/color, 150 ms (`EXPLOSION_FRAMES`, `EXPLOSION_DURATION` del spritesheet).
  - `gameState`: `'playing'` | `'paused'` | `'gameover'` | `'win'`. Victoria al completar nivel 5 → mapea a `over=true` (modal estándar "FIN DEL JUEGO" de `GameShell`).
  - `getSnapshot()` devuelve `GameSnapshot` compartido: `{ score, lives, level, over, extra: {} }` (sin campos extra; el HUD usa solo core).
  - **Se eliminan del motor**: `new Audio`/`cloneNode().play()` (sonidos), `loadSpritesheet`/`new Image` (assets), `document.getElementById`/`getContext`, listeners `window`/`canvas`, `drawOverlay`/`drawPauseOverlay` (HUD y overlays pasan a React).
  - Assets (spritesheet PNG, sonidos MP3) → `public/games/arkanoid/`; el adapter los carga y dispara sonidos via `Audio` al recibir eventos del motor.
- `components/ArkanoidGame.tsx` (`"use client"`), adapter sobre `useGameEngine` + `GameShell` (SPEC 07):
  - Un `<canvas>` 800×600 dentro del CRT 4/3; `pointer: true` en `useGameEngine` (ratón + teclado).
  - Carga spritesheet (`Image`) y sonidos (`Audio`) en `useEffect`; expone callbacks `onBounce`/`onBreak` que el motor invoca (patrón observer ligero) para que el adapter reproduzca audio.
  - HUD con `GameShell`: `stats = [ {key:'lives', label:'Vidas', value:lives, tone:'lives'}, {key:'level', label:'Nivel', value:level, tone:'level'} ]` — Score va en el tile core "Puntuación".
  - Controles: ← → / ratón mueven paddle; P / Escape pausa; `preventDefault` en teclas de juego.
- Ruta `app/jugar/arkanoid/page.tsx` (server, `export const instant = false;`, `getGame('arkanoid')` → `notFound()`).
- Fila nueva en el catálogo `av_games` (SPEC 06): `id: 'arkanoid'`, `title: 'ARKANOID'`, `cat: 'ARCADE'`, `cover: 'cover-arkanoid'`, `color: 'cyan'`, `sort: 10`.
- Migración `supabase/migrations/0004_av_game_arkanoid.sql` con el `INSERT` en `av_games` (aplicada a mano en el dashboard, sin CLI).
- Clase CSS `.cover-arkanoid` en `app/globals.css` (sprite paddle+bola del spritesheet o gradiente temático).
- Guardado de la puntuación final en `av_scores` vía `saveScore` (SPEC 06) con el nombre de la sesión o `INVITADO`.

**Out of scope (for future specs):**

- Portar el resto de juegos: cada uno en su spec con `/add-game`.
- Touch/móvil, gamepad, sonido avanzado (música, volumen), auth real, anti-cheat, validación en servidor.
- Cambios visuales al HUD/CRT/pausa/modal de SPEC 07.
- "Hold" de nivel, editor de niveles, power-ups (el original no los tiene).

## Data model

El motor (`lib/arkanoid.ts`) — estructuras y constantes clave, fieles al original:

```ts
const W = 800;
const H = 600;
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_COLORS = [
  'red',
  'yellow',
  'cyan',
  'magenta',
  'hotpink',
  'green',
  'gray',
];
const LEVEL_SPEEDS = [1.0, 1.1, 1.21, 1.33, 1.46];
const EXPLOSION_DURATION = 150;

// Estado interno (mutable, fuera de React)
type GameState = 'playing' | 'paused' | 'gameover' | 'win';

class ArkanoidEngine implements PlayableEngine {
  readonly width = W;
  readonly height = H;
  // campos: paddle, ball, blocks[], explosions[], lives, score, level, gameState, isPaused
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // solo acción; sin HUD/overlays
  input(code: string, down: boolean): void; // ArrowLeft, ArrowRight, KeyP, Escape
  pointer(p: PointerInput): void; // mousemove/mousedown/mouseup → paddle.x
  restart(): void; // → initPaddle + loadLevel(1)
  endGame(): void; // → gameState = 'gameover'
  getSnapshot(): GameSnapshot; // { score, lives, level, over, extra: {} }
  // callbacks opcionales para sonidos (adapter los vincula):
  onBounce?: () => void;
  onBreak?: () => void;
}
```

El `GameSnapshot` compartido (`lib/engine.ts`): `{ score, lives, level, over, extra?: Record<string, number> }`. Aquí `extra: {}` (vacío). Vidas se muestra en tile `.hud-stat.lives`, nivel en `.hud-stat.level`.

Ruta: `app/jugar/arkanoid/page.tsx` — análoga a `app/jugar/asteroides/page.tsx`:

```ts
export const instant = false;
export default async function ArkanoidPage() {
  const game = await getGame('arkanoid');
  if (!game) notFound();
  return <ArkanoidGame game={game} />;
}
```

Fila de catálogo (`0004_av_game_arkanoid.sql`):

```sql
insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'arkanoid', 'ARKANOID',
  'Rompe bloques con la bola y el paddle.',
  'Controla el paddle, devuelve la bola y destruye todos los bloques en 5 niveles de dificultad creciente. 3 vidas, sin power-ups, solo reflejos puros.',
  'ARCADE', 'cover-arkanoid', 'cyan', 10
);
```

## Implementation plan

1. **Motor.** Crear `lib/arkanoid.ts` portando `game.js` a una clase contra el contrato `PlayableEngine` (SPEC 07): estado, paddle, bola, bloques, explosiones, 5 niveles, colisiones, `getSnapshot()`. Eliminar todo DOM (`document`, `window`, `new Audio`, `new Image`, `getBoundingClientRect`). Añadir callbacks `onBounce`/`onBreak` para que el adapter reproduzca sonidos. Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el módulo importa sin efectos secundarios.
2. **Assets.** Copiar `assets/spritesheet-breakout.png` → `public/games/arkanoid/spritesheet.png`; `assets/sounds/ball-bounce.mp3` y `break-sound.mp3` → `public/games/arkanoid/`. Verificar: rutas accesibles desde el adapter.
3. **Adapter.** Crear `components/ArkanoidGame.tsx` con `useGameEngine` + `GameShell` (SPEC 07): `useRef` del canvas 800×600; `pointer: true`; `playCodes: ['ArrowLeft','ArrowRight','KeyP','Escape']`; en `useEffect` carga spritesheet (`Image`) y sonidos (`Audio`); vincula `engine.onBounce/onBreak` a `audio.play()`. `stats` = Vidas + Nivel. Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el componente renderiza sin errores en consola.
4. **Ruta.** Crear `app/jugar/arkanoid/page.tsx` (`export const instant = false;`, server, `getGame('arkanoid')` → `notFound()`). Verificar: `/jugar/arkanoid` carga el juego; `/jugar/asteroides`, `/jugar/tetris` y `/games` siguen sirviendo lo suyo; `npx tsc --noEmit` en verde.
5. **Catálogo.** Escribir `0004_av_game_arkanoid.sql`; aplicarlo en el SQL editor. Verificar: la card `ARKANOID` aparece en `/games` con su cover/color; `/juego/arkanoid` y "JUGAR AHORA" navegan a `/jugar/arkanoid`.
6. **CSS cover.** Añadir `.cover-arkanoid` en `app/globals.css` (usa el spritesheet o gradiente cyan). Verificar: card se ve correcta en `/games` y `/juego/arkanoid`.
7. **Pulido.** Ajustar el CSS del CRT 4/3 para que el canvas 800×600 quepa sin deformarse (`max-width: 100%`, `aspect-ratio: 4/3`, `image-rendering: pixelated`). Revisión final y verificación E2E contra los criterios. `npx tsc --noEmit` y `npm run lint` en verde.

## Acceptance criteria

- [ ] `/games` muestra la card nueva "ARKANOID" (ARCADE, cover-arkanoid, cyan) sin alterar las demás.
- [ ] `/juego/arkanoid` renderiza el detalle y "JUGAR AHORA" navega a `/jugar/arkanoid`.
- [ ] `/jugar/arkanoid` monta el juego: paddle, bola, bloques, explosiones; fondo CRT; nada en consola.
- [ ] ← / → y ratón mueven el paddle; P / Escape pausan y reanudan; `preventDefault` en teclas de juego.
- [ ] Bola rebota en paredes (izq/der/arriba), paddle y bloques; al romper bloque suena `break-sound` y aparece explosión 4 frames; al rebotar suena `ball-bounce`.
- [ ] Cada bloque = 10 pts; score sube en HUD (tile "Puntuación" core).
- [ ] 3 vidas al inicio; perder bola resta vida y reposiciona; 0 vidas → `over=true` → modal "FIN DEL JUEGO".
- [ ] Completar 5 niveles → `over=true` → modal "FIN DEL JUEGO" (mapeo de victoria).
- [ ] HUD React (`GameShell`) muestra Puntuación (core), Vidas (tone:lives), Nivel (tone:level).
- [ ] PAUSA congela y muestra "EN PAUSA" (GameShell); FIN termina; REANUDAR continúa.
- [ ] GUARDAR PUNTUACIÓN escribe en `av_scores` (sesión o `INVITADO`); JUGAR DE NUEVO reinicia (score 0, vidas 3, nivel 1); VOLVER AL VAULT navega a `/games`.
- [ ] El game over natural (sin vidas) también abre el modal; guardar de identidad.
- [ ] Las flechas, P, Escape no desplazan la página mientras se juega.
- [ ] Al desmontar (navegar fuera) se liberan el bucle y los listeners; no se acumulan al entrar/salir varias veces.
- [ ] El canvas 800×600 se ve completo y sin deformar dentro del CRT en ventana estrecha.
- [ ] `/jugar/asteroides` y `/jugar/tetris` sin regresión (jugar, pausar, fin, guardar, reiniciar).
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** motor puro `lib/arkanoid.ts` contra `PlayableEngine` (SPEC 07). Coherente con Asteroids y Tetris; demuestra la tesis de la capa compartida.
- **Sí:** adapter `components/ArkanoidGame.tsx` con `useGameEngine` + `GameShell`. Reutiliza HUD/CRT/pausa/modal; no duplica chrome.
- **Sí:** ruta dedicada `/jugar/arkanoid` (segmento estático de `page.tsx`, prioridad sobre `/jugar/[id]`). Mismo patrón que SPEC 05/08.
- **Sí:** fila nueva `arkanoid` en `av_games` (decisión Fase C, sobre reusar `caida`/`bloque-buster`). Como Asteroids/Tetris: nueva ficha, relleno intacto (ahora ya borrado en SPEC 09).
- **Sí:** ARCADE / cyan / cover-arkanoid (nueva). ARCADE encaja (rompe bloques clásico); cyan libre; cover nueva.
- **Sí:** `pointer: true` en `useGameEngine` (ratón + teclado). El original usa ambos; el contrato lo soporta nativamente.
- **Sí:** sonidos vía adapter (callbacks `onBounce`/`onBreak` → `Audio.play()`). El motor no toca `new Audio`; autoplay se desbloquea tras primer gesto de usuario (clic en canvas o tecla).
- **Sí:** victoria (nivel 5 completado) → `over=true` → modal estándar "FIN DEL JUEGO". No extender `GameShell` para mensaje distinto.
- **Sí:** `extra: {}` en snapshot; HUD usa solo campos core + `lives`/`level` tiles.
- **Sí:** assets en `public/games/arkanoid/` (patrón de SPEC 05/08 para assets estáticos).
- **No:** selector de nivel en el overlay de pausa del original (botones 1–5). El overlay React compartido no lo tiene; se descarta por coherencia UX.
- **No:** power-ups, touch, gamepad, auth real, anti-cheat, validación servidor. Van en specs propios.

## Risks

| Riesgo                                                                                                            | Mitigación                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| El canvas 800×600 no cabe/deforma dentro del CRT 4/3 en móviles.                                                  | CSS `max-width: 100%`, `aspect-ratio: 4/3`, `image-rendering: pixelated`; criterio de aceptación de ventana estrecha.           |
| Los sonidos no suenan por política de autoplay.                                                                   | El adapter crea `Audio` en `useEffect` (gesto de usuario previo: clic en JUGAR AHORA o tecla); `onBounce/onBreak` clona y play. |
| `getSnapshot()` reporta `lives` y el shell lo pinta; Tetris fijó `lives:3` y omitió el tile.                      | Arkanoid **sí** usa vidas (3 reales); el tile `.hud-stat.lives` se muestra (decisión Fase C).                                   |
| Doble montaje de `useEffect` (StrictMode) → bucles/listeners duplicados.                                          | Cleanup del hook (SPEC 07) cancela frame y quita listeners; criterio de aceptación de entrar/salir.                             |
| `loadSpritesheet` original usa callback; el adapter debe esperar a que la `Image` cargue antes de crear el motor. | `useEffect` carga `Image`; `onload` → `createEngine()`; mientras tanto no se renderiza canvas (o muestra "CARGANDO").           |
| Reusar `getGame('arkanoid')` exige la fila aplicada antes de la ruta.                                             | El paso 5 aplica la migración antes del paso 7 (verificación); `notFound()` da 404 hasta entonces, sin crashear.                |

## What is **not** in this spec

- Portar `04-arkanoid` ni el resto de juegos (cada uno en su spec con `/add-game`).
- Selector de nivel en pausa (botones 1–5 del original).
- Power-ups, multibola, paddle expand/shrink, ladrillos indestructibles.
- Sonido de fondo / música, controles táctiles, gamepad.
- Cambios visuales al HUD/CRT/pausa/modal de SPEC 07.
- Puntuaciones en servidor, auth real, anti-cheat.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
