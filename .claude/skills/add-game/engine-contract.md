# The shared game contract

This is the target shape every game in Arcade Vault conforms to. It was
extracted from the port in SPEC 05 (`lib/asteroids.ts` + `components/
AsteroidsGame.tsx`) and formalized so a second and third game can reuse the
chrome instead of copy-pasting it. Three files make up the contract: the pure
interface (`lib/engine.ts`), the React host hook (`lib/useGameEngine.ts`), and
the presentational shell (`components/GameShell.tsx`).

## The seam

```
   reference game.js  ──porting-guide──▶  lib/<id>.ts          (pure engine)
                                                │  implements
                                                ▼
   components/<Game>.tsx  ──useGameEngine──▶  PlayableEngine
                          ──GameShell──────▶  chrome (HUD/CRT/pausa/modal)
```

The engine never touches the DOM. The component never contains game logic. The
shell never knows which game it is rendering.

## `lib/engine.ts` — the interface

```ts
export type HudStat = {
  key: string;
  label: string; // "Vidas", "Nivel", "Líneas"…
  value: string; // pre-formatted for display
  tone?: 'default' | 'lives' | 'level'; // maps to .hud-stat[.lives|.level]
};

export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  over: boolean;
  extra?: Record<string, number>; // flat primitives only — see rules below
};

export type PointerInput = {
  x: number;
  y: number;
  kind: 'move' | 'down' | 'up';
};

export interface PlayableEngine<S extends GameSnapshot = GameSnapshot> {
  readonly width: number; // logical canvas width  (e.g. 800, 300)
  readonly height: number; // logical canvas height (e.g. 600)
  update(dt: number): void; // dt in seconds; the host clamps to 50 ms
  draw(
    ctx: CanvasRenderingContext2D,
    extras?: CanvasRenderingContext2D[],
  ): void;
  input(code: string, down: boolean): void; // KeyboardEvent.code
  pointer?(p: PointerInput): void; // only if the game uses the mouse
  restart(): void;
  endGame(): void;
  getSnapshot(): S;
}
```

### Rules

- **`draw(ctx, extras?)` must be assignable from `draw(ctx)`.** A method with
  fewer parameters satisfies the interface, which is why the existing
  `lib/asteroids.ts` needs no signature change. Use `extras[0]` for a second
  canvas (Tetris's next-piece preview).
- **`extra` holds flat primitives only** (`Record<string, number>`), because the
  host shallow-diffs the snapshot to avoid re-rendering at 60 fps. Anything
  structured (a 2-D matrix, a piece preview) is **drawn every frame**, never
  stored in React state. Asteroids puts `tripleShot` here; Tetris puts `lines`.
- **`pointer` is optional.** Keyboard-only engines omit it; the host only wires
  mouse listeners when the component passes `pointer: true`.
- **`dt` is seconds, already clamped** by the host to 50 ms. Engines do not clamp.
- **No DOM in the engine.** `new Audio`, `new Image`, `getComputedStyle`,
  `document.*`, `window.*` all move to the component or are injected. This is the
  central rule of `porting-guide.md`.

## `lib/useGameEngine.ts` — the host hook

Owns the canvas refs, the animation loop, the listeners, and the snapshot→state
sync. It is exactly what `AsteroidsGame.tsx` used to do inline.

```ts
export function useGameEngine<S extends GameSnapshot>(opts: {
  create: () => PlayableEngine<S>; // factory, invoked once on mount
  canvas: RefObject<HTMLCanvasElement | null>; // primary canvas
  extraCanvases?: RefObject<HTMLCanvasElement | null>[]; // e.g. Tetris preview
  playCodes?: string[]; // codes that call preventDefault (no page scroll)
  pointer?: boolean; // attach mousemove/down/up on the canvas
}): {
  engine: RefObject<PlayableEngine<S> | null>;
  snapshot: S;
  paused: boolean;
  togglePause: () => void;
  end: () => void;
  restart: () => void;
};
```

### Behavior (mirrors SPEC 05 exactly)

- `create()` runs once inside a single `useEffect` with `[]` deps; the instance
  lives in `engineRef`.
- `requestAnimationFrame` loop with `dt = Math.min((ts - last) / 1000, 0.05)`.
- Pause is read from a `pausedRef` **inside** the loop, so toggling pause never
  re-creates the effect. When paused, both `update` and `draw` are skipped — the
  last frame stays on screen under the overlay.
- `keydown`/`keyup` on `window`; `preventDefault` for each code in `playCodes`;
  `engine.input(e.code, down)`.
- If `pointer`, attach `mousemove`/`mousedown`/`mouseup` **to the canvas**,
  converting client coordinates with `const scale = canvas.width / rect.width`
  (the same math the reference games use), then `engine.pointer?.(p)`.
- `sync()` shallow-diffs `getSnapshot()` against a `lastRef`; `setState` only
  when a field actually changed.
- Cleanup cancels the frame and removes every listener (StrictMode-safe).
- `end()`/`restart()` call `engine.endGame()`/`engine.restart()` and reset pause +
  snapshot.

## `components/GameShell.tsx` — the presentational shell

The single home of the chrome (HUD, CRT frame, pause overlay, game-over modal,
save). It takes no engine — which is what lets the mock player reuse it.

```tsx
type GameShellProps = {
  game: Game; // from av_games
  score: number; // HUD + modal final score
  over: boolean; // show the game-over modal
  paused: boolean; // show the EN PAUSA overlay
  stats: HudStat[]; // game-specific tiles after Jugador + Puntuación
  onTogglePause: () => void;
  onEnd: () => void; // FIN
  onRestart: () => void; // JUGAR DE NUEVO
  children: ReactNode; // the canvas(es) or mock arena, inside .crt-screen
};
```

It renders what is today duplicated verbatim between `AsteroidsGame.tsx` and
`Reproductor.tsx`:

- `.av-player` → `.player-hud` with the always-present `Jugador` and `Puntuación`
  tiles (`score.toLocaleString('es-ES')`) followed by `stats.map` →
  `.hud-stat.<tone>` tiles; `.hud-actions` with PAUSA/REANUDAR (`onTogglePause`),
  FIN (`onEnd`), SALIR (`router.push('/juego/' + game.id)`).
- `.crt` → `.crt-screen` wrapping `{children}` + the `paused` "EN PAUSA" overlay
  (`.crt-content`, `.neon-yellow`) + `.crt-bottom` (`SEÑAL OK`,
  `{game.title} · CRT-83 · 60 HZ`, `CARGA · 1MB`).
- The game-over modal: `FIN DEL JUEGO`, `PUNTUACIÓN FINAL` + `score`, a name
  input (upper-cased, sliced to 10), GUARDAR PUNTUACIÓN →
  `useSession().saveScore({ game: game.id, score, name })` then `.toast-saved`,
  JUGAR DE NUEVO → `onRestart`, VOLVER AL VAULT → `/games`.
- `GameShell` owns the `name`/`saved` state and the default-name effect
  (`ready && user && name === 'INVITADO'`).

## Handling the three tricky cases

- **Multiple canvases (Tetris).** `GameShell.children` holds the `.crt-screen`
  layout: `<canvas ref={boardRef} width={300} height={600} />` plus
  `<canvas ref={nextRef} width={120} height={120} />`. `useGameEngine({ extraCanvases: [nextRef] })`
  collects the contexts and calls `engine.draw(ctx, [nextCtx])`. The board is
  drawn on `ctx`, the preview on `extras[0]`. The `LÍNEAS` counter goes in the
  React HUD via `extra.lines` — the preview matrix is never put in state.
- **Pointer (Arkanoid).** `useGameEngine({ pointer: true })` wires the mouse
  listeners and calls `engine.pointer({ x, y, kind })`; the engine moves the
  paddle. Keyboard still arrives through `input`. The reference's in-canvas pause
  menu is dropped in favor of the shared React overlay (a recorded decision).
- **The mock (Reproductor).** It keeps its `setInterval` score ticker and level
  math but renders `<GameShell …>{<div className="game-arena">…</div>}</GameShell>`.
  It is a _driver_ of the same shell with no engine.

## Reuse map (do not reinvent these)

- CSS classes already in `app/globals.css`: `.av-player`, `.player-hud`,
  `.hud-stat[.lives|.level]`, `.hud-actions`, `.btn[.yellow|.magenta|.ghost]`,
  `.crt`/`.crt-screen`/`.crt-content`/`.crt-bottom`/`.led`, `.asteroids-canvas`,
  `.modal-bd`/`.modal`/`.final`/`.final-label`/`.input-row`/`.actions`/`.toast-saved`,
  `.game-arena`. `.crt-screen` has `aspect-ratio: 4/3`.
- `useSession()` from `components/SessionProvider.tsx`: `user`, `ready`,
  `saveScore`. Every game saves with `saveScore({ game: game.id, score, name })`.
- Route pattern: `export const instant = false;` + `getGame(id)` → `notFound()`.
- `getGames()`/`getGame()` and the leaderboard reads from `lib/games.ts`.
