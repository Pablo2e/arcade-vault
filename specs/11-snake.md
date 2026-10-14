# SPEC 11 — Juego real de Snake portado a Next.js (SNAKE/snake)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 10
> **Date:** 2026-10-14
> **Objective:** Portar el juego Snake (assets en `references/source-assets/snake-assets/`) a un motor puro `lib/snake.ts` y un adapter `components/SnakeGame.tsx` sobre la capa compartida (`GameShell` + `useGameEngine`), servido en la ruta dedicada `/jugar/snake` con su fila en `av_games` y guardado de puntuación en `av_scores`.

## Por qué existe este spec

SPEC 05 portó Asteroids, SPEC 08 portó Tetris y SPEC 10 portó Arkanoid, todos sobre el contrato compartido de SPEC 07 (`PlayableEngine` + `GameShell` + `useGameEngine`). SPEC 09 limpió el catálogo dejando solo juegos reales. Este spec añade el cuarto juego real de la plataforma: Snake. El juego usa un spritesheet de frutas (`fruits.png` + `sprites.js` desde Google Snake) y sigue el patrón clásico de 3 vidas, crecimiento al comer y game over al chocar. La decisión no obvia es aprovechar la inversión de SPEC 07: el motor no dibuja HUD ni overlays (viven en `GameShell`), el input llega por `input()`, y el adapter solo compone `useGameEngine` + `GameShell` + un canvas 4:3 sin lógica de juego.

## Scope

**In:**

- Puerto del juego Snake → motor puro `lib/snake.ts` (`class SnakeEngine`), sin DOM y sin React, contra el contrato `PlayableEngine` (SPEC 07):
  - Canvas lógico 800×600 (4:3); serpiente inicia en el centro, dirección inicial derecha; 3 vidas.
  - Grilla interna (p. ej. 40×30 celdas de 20 px); frutas aparecen en celdas libres aleatorias.
  - Frutas del spritesheet (`fruits.png` + coordenadas `SPRITES_ATLAS.fruits.*`): 24 variedades, una al azar por spawn; cada fruta tiene su puntuación base (p. ej. manzana=10, banana=20, sandía=50, etc. — tabla por definir fiel al original).
  - Comer fruta → crece 1 segmento + suma puntos; nueva fruta spawnea.
  - Chocar con pared o consigo mismo → pierde vida, reposiciona al centro, dirección derecha; 0 vidas → `over=true`.
  - `getSnapshot()` devuelve `GameSnapshot` compartido: `{ score, lives, level: 1, over, extra: { length } }` (longitud actual en `extra.length` para HUD opcional).
  - **Se eliminan del motor**: cualquier `document.getElementById`, `getContext`, listeners `window`, `new Audio`, `new Image`, dibujo de HUD/overlay dentro del canvas.
- `components/SnakeGame.tsx` (`"use client"`), adapter sobre `useGameEngine` + `GameShell` (SPEC 07):
  - Un `<canvas>` 800×600 dentro del CRT 4/3; `playCodes: ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyP','Escape']`; `pointer: false` (solo teclado).
  - Carga `fruits.png` (`Image`) en `useEffect`; el motor recibe la imagen cargada vía propiedad o callback de inicialización.
  - HUD con `GameShell`: `stats = [ {key:'lives', label:'Vidas', value:lives, tone:'lives'}, {key:'length', label:'Longitud', value:length, tone:'default'} ]` — Score va en el tile core "Puntuación".
  - Controles: ↑ ↓ ← → cambian dirección (no 180°); Space acelera (opcional); P / Escape pausa; `preventDefault` en teclas de juego.
- Ruta `app/jugar/snake/page.tsx` (server, `export const instant = false;`, `getGame('snake')` → `notFound()`).
- Fila nueva en el catálogo `av_games` (SPEC 06): `id: 'snake'`, `title: 'SNAKE'`, `cat: 'PUZZLE'`, `cover: 'cover-snake-sprite'`, `color: 'green'`, `sort: 11`.
- Migración `supabase/migrations/0005_av_game_snake.sql` con el `INSERT` en `av_games` (aplicada a mano en el dashboard, sin CLI).
- Clase CSS `.cover-snake` en `app/globals.css` (usa el spritesheet `fruits.png` o gradiente temático verde).
- Guardado de la puntuación final en `av_scores` vía `saveScore` (SPEC 06) con el nombre de la sesión o `INVITADO`.

**Out of scope (for future specs):**

- Portar el resto de juegos: cada uno en su spec con `/add-game`.
- Power-ups, obstáculos, modo multijugador, sonido, móvil/táctil, gamepad.
- Cambios visuales al HUD/CRT/pausa/modal de SPEC 07.
- Auth real, anti-cheat, validación en servidor.

## Data model

El motor (`lib/snake.ts`) — estructuras y constantes clave:

```ts
const W = 800;
const H = 600;
const CELL = 20; // px por celda
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30
const INITIAL_LENGTH = 4; // segmentos iniciales
const INITIAL_LIVES = 3;
const MOVE_INTERVAL = 100; // ms entre pasos (10 Hz base)

// Puntuación base por fruta (índice en el array de frutas del spritesheet)
const FRUIT_SCORES: Record<string, number> = {
  banana: 20,
  orange: 30,
  grape: 25,
  garlic: 15,
  eggplant: 35,
  strawberry: 40,
  cherry: 15,
  carrot: 25,
  mushroom: 30,
  broccoli: 20,
  watermelon: 50,
  pepper: 30,
  kiwi: 25,
  lemon: 20,
  peach: 35,
  peanut: 15,
  apple: 10,
  tomato: 30,
  berries: 40,
  grapes2: 25,
  pineapple: 50,
  melon: 45,
};

type FruitKey = keyof typeof FRUIT_SCORES;

type GameState = 'playing' | 'paused' | 'gameover';

class SnakeEngine implements PlayableEngine {
  readonly width = W;
  readonly height = H;
  // campos: snake: {x,y}[], direction, nextDirection, fruit: {x,y,type}, fruitImg: HTMLImageElement | null,
  //         lives, score, state, moveTimer, spriteAtlas
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // solo acción; sin HUD/overlays
  input(code: string, down: boolean): void; // ArrowUp/Down/Left/Right, Space, KeyP, Escape
  restart(): void; // → initSnake + spawnFruit + state='playing'
  endGame(): void; // → state='gameover'
  getSnapshot(): GameSnapshot; // { score, lives, level:1, over, extra:{ length } }
  setFruitImage(img: HTMLImageElement): void; // adapter inyecta la imagen cargada
}
```

El `GameSnapshot` compartido (`lib/engine.ts`): `{ score, lives, level, over, extra?: Record<string, number> }`. Aquí `extra: { length }` (longitud actual de la serpiente). Vidas se muestra en tile `.hud-stat.lives`, longitud en `.hud-stat` normal.

Ruta: `app/jugar/snake/page.tsx` — análoga a `app/jugar/asteroides/page.tsx`:

```ts
export const instant = false;
export default async function SnakePage() {
  const game = await getGame('snake');
  if (!game) notFound();
  return <SnakeGame game={game} />;
}
```

Fila de catálogo (`0005_av_game_snake.sql`):

```sql
insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'snake', 'SNAKE',
  'Clásico come-frutas',
  'Controla la serpiente, come frutas y crece sin chocar. Frutas del spritesheet Google Snake. 3 vidas, score por fruta.',
  'PUZZLE', 'cover-snake', 'green', 11
);
```

## Implementation plan

1. **Motor.** Crear `lib/snake.ts` portando la lógica a una clase contra el contrato `PlayableEngine` (SPEC 07): estado, serpiente (array de celdas), dirección, fruta aleatoria con tipo y puntuación, colisiones, vidas, `getSnapshot()`. Eliminar todo DOM (`document`, `window`, `new Audio`, `new Image`, listeners). Añadir `setFruitImage(img)` para inyectar el spritesheet cargado por el adapter. Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el módulo importa sin efectos secundarios.
2. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` → `public/games/snake/fruits.png`. Verificar: ruta accesible desde el adapter.
3. **Adapter.** Crear `components/SnakeGame.tsx` con `useGameEngine` + `GameShell` (SPEC 07): `useRef` del canvas 800×600; `playCodes` con flechas/Space/P/Escape; en `useEffect` carga `fruits.png` (`Image`); `onload` → `engine.setFruitImage(img)` + crea motor. `stats` = Vidas (tone:lives) + Longitud (tone:default). Verificar: `npx tsc --noEmit`, `npm run lint` en verde; el componente renderiza sin errores en consola.
4. **Ruta.** Crear `app/jugar/snake/page.tsx` (`export const instant = false;`, server, `getGame('snake')` → `notFound()`). Verificar: `/jugar/snake` carga el juego; `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/games` siguen sirviendo lo suyo; `npx tsc --noEmit` en verde.
5. **Catálogo.** Escribir `0005_av_game_snake.sql`; aplicarlo en el SQL editor. Verificar: la card `SNAKE` aparece en `/games` con su cover/color; `/juego/snake` y "JUGAR AHORA" navegan a `/jugar/snake`.
6. **CSS cover.** Añadir `.cover-snake` en `app/globals.css` (usa `fruits.png` como background o gradiente verde). Verificar: card se ve correcta en `/games` y `/juego/snake`.
7. **Pulido.** Ajustar el CSS del CRT 4/3 para que el canvas 800×600 quepa sin deformarse (`max-width: 100%`, `aspect-ratio: 4/3`, `image-rendering: pixelated`). Revisión final y verificación E2E contra los criterios. `npx tsc --noEmit` y `npm run lint` en verde.

## Acceptance criteria

- [x] `/games` muestra la card nueva "SNAKE" (PUZZLE, cover-snake, green) sin alterar las demás.
- [x] `/juego/snake` renderiza el detalle y "JUGAR AHORA" navega a `/jugar/snake`.
- [x] `/jugar/snake` monta el juego: serpiente, fruta con sprite del spritesheet, fondo CRT; nada en consola.
- [x] ↑ ↓ ← → cambian dirección (no permite giro 180°); Space acelera (opcional); P / Escape pausan y reanudan; `preventDefault` en teclas de juego.
- [x] Comer fruta suma su puntuación, crece 1 segmento y spawnea nueva fruta aleatoria.
- [x] Chocar con pared o consigo mismo resta vida y reposiciona al centro; 0 vidas → `over=true` → modal "FIN DEL JUEGO".
- [x] HUD React (`GameShell`) muestra Puntuación (core), Vidas (tone:lives), Longitud (tone:default).
- [x] PAUSA congela y muestra "EN PAUSA" (GameShell); FIN termina; REANUDAR continúa.
- [x] GUARDAR PUNTUACIÓN escribe en `av_scores` (sesión o `INVITADO`); JUGAR DE NUEVO reinicia (score 0, vidas 3, longitud 4); VOLVER AL VAULT navega a `/games`.
- [x] El game over natural (sin vidas) también abre el modal; guardar de identidad.
- [x] Las flechas, Space, P, Escape no desplazan la página mientras se juega.
- [x] Al desmontar (navegar fuera) se liberan el bucle y los listeners; no se acumulan al entrar/salir varias veces.
- [x] El canvas 800×600 se ve completo y sin deformar dentro del CRT en ventana estrecha.
- [x] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` sin regresión (jugar, pausar, fin, guardar, reiniciar).
- [x] `npx tsc --noEmit` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** motor puro `lib/snake.ts` contra `PlayableEngine` (SPEC 07). Coherente con Asteroids, Tetris y Arkanoid; demuestra la tesis de la capa compartida.
- **Sí:** adapter `components/SnakeGame.tsx` con `useGameEngine` + `GameShell`. Reutiliza HUD/CRT/pausa/modal; no duplica chrome.
- **Sí:** ruta dedicada `/jugar/snake` (segmento estático de `page.tsx`, prioridad sobre `/jugar/[id]`). Mismo patrón que SPEC 05/08/10.
- **Sí:** fila nueva `snake` en `av_games` (decisión Fase C, patrón SPEC 05/08/10: añadir nueva, no reusar `caida`/`bloque-buster`).
- **Sí:** PUZZLE / green / cover-snake (nueva) / sort 11. PUZZLE encaja (clásico come-frutas); green libre; cover nueva usando el spritesheet.
- **Sí:** solo teclado (`pointer: false`). El Snake clásico no usa ratón.
- **Sí:** 3 vidas, reposiciona al centro tras chocar, fruta aleatoria del spritesheet con puntuación variable. Fiel al espíritu del original Google Snake.
- **Sí:** assets en `public/games/snake/` (patrón de SPEC 05/08/10 para assets estáticos).
- **Sí:** `extra: { length }` en snapshot para mostrar longitud en HUD; `level` fijo a 1 (Snake no tiene niveles).
- **No:** power-ups, obstáculos, modo multijugador, sonido, touch, gamepad, auth real, anti-cheat, validación servidor. Van en specs propios.
- **No:** selector de velocidad, "hold", tabla de récords local.

## Risks

| Riesgo                                                                      | Mitigación                                                                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| El canvas 800×600 no cabe/deforma dentro del CRT 4/3 en móviles.            | CSS `max-width: 100%`, `aspect-ratio: 4/3`, `image-rendering: pixelated`; criterio de aceptación de ventana estrecha.        |
| El spritesheet `fruits.png` no carga a tiempo para el primer frame.         | Adapter espera `onload` antes de crear el motor o pasa la imagen; mientras tanto no renderiza canvas (o muestra "CARGANDO"). |
| Doble montaje de `useEffect` (StrictMode) → bucles/listeners duplicados.    | Cleanup del hook (SPEC 07) cancela frame y quita listeners; criterio de aceptación de entrar/salir.                          |
| `getSnapshot()` reporta `lives` y el shell lo pinta; Tetris omitió el tile. | Snake **sí** usa vidas (3 reales); el tile `.hud-stat.lives` se muestra (decisión Fase C).                                   |
| Recorte de sprites incorrecto (coordenadas `sprites.js`).                   | Usar las coordenadas exactas de `window.SPRITE_ATLAS.fruits`; test visual de cada fruta al spawnear.                         |
| Reusar `getGame('snake')` exige la fila aplicada antes de la ruta.          | El paso 5 aplica la migración antes del paso 7 (verificación); `notFound()` da 404 hasta entonces, sin crashear.             |

## What is **not** in this spec

- Portar el resto de juegos (cada uno en su spec con `/add-game`).
- Power-ups, obstáculos, modo multijugador, niveles progresivos.
- Sonido, controles táctiles, gamepad.
- Cambios visuales al HUD/CRT/pausa/modal de SPEC 07.
- Puntuaciones en servidor, auth real, anti-cheat.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
