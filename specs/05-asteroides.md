# SPEC 05 — Juego real de Asteroides (ROCAS/asteroides) portado a Next.js

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-10
> **Objective:** Portar el juego de `references/started-games/02-asteroids/game.js` a un componente React con canvas real servido en una ruta dedicada `/jugar/asteroides`, reutilizando el HUD y el modal de fin de juego del reproductor y guardando la puntuación final en `av_scores`.

## Por qué existe este spec

SPEC 01 declaró fuera de scope "juegos jugables" y dejó el reproductor (`components/Reproductor.tsx`) como un mock visual: la puntuación sube sola cada 220 ms y no hay ninguna lógica de juego. Este es el primer spec que mete un juego de verdad en la plataforma. La decisión no obvia es cómo convive el juego real con la ruta y el mock existentes sin reescribir el reproductor ni romper las pantallas de la biblioteca: el juego vive en una ruta dedicada `/jugar/asteroides` (segmento estático que en Next tiene prioridad sobre `/jugar/[id]`), el catálogo gana una entrada nueva y el mock queda intacto para el resto de juegos.

## Scope

**In:**

- Entrada nueva en `lib/data.ts` (`GAMES`): `id: "asteroides"`, `cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-rocas"` (clase CSS ya existente, sin CSS nuevo), con `title`, `short`, `long`, `best` y `plays` propios. ROCAS (`id: "rocas"`) permanece como está.
- Lógica del juego portada de `game.js` a un módulo TypeScript (`lib/asteroids.ts`): clases `Bullet`, `Asteroid`, `Ship`, `PowerUp`, `Particle` y el estado del juego, con las mismas constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`, `ROT`, `THRUST`, `DRAG`, velocidades de bala).
- Componente cliente `components/AsteroidsGame.tsx`: `useRef` al `<canvas>` 800×600, bucle `requestAnimationFrame` dentro de `useEffect` con `dt` limitado a 50 ms, `update(dt)` + `draw()`, y cleanup que cancela el frame y quita los listeners.
- Input por listeners `keydown`/`keyup` en `window` (← → rotar, ↑ propulsar, Espacio disparar), con `preventDefault` en esas teclas, quitados en el cleanup.
- Chrome reutilizado del reproductor: HUD del jugador (puntuación, vidas, nivel), marco CRT, y modal "FIN DEL JUEGO" con GUARDAR PUNTUACIÓN / JUGAR DE NUEVO / VOLVER AL VAULT. El HUD y el modal NO se dibujan dentro del canvas; el canvas solo dibuja la acción (nave, asteroides, balas, partículas, power-ups).
- El juego reporta `score` / `lives` / `level` / `gameover` al HUD de React (solo `setState` cuando cambian, para no re-renderizar a 60 fps).
- Botones PAUSA y FIN del HUD actúan sobre el juego real: PAUSA congela el bucle y muestra el overlay "EN PAUSA"; FIN termina la partida y abre el modal.
- Guardado de la puntuación final en `av_scores` vía `useSession().saveScore`, con el nombre de la sesión o "INVITADO" si no hay, igual que el mock.
- Ruta `app/jugar/asteroides/page.tsx` que monta el componente.
- Escalado visual del canvas con CSS (ancho máximo + `aspect-ratio`) para que quepa dentro del CRT en pantallas estrechas; el sistema de coordenadas interno sigue en 800×600.

**Out of scope (for future specs):**

- Portar los otros juegos (`03-tetris`, `04-arkanoid` o el resto de `lib/data.ts`): cada uno va en su spec.
- Cambiar `components/Reproductor.tsx`: el resto de juegos conservan el mock tal cual.
- El OVNI clásico de Asteroids (el `long` de ROCAS lo menciona, pero `game.js` no lo implementa): no se agrega.
- Puntuaciones o validación en servidor, autenticación real, anti-cheat: hereda las exclusiones de SPEC 01 y SPEC 04.
- Sonido, móvil/táctil, gamepad, pausa automática al perder foco, vidas extra por puntuación.
- Tests automatizados.

## Data model

Entrada nueva en `GAMES` (`lib/data.ts`):

```ts
// Nueva entrada — el resto del catálogo no cambia
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pulveriza rocas en gravedad cero.",   // texto final a definir en implementación
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños.", // coherente con ROCAS
  cat: "SHOOTER",
  cover: "cover-rocas",   // clase CSS ya existente
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

Lógica portada (`lib/asteroids.ts`) — mismas estructuras que `game.js`:

```ts
// Tamaño de asteroide: 1 (pequeño), 2 (mediano), 3 (grande)
const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

class Bullet {
  /* x, y, vx, vy, ttl, radius, dead; update(dt), draw(ctx) */
}
class Asteroid {
  /* x, y, size, verts, rot; update(dt), split(), draw(ctx) */
}
class Ship {
  /* x, y, angle, vx, vy, lives-invincible, tripleShot, tryShoot() */
}
class PowerUp {
  /* 3x, ttl 12s, radio 12; recoge → ship.tripleShot = 5s */
}
class Particle {
  /* explosión, ttl 0.4–1.1s */
}

// Estado del motor (mutable, fuera de React)
type GameState = 'playing' | 'dead' | 'gameover';
```

Contrato motor → React (solo reporta, no dibuja HUD):

```ts
// El componente sincroniza estos valores al HUD solo cuando cambian
type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  over: boolean;
};

// Controls expuestos por el componente hacia el motor
type GameControls = {
  pause(): void;
  resume(): void;
  endGame(): void;
  restart(): void;
};
```

Convenciones heredadas de `game.js`: origen arriba-izquierda, envolvimiento toroidal `wrap(v, max)`, canvas 800×600, `dt` en segundos limitado a 50 ms.

## Implementation plan

1. **Entrada de catálogo.** Añadir la entrada `asteroides` a `GAMES` en `lib/data.ts` con `cover: "cover-rocas"`. Verificar: `/games` muestra la card nueva, `/juego/asteroides` renderiza el detalle y su "JUGAR AHORA" apunta a `/jugar/asteroides`; `npx tsc --noEmit` en verde.
2. **Motor del juego.** Crear `lib/asteroids.ts` portando clases y estado de `game.js` (constantes, `spawnAsteroids`, `initGame`, `nextLevel`, `killShip`, colisiones bala-asteroide y nave-asteroide, fragmentación, partículas, power-up 3x, progresión de nivel). El módulo no toca el DOM: `update(dt)` y `draw(ctx)` reciben o guardan el contexto. Verificar: `npx tsc --noEmit` y `npm run lint` en verde; el módulo importa sin efectos secundarios.
3. **Componente cliente.** Crear `components/AsteroidsGame.tsx` (`"use client"`): `useRef` del canvas, `useEffect` con el bucle `requestAnimationFrame` + `dt` limitado, listeners de teclado en `window` con `preventDefault`, y cleanup (cancelar frame + quitar listeners). Sincronizar `score`/`lives`/`level`/`over` a estado de React solo en los cambios. Verificar: montar en `/jugar/asteroides` dibuja la nave y los asteroides y responden a ← → ↑ Espacio.
4. **Ruta dedicada.** Crear `app/jugar/asteroides/page.tsx` que renderiza `AsteroidsGame`. Verificar: `/jugar/asteroides` carga sin errores en consola; `/jugar/rocas` (y demás ids) siguen sirviendo el mock de `Reproductor`.
5. **HUD y modal reutilizados.** Envolver el canvas con el mismo HUD (`player-hud`, `hud-stat`) y el marco `crt` del reproductor, y añadir el modal "FIN DEL JUEGO" (`modal-bd`/`modal`) con GUARDAR PUNTUACIÓN (escribe `av_scores` vía `useSession().saveScore`), JUGAR DE NUEVO (reinicia el motor) y VOLVER AL VAULT. Verificar: puntuación y vidas del HUD siguen al juego; PAUSA congela y muestra "EN PAUSA"; FIN abre el modal; guardar escribe en `av_scores` y muestra "PUNTUACIÓN GUARDADA_".
6. **Escalado y pulido.** Ajustar el `<canvas>` con CSS (`max-width: 100%`, `aspect-ratio: 4 / 3`, `image-rendering`) para que quepa en el CRT sin deformar. Verificar: en una ventana estrecha el juego se ve completo; el canvas interno sigue en 800×600.

## Acceptance criteria

- [ ] `/games` muestra una card nueva "ASTEROIDES" (categoría SHOOTER, cover `cover-rocas`) sin alterar las demás.
- [ ] `/juego/asteroides` renderiza el detalle y "JUGAR AHORA" navega a `/jugar/asteroides`.
- [ ] `/jugar/asteroides` monta el juego real: se ven la nave triangular, los asteroides irregulares y el fondo negro; nada falla en la consola del navegador.
- [ ] ← y → rotan la nave; ↑ propulsa (con llama visible); Espacio dispara una bala por pulsación.
- [ ] Disparar a un asteroide grande lo parte en medianos, y estos en pequeños; cada tamaño suma su puntuación (20 / 50 / 100) en el HUD.
- [ ] El HUD de React muestra puntuación, vidas (3 al inicio) y nivel, y se actualizan con la partida.
- [ ] Chocar con un asteroide resta una vida; al reaparecer la nave parpadea (invencible) y no muere de inmediato.
- [ ] Destruir un asteroide genera partículas de explosión visibles.
- [ ] Aparece el power-up "3x" y al recogerlo la nave dispara triple durante ~5 s (indicador visible en el HUD).
- [ ] Limpiar todos los asteroides avanza de nivel y aparecen más asteroides.
- [ ] Quedarse sin vidas termina la partida y abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] PAUSA congela el juego y muestra el overlay "EN PAUSA"; REANUDAR continúa la partida.
- [ ] FIN termina la partida en curso y abre el modal.
- [ ] GUARDAR PUNTUACIÓN escribe una entrada en `av_scores` (con el nombre de la sesión o "INVITADO") y muestra "PUNTUACIÓN GUARDADA_".
- [ ] JUGAR DE NUEVO reinicia el motor (puntuación 0, 3 vidas, nivel 1); VOLVER AL VAULT navega a `/games`.
- [ ] Al desmontar la ruta (navegar fuera), el bucle `requestAnimationFrame` y los listeners de teclado quedan liberados (no se acumulan al entrar y salir varias veces).
- [ ] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [ ] El canvas se ve completo y sin deformar dentro del CRT en una ventana estrecha.
- [ ] `/jugar/rocas` y el resto de ids siguen mostrando el mock de `Reproductor` sin cambios.
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** ruta dedicada `app/jugar/asteroides/page.tsx` (elegido por el usuario sobre ramificar dentro de `/jugar/[id]`). El segmento estático tiene prioridad sobre `[id]` en Next; el `Reproductor` mock queda intacto y los demás juegos no se tocan.
- **Sí:** entrada nueva `id: "asteroides"` en `GAMES` (elegido por el usuario sobre reusar `rocas`). El spec ES "el primer juego" y merece su propia ficha; ROCAS queda como mock de biblioteca.
- **Sí:** port completo de `game.js` (elegido por el usuario sobre quitar el power-up 3x): vidas con invencibilidad/parpadeo, fragmentación, partículas, power-up, niveles y envolvimiento toroidal.
- **Sí:** componente React con `useRef` del canvas y bucle en `useEffect` (elegido por el usuario sobre conservar `game.js` vanilla y cargarlo por `<script>`). Rompe el uso de globals (`window.addEventListener`, `document.getElementById`) y encaja con el patrón `components/*.tsx` del repo.
- **Sí:** HUD y modal en React; el canvas solo dibuja la acción (elegido por el usuario sobre mantener el HUD dentro del canvas). Evita duplicar la información y reutiliza la estética VAULT-OS y el flujo de `av_scores` ya existentes.
- **Sí:** input por listeners en `window` con `preventDefault` (elegido por el usuario sobre canvas enfocable). Fiel a `game.js`; no exige un clic previo para jugar.
- **Sí:** guardar siempre en `av_scores`, con "INVITADO" si no hay sesión (elegido por el usuario). Es el comportamiento actual del mock del reproductor; no se introduce una regla nueva.
- **Sí:** canvas 800×600 escalado por CSS (elegido por el usuario sobre tamaño fijo). Mantiene las coordenadas y la física del original sin desbordar el CRT.
- **Sí:** `lib/asteroids.ts` para el motor y `components/AsteroidsGame.tsx` para el canvas/loop. Separa lógica pura de React y deja el motor testeable/portable a futuros juegos del mismo tipo.
- **Sí:** reutilizar la clase CSS `cover-rocas` en la card nueva. Evita CSS nuevo; la portada es temáticamente idéntica (rocas en el espacio).
- **Sí:** `preventDefault` solo en ← → ↑ y Espacio. Son las teclas del juego; interceptar más rompería el comportamiento normal de la página.
- **No:** OVNI clásico. `game.js` no lo implementa y el spec prioriza un port fiel, no features nuevas.
- **No:** refactorizar `Reproductor.tsx` hacia un shell compartido. Se reutilizan sus clases CSS y `useSession`, pero el mock no se modifica en este spec; el riesgo de tocar los otros juegos no compensa.
- **No:** puntuaciones en servidor, auth real, anti-cheat, sonido, móvil o gamepad. Van en specs propios si llegan.

## Risks

| Riesgo                                                                                                                     | Mitigación                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El doble montaje de `useEffect` en desarrollo (StrictMode) deja dos bucles `requestAnimationFrame` o listeners duplicados. | El cleanup cancela el frame y quita los listeners; verificar entrando y saliendo de la ruta varias veces.                                                             |
| Los listeners de teclado en `window` siguen activos tras desmontar o mientras el modal está abierto.                       | Quitarlos en el cleanup y no procesar input del juego cuando la partida está en `gameover` o en pausa.                                                                |
| El canvas se deforma o desborda dentro del CRT en pantallas estrechas.                                                     | Escalado por CSS (`max-width`, `aspect-ratio`) manteniendo el sistema interno 800×600; criterio de aceptación cubre la ventana estrecha.                              |
| Derechos de autor / nombres: la ficha nueva del catálogo podría chocar con el `id` de otra.                                | `id: "asteroides"` no existe hoy en `GAMES`; verificado en `lib/data.ts`.                                                                                             |
| `setState` a 60 fps desde el bucle degrada el rendimiento.                                                                 | El motor mantiene el estado; React solo recibe cambios de `score`/`lives`/`level`/`over` cuando realmente cambian.                                                    |
| Next 16 con `cacheComponents: true` trata de forma inesperada un componente plenamente cliente.                            | El componente es `"use client"` y no hace fetching; antes de la ruta, revisar la guía de componentes cliente en `node_modules/next/dist/docs/` como indica CLAUDE.md. |

## What is **not** in this spec

- Los otros juegos del catálogo (cada uno en su spec).
- Cambios en `components/Reproductor.tsx` o en las demás pantallas.
- El OVNI clásico de Asteroids.
- Puntuaciones en servidor, auth real o anti-cheat.
- Sonido, controles táctiles, gamepad.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
