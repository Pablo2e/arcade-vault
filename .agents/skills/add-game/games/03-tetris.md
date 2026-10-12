# 03-tetris — reconnaissance notes

Reference: `references/started-games/03-tetris/`. Vanilla, no build, no assets.
Files: `index.html`, `style.css` (~4.6 KB), `game.js` (~330 lines, `'use strict'`,
functions — no classes).

## Shape

- **Two canvases.** `#board` **300×600** (playfield, **1:2 portrait, not 4:3**)
  and `#next-canvas` **120×120** (next-piece preview). The second canvas is the
  reason `useGameEngine` takes `extraCanvases`.
- **DOM HUD**: `#score`, `#lines`, `#level`; shared overlay `#overlay`
  (`#overlay-title`, `#overlay-score`) for both PAUSE and GAME OVER;
  `#restart-btn`.
- **Keyboard only.** `ArrowLeft`/`ArrowRight` move, `ArrowUp`/`KeyX` rotate,
  `ArrowDown` soft drop, `Space` hard drop (`preventDefault`), `KeyP` pause.

## Cultural constants (preserve verbatim)

- `COLS=10`, `ROWS=20`, `BLOCK=30`.
- `COLORS[1..8]`: I cyan, O yellow, T purple, S green, Z red, J pale blue,
  L orange, **N gray "tuerca"** (a custom 8th piece — the README/docs say 7).
- `PIECES[1..8]`; `LINE_SCORES = [0, 100, 300, 500, 800]` × level.
- level = `floor(lines/10) + 1`; `dropInterval = max(100, 1000 − (level−1)·90)` ms.
- Ghost piece at `globalAlpha = 0.2`; hard drop +2/cell, soft drop +1/row.
- Rotation = transpose + reverse, with wall kicks `[0, −1, 1, −2, 2]`.

## DOM calls inside the logic (port actions)

- **`drawGrid()` calls `getComputedStyle(document.body).getPropertyValue('--grid-line')`
  inside `draw`** — replace with a constant color.
- HUD `#score`/`#lines`/`#level` writes → React HUD (`stats`: LÍNEAS via
  `extra.lines`, NIVEL). Score via the core `score` field.
- **Theme toggle** (`#theme-toggle`, `localStorage['tetris-theme']`,
  `body.light-mode`) → recommend dropping (Arcade Vault is dark-only).
- `#restart-btn` click → shell JUGAR DE NUEVO (`restart()`).
- `endGame()` currently cancels the RAF and edits the overlay → becomes the
  engine's `endGame()` (sets state); the shell shows the modal.

## Snapshot mapping

`{ score, lives, level, over, extra: { lines } }`. Lives is not a Tetris concept
— show it as a fixed 3 or drop the tile; decide in Phase C. The next-piece
matrix is **drawn every frame on `extras[0]`**, never stored in state.

## Layout risk

`#board` is 1:2; the CRT screen is `aspect-ratio: 4/3`. Decide a layout: board +
preview side by side with letterboxing, or move the preview into the React HUD.

## Suggested catalog values (Phase C decides)

`id: "tetris"` (new row, like SPEC 05's `asteroides`), `cat: PUZZLE`,
`cover: cover-tetro` (reuse), `color: magenta`, `sort: 9`. The display row
`caida` (PUZZLE, `cover-tetro`, sort 1) already exists — recommend leaving it.
