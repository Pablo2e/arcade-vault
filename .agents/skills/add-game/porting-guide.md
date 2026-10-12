# Porting a reference game to a pure engine

The reference games under `references/started-games/` are vanilla HTML5 canvas +
JS: one or more global `document.getElementById` lookups, module-scope mutable
state, `window`/`document` listeners, a `requestAnimationFrame` loop, and (often)
HUD/overlay drawing inside the canvas. The port turns each into a **pure
TypeScript engine** that the React shell drives.

This guide is derived by diffing `references/started-games/02-asteroids/game.js`
against the finished `lib/asteroids.ts`. Apply the same three steps to any game.

## The three steps

### Step 1 — Extract state and classes into an engine; delete the bootstrap

In the reference, the game is module-scope globals plus free functions:

```js
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let ship, bullets, asteroids, score, lives, level, state, deadTimer;
function spawnAsteroids(count) { … }
function initGame() { … }
// …
initGame();
requestAnimationFrame(loop);
```

Port:

- Delete the `getElementById`/`getContext` lines; export the logical `width`/
  `height` as constants (e.g. `export const W = 800; export const H = 600;`).
- Move the mutable globals into a `class <Game>Engine` as fields.
- Turn the free functions into **private methods** (`spawnAsteroids`, `initGame`,
  `nextLevel`, `explode`, `killShip`…).
- Delete the bottom bootstrap (`initGame(); requestAnimationFrame(loop);`); the
  constructor calls `initGame()` and exposes `restart()` (→ `initGame()`) and
  `endGame()`.

### Step 2 — Thread the context through `draw`; replace HUD/overlay with a snapshot

Every entity's `draw()` that read the module `ctx` becomes
`draw(ctx: CanvasRenderingContext2D)`. The engine's own `draw(ctx)` renders
**only the action**:

```ts
draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // …entities…
}
```

Delete `drawHUD()` and `drawOverlay()` from the engine. Their job moves to React:
the HUD is the `GameShell`'s `stats`, the pause overlay and the game-over modal
are `GameShell`'s, and the engine reports state through `getSnapshot()`.

### Step 3 — Replace input globals with the injected input API; expose controls

Delete `keys`/`justPressed`, the `window.addEventListener('keydown'/'keyup')`
calls, and any `pressed()` helper that read them. Add:

```ts
input(code: string, down: boolean) {
  if (down && !this.held.has(code)) this.justPressed.add(code);
  if (down) this.held.add(code);
  else this.held.delete(code);
}
private pressed(code: string) { return this.justPressed.delete(code); }
private held = new Set<string>();
private justPressed = new Set<string>();
```

The frame reads `this.held` (e.g. `ship.update(dt, this.held)`); one-shot keys
(e.g. `Space`) consume through `pressed('Space')`. Delete any `if (pressed('Space'))
initGame()` from the gameover branch — restart is the shell's job via `restart()`.

## Reference: the Asteroids surgery, before → after

| Reference (`game.js`)                                  | Port (`lib/asteroids.ts`)                 |
| ------------------------------------------------------ | ----------------------------------------- |
| `let score, lives, level, state, …` globals            | `AsteroidsEngine` fields                  |
| `function initGame() {…}`                              | private `initGame()` + public `restart()` |
| `function loop(ts) { … requestAnimationFrame(loop); }` | gone — the host hook owns the loop        |
| `ctx` module global                                    | `draw(ctx)` parameter                     |
| `drawHUD()`, `drawOverlay()`                           | `getSnapshot()` → React HUD/modal         |
| `keys`/`justPressed` + `window` listeners              | `input(code, down)`                       |
| `if (pressed('Space')) initGame()` (gameover)          | `restart()` / `endGame()` publics         |

`getSnapshot()` returns the snapshot shape from `engine-contract.md` (flat
primitives in `extra`). Asteroids maps its `tripleShot` seconds into `extra`.

## Per-game port actions to flag during reconnaissance

Each of these is a DOM dependency inside the game logic that must be removed or
moved to the component:

### 03-tetris

- `drawGrid()` calls `getComputedStyle(document.body).getPropertyValue('--grid-line')`
  — **inside `draw`**. Replace with a constant color.
- DOM HUD `#score`/`#lines`/`#level` and the shared `#overlay` → React HUD +
  `GameShell` overlay/modal.
- Theme toggle (`#theme-toggle`, `localStorage['tetris-theme']`, `body.light-mode`)
  → recommend dropping (Arcade Vault is dark-only).
- Two canvases (`#board` 300×600, `#next-canvas` 120×120) → `extraCanvases`; the
  `#board` is 1:2, not 4:3 (see the CRT layout risk).
- `#restart-btn` click listener → the shell's JUGAR DE NUEVO (`restart()`).

### 04-arkanoid

- `new Audio('assets/sounds/…')` + `cloneNode().play()` → keep audio out of the
  engine; inject an audio adapter or emit sound events the component plays.
  **Autoplay** only unlocks after the first user gesture.
- `loadSpritesheet(cb)` bootstrap (asset-gated) → create the engine only after
  the image loads; assets move to `public/games/arkanoid/`.
- `canvas.addEventListener('mousemove'/'click')` → `pointer()` through the hook;
  the `click` handler only served the in-canvas pause/level-select menu, which
  the shared React overlay replaces.
- Canvas-drawn HUD (score, level, lives) and `drawOverlay`/`drawPauseOverlay` →
  React HUD + `GameShell`.
- `gameState` includes `'win'` ("¡Completaste el juego!") → decide a modal variant
  or map it to the plain FIN DEL JUEGO.
- `levels.js` (`LEVELS`, 5 levels) → `lib/arkanoid-levels.ts` (or inline).

## Conversion checklist

- [ ] No `document.` / `window.` / `getComputedStyle` / `new Audio` / `new Image`
      left inside the engine module.
- [ ] The engine imports no React and has no side effects on import.
- [ ] `draw(ctx, extras?)` renders only the action; the HUD is in React.
- [ ] Input arrives solely through `input(code, down)` (and `pointer` if used).
- [ ] `restart()` and `endGame()` are public and drive the shell.
- [ ] Cultural constants preserved verbatim (scoring tables, level formulas,
      piece sets, ball speeds).
- [ ] `npx tsc --noEmit` and `npm run lint` are green.
