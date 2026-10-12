# 04-arkanoid — reconnaissance notes

Reference: `references/started-games/04-arkanoid/`. Vanilla, no build. Files:
`index.html`, `game.js` (~268 lines, procedural globals), `levels.js`,
`assets/spritesheet.js`, `assets/spritesheet-breakout.png` (~30 KB),
`assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3`.

## Shape

- **One canvas**, `#game`, 800×600.
- **Pointer + keyboard.** `mousemove` on the canvas moves the paddle (scaled by
  `canvas.width / rect.width`); `click` only served the in-canvas pause menu;
  `ArrowLeft`/`ArrowRight` also move it; `P`/`P`/`Escape` toggle pause.
- **Asset-gated bootstrap**: `loadSpritesheet(() => { initPaddle(); loadLevel(1);
requestAnimationFrame(loop); })` — the game only starts after the PNG loads.

## Cultural constants (preserve verbatim)

- `PADDLE_SPEED=400`; paddle `81×14` at `y=560`; ball `16×16`.
- `BLOCK_COLS=10`, `BLOCK_ROWS=6`, `BLOCK_W=64`, `BLOCK_H=24`; origin
  `x=(800−640)/2=80`, `y=80`.
- Block colors: `red, yellow, cyan, magenta, hotpink, green` (level 2 also uses
  `gray`).
- `BASE_BALL_VX=200`, `BASE_BALL_VY=−300`, scaled per level by `LEVELS[n].speed`.
- Lives 3; ball lost below the canvas decrements and re-inits (no level reset).
- Scoring: **+10 per block**; one block per frame; clearing all blocks → next
  level, after level 5 → `gameState = 'win'`.
- `levels.js` `LEVELS` (5 levels, speeds `1.00/1.10/1.21/1.33/1.46`): L1 full
  grid, L2 centered pyramid, L3 checkerboard, L4 rows with gaps, L5 frame+cross.

## DOM calls inside the logic (port actions)

- **Audio**: `new Audio('assets/sounds/…')` + `cloneNode().play()` on bounce and
  break. Keep audio **out of the engine** — inject an adapter or emit sound
  events the component plays. **Autoplay**: only `.play()` after the first user
  gesture (unlock on the first `keydown`/`mousedown`).
- **Assets**: `loadSpritesheet(cb)` + `Image` + `drawSprite`/`drawFrame`. Copy
  the PNG (and sounds) to `public/games/arkanoid/` and reference absolute URLs;
  the engine is created only after the image loads.
- **Pointer**: canvas `mousemove` → `engine.pointer({ x, y, kind })` via
  `useGameEngine({ pointer: true })`; the engine moves + clamps the paddle. The
  `click` handler (pause menu level-select) is dropped for the shared React
  overlay.
- **HUD** (score/level/lives drawn on canvas) + `drawOverlay`/`drawPauseOverlay`
  → React HUD + `GameShell`.
- **`gameState` `'win'`** ("¡Completaste el juego!") → decide a modal variant or
  map it to the plain FIN DEL JUEGO.

## Assets

| File                              | Destination                             | Use                                              |
| --------------------------------- | --------------------------------------- | ------------------------------------------------ |
| `assets/spritesheet-breakout.png` | `public/games/arkanoid/spritesheet.png` | paddle, ball, 7 block colors, 4-frame explosions |
| `assets/sounds/ball-bounce.mp3`   | `public/games/arkanoid/ball-bounce.mp3` | wall/paddle hit                                  |
| `assets/sounds/break-sound.mp3`   | `public/games/arkanoid/break-sound.mp3` | block break                                      |

`spritesheet.js` exposes `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`
(~150 ms) — read them to write `lib/arkanoid-sprites.ts` (or inline).

## Snapshot mapping

`{ score, lives, level, over }` — no `extra` needed. `over` is true for both
`gameover` and (if kept) `win`.

## Suggested catalog values (Phase C decides)

`id: "arkanoid"` (new row), `cat: ARCADE`, `cover: cover-bricks` (reuse),
`color: cyan`, `sort: 9`. The display row `bloque-buster` (ARCADE,
`cover-bricks`, sort 0) already exists — recommend leaving it.
