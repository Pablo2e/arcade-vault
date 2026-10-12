# SPEC 07 — Contrato de juego compartido (PlayableEngine + GameShell + useGameEngine)

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 05
> **Date:** 2026-10-12
> **Objective:** Extraer del juego real un contrato reutilizable —la interfaz `PlayableEngine`, el hook `useGameEngine` y el componente `GameShell`— y refactorizar `AsteroidsGame` y `Reproductor` para usarlo, eliminando la duplicación del chrome (HUD, marco CRT, pausa y modal).

## Por qué existe este spec

SPEC 05 portó Asteroids y decidió explícitamente **no** refactorizar `Reproductor.tsx` hacia un shell compartido: había un solo juego real y el riesgo no compensaba. Hoy eso cambió: el chrome (título HUD, `player-hud`, marco `crt`, overlay "EN PAUSA", modal "FIN DEL JUEGO" y el guardado en `av_scores`) está **copiado verbatim** entre `components/AsteroidsGame.tsx` y `components/Reproductor.tsx`, y hay un tercer juego a la vista (`/add-game 03-tetris`) y un cuarto después (`04-arkanoid`). Este spec formaliza el contrato que el primer port dejó implícito y hace que los juegos siguientes solo escriban su motor y su adaptador, no el chrome. **Revierte la decisión "No refactorizar" de SPEC 05** por dos consumidores reales y más en camino.

## Scope

**In:**

- `lib/engine.ts` (puro, sin DOM ni React): los tipos `HudStat`, `GameSnapshot`, `PointerInput` y la interfaz `PlayableEngine`.
- `lib/useGameEngine.ts` (`"use client"`): el hook que conduce el bucle `requestAnimationFrame`, los listeners (teclado y, opcional, puntero), la pausa y el diff de `getSnapshot()` → estado de React.
- `components/GameShell.tsx` (`"use client"`, presentacional): el chrome único — HUD (`Jugador` + `Puntuación` + `stats`), botones PAUSA/FIN/SALIR, marco `crt`, overlay "EN PAUSA" y modal "FIN DEL JUEGO" con guardado.
- Refactor de `components/AsteroidsGame.tsx` (~277 → ~50 líneas): solo `useGameEngine` + `GameShell` + el `<canvas>`.
- Refactor de `components/Reproductor.tsx` (~181 → ~35 líneas): solo `GameShell` con su arena mock y su ticker de puntuación.
- Ajuste mínimo de `lib/asteroids.ts` al contrato: exponer `width`/`height`, y que `getSnapshot()` devuelva el `GameSnapshot` compartido con `extra: { tripleShot }`.
- Reutilizar las clases CSS existentes (`app/globals.css`); no se añade CSS nuevo salvo, si hace falta, una clase compartida para el canvas.

**Out of scope (for future specs):**

- Portar `03-tetris` y `04-arkanoid`: van en sus propios specs (08/09), ya bajo este contrato.
- Cualquier cambio visual del diseño: HUD, CRT, pausa y modal deben verse **igual** que hoy.
- `GameShell` con variantes de modal (p. ej. el "win" de Arkanoid): se decidirá cuando llegue ese juego.
- Tests automatizados, sonido, móvil, gamepad.

## Data model

`lib/engine.ts` — el contrato (compartido por todos los juegos):

```ts
export type HudStat = {
  key: string;
  label: string; // "Vidas", "Nivel", "Líneas"…
  value: string; // ya formateado para mostrar
  tone?: 'default' | 'lives' | 'level'; // mapea a .hud-stat[.lives|.level]
};

export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  over: boolean;
  extra?: Record<string, number>; // solo primitivos planos (diffeable)
};

export type PointerInput = {
  x: number;
  y: number;
  kind: 'move' | 'down' | 'up';
};

export interface PlayableEngine<S extends GameSnapshot = GameSnapshot> {
  readonly width: number;
  readonly height: number;
  update(dt: number): void; // dt en segundos; el host lo limita a 50 ms
  draw(
    ctx: CanvasRenderingContext2D,
    extras?: CanvasRenderingContext2D[],
  ): void;
  input(code: string, down: boolean): void; // KeyboardEvent.code
  pointer?(p: PointerInput): void; // solo si el juego usa el ratón
  restart(): void;
  endGame(): void;
  getSnapshot(): S;
}
```

`lib/useGameEngine.ts` — el host:

```ts
useGameEngine<S extends GameSnapshot>(opts: {
  create: () => PlayableEngine<S>;         // fábrica; se invoca una vez por montaje
  canvas: RefObject<HTMLCanvasElement | null>;
  extraCanvases?: RefObject<HTMLCanvasElement | null>[]; // p. ej. el preview de Tetris
  playCodes?: string[];                    // teclas con preventDefault
  pointer?: boolean;                       // listeners de ratón sobre el canvas
  initial: S;                              // estado inicial del snapshot
}): {
  engine: RefObject<PlayableEngine<S> | null>;
  snapshot: S;
  paused: boolean;
  togglePause: () => void;
  end: () => void;
  restart: () => void;
};
```

`components/GameShell.tsx` — el chrome presentacional:

```ts
type GameShellProps = {
  game: Game; // fila de av_games (lib/games.ts)
  score: number; // HUD + marcador final del modal
  over: boolean; // muestra el modal "FIN DEL JUEGO"
  paused: boolean; // muestra el overlay "EN PAUSA"
  stats: HudStat[]; // tiles del juego, tras "Jugador" y "Puntuación"
  onTogglePause: () => void;
  onEnd: () => void; // FIN
  onRestart: () => void; // JUGAR DE NUEVO
  children: ReactNode; // canvas(es) o arena mock, dentro de .crt-screen
};
```

`lib/asteroids.ts` — único cambio de datos: `getSnapshot()` pasa a devolver el `GameSnapshot` compartido (`{ score, lives, level, over, extra: { tripleShot } }`) en vez del tipo local con `tripleShot` en la raíz. `GameState` sigue siendo interno del motor.

Convenciones heredadas: origen arriba-izquierda; `dt` en segundos limitado a 50 ms; el motor no toca el DOM; el HUD y el modal viven en React; pausar congela `update` y `draw`.

## Implementation plan

1. **Contrato.** Crear `lib/engine.ts` con `HudStat`, `GameSnapshot`, `PointerInput` y `PlayableEngine`. Verificar: `npx tsc --noEmit` en verde (módulo sin efectos secundarios).
2. **Host.** Crear `lib/useGameEngine.ts` portando el bucle y los listeners que hoy viven inline en `AsteroidsGame.tsx` (rAF con `dt` limitado, `pausedRef`, `keydown`/`keyup` con `preventDefault`, pointer opcional, diff de snapshot, cleanup StrictMode-safe). Verificar: `npx tsc --noEmit` y `npm run lint` en verde.
3. **Shell.** Crear `components/GameShell.tsx` moviendo a él el chrome copiado de `Reproductor`/`AsteroidsGame` (HUD con `stats`, acciones PAUSA/FIN/SALIR, marco CRT, overlay de pausa, modal con `saveScore` y el estado `name`/`saved`). Verificar: `npx tsc --noEmit` y `npm run lint` en verde.
4. **Asteroids.** Refactorizar `components/AsteroidsGame.tsx` a `useGameEngine` + `GameShell`; adaptar `lib/asteroids.ts` (`width`/`height` y `getSnapshot()` con `extra.tripleShot`). Verificar: `/jugar/asteroides` juega igual (mover, rotar, disparar, pausa, fin, guardar, reiniciar) y `npx tsc --noEmit` / `npm run lint` en verde.
5. **Reproductor.** Refactorizar `components/Reproductor.tsx` a `GameShell` conservando su ticker y su arena mock. Verificar: `/jugar/rocas` y el resto de ids se ven igual y la puntuación sigue subiendo; PAUSA/FIN/guardar siguen funcionando.
6. **Sin duplicación.** Confirmar que el chrome (clases `player-hud`/`crt`/`modal`) aparece solo en `GameShell`. Verificar: `grep -n "modal-bd\|player-hud\|crt-bottom" components` solo lo encuentra en `GameShell.tsx`.

## Acceptance criteria

- [ ] `lib/engine.ts` exporta `HudStat`, `GameSnapshot`, `PointerInput` y `PlayableEngine`.
- [ ] `lib/useGameEngine.ts` expone `snapshot`, `paused`, `togglePause`, `end`, `restart` y cancela el bucle y los listeners en el cleanup.
- [ ] `components/GameShell.tsx` renderiza el HUD con `stats`, el marco CRT, el overlay "EN PAUSA" y el modal "FIN DEL JUEGO" con GUARDAR → `saveScore`.
- [ ] `/jugar/asteroides` se ve y juega idéntico a hoy: HUD con Jugador/Puntuación/Vidas/Nivel (+3x), PAUSA congela y muestra "EN PAUSA", FIN abre el modal, GUARDAR escribe en `av_scores`, JUGAR DE NUEVO reinicia (0 / 3 vidas / nivel 1).
- [ ] `/jugar/rocas` (y demás ids) muestran el mock igual que antes: la puntuación sube sola, PAUSA/FIN/guardar funcionan.
- [ ] Ningún cambio visual perceptible en ninguna de las dos pantallas.
- [ ] Entrar y salir de `/jugar/asteroides` varias veces no acumula bucles `requestAnimationFrame` ni listeners (StrictMode-safe).
- [ ] El chrome (`player-hud`, `crt`, `modal`) vive solo en `GameShell.tsx`; ni `AsteroidsGame.tsx` ni `Reproductor.tsx` lo repiten.
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** formalizar el contrato y refactorizar, **revirtiendo la decisión "No refactorizar" de SPEC 05** (decisión del usuario). Ya hay dos consumidores y vienen más; la duplicación del chrome es el mayor coste de mantenimiento.
- **Sí:** `GameSnapshot.extra` con **solo primitivos planos** (decisión del usuario sobre meter estructuras). Permite un diff superficial para no re-renderizar a 60 fps; lo estructurado (el preview de Tetris) se dibuja cada frame, no se guarda en estado.
- **Sí:** pausa en el shell (vía `pausedRef`), no en el motor. Es como funciona hoy; el motor solo expone `restart()`/`endGame()`. Se descarta la ficción de un `GameControls` con `pause()`/`resume()` que el spec 05 documentó pero nunca exportó.
- **Sí:** `draw(ctx, extras?)` — el `draw(ctx)` actual de Asteroids sigue siendo asignable (menos parámetros satisface la interfaz), así que el motor de Asteroids casi no cambia. `extras` es para el segundo canvas (preview de Tetris).
- **Sí:** `pointer?` opcional para no forzar listeners de ratón en juegos de solo teclado (los usará Arkanoid).
- **Sí:** `Reproductor` pasa a ser un **conductor mock** del mismo `GameShell` (su arena decorativa como `children`, sin motor). Conserva su ticker.
- **Sí:** reutilizar las clases CSS existentes; cero CSS nuevo salvo una clase compartida para el canvas si hiciera falta.
- **No:** cambiar el aspecto visual. Solo cambia de dónde sale el chrome, no cómo se ve.
- **No:** portar Tetris/Arkanoid aquí. Van en sus specs, ya sobre este contrato.

## Risks

| Riesgo                                                                                             | Mitigación                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El refactor toca código que ya funciona (Asteroids es jugable y guarda puntajes).                  | Se hace contra los criterios de aceptación de SPEC 05; verificación manual de jugar/pausar/guardar/reiniciar y `npx tsc --noEmit` + `npm run lint` en verde.             |
| El doble montaje de `useEffect` en desarrollo (StrictMode) deja dos bucles o listeners duplicados. | El hook comparte el `cleanup` que cancela el frame y quita todos los listeners; `engineRef` evita recrear el motor; criterio de aceptación de entrar/salir varias veces. |
| Diferencia visual sutil entre el chrome extraído y los originales.                                 | `GameShell` reproduce el markup verbatim (mismas clases y estilos inline); revisión lado a lado de `/jugar/asteroides` y `/jugar/rocas`.                                 |
| El diff superficial se traga un cambio del snapshot y el HUD no se actualiza.                      | `lastRef` arranca en `null` (primer sync siempre pinta) y compara `score/lives/level/over` y cada clave de `extra`.                                                      |
| `GameSnapshot` deja de llevar `tripleShot` en la raíz y algo lo lee.                               | Único consumidor es `AsteroidsGame.tsx`, que se reescribe en el mismo paso; se retira el tipo local.                                                                     |

## What is **not** in this spec

- Portar `03-tetris` ni `04-arkanoid` (specs 08/09).
- Rediseño visual de HUD, CRT, pausa o modal.
- Variantes de modal o de HUD por juego (p. ej. el "win" de Arkanoid).
- Sonido, controles táctiles, gamepad, tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
