# 02-asteroids — already ported (reference)

Status: **ported** by SPEC 05 (`specs/05-asteroides.md`). Do **not** port it
again. It is the reference implementation of the shared contract and of the
DOM-decoupling surgery in `porting-guide.md`.

## Source

- `references/started-games/02-asteroids/index.html` — canvas `#canvas`, 800×600.
- `references/started-games/02-asteroids/game.js` — ~511 lines, `'use strict'`,
  ES6 classes, keyboard only, no assets, no audio.

## Ported artifacts

- Engine: `lib/asteroids.ts` — `class AsteroidsEngine` (`input`, `restart`,
  `endGame`, `update`, `draw`, `getSnapshot`). Constants `W=800`, `H=600`,
  `RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`.
- Shell: `components/AsteroidsGame.tsx` — canvas + rAF loop + keyboard listeners.
- Route: `app/jugar/asteroides/page.tsx`.
- Catalog row: `asteroides` (SHOOTER, `cover-rocas`, yellow, sort 6) added by
  SPEC 05 alongside the pre-existing `rocas` display row.

## Key facts (for the contract)

- Toroidal wrap (`wrap(v, max)`); `dt` capped at 50 ms.
- Asteroid sizes 1/2/3 → `POINTS = [0, 100, 50, 20]`; large splits into two
  smaller; size 1 does not split.
- 3 lives, 3 s spawn invincibility (blink), 2 s death pause.
- Power-up "3x" (triple shot, 5 s) with a drop chance + guaranteed every 5 kills.
- Snapshot: `{ score, lives, level, over, extra: { tripleShot } }`.
- Controls: ← → rotate, ↑ thrust, Space shoot (`preventDefault` on all four).

This file is the canonical before/after used in `porting-guide.md`.
