// ===== lib/engine.ts — contrato compartido de los juegos (SPEC 07) =====
// Módulo puro: sin DOM ni React. Define lo que todo motor de juego expone al
// host (useGameEngine) y al chrome (GameShell). El motor NUNCA dibuja el HUD
// ni el modal: para eso está `GameSnapshot`, que el shell pinta en React.

/** Un dato del HUD distinto de "Jugador" y "Puntuación". */
export type HudStat = {
  key: string;
  label: string; // "Vidas", "Nivel", "Líneas"…
  value: string; // ya formateado para mostrar
  tone?: 'default' | 'lives' | 'level'; // mapea a .hud-stat[.lives|.level]
};

/**
 * Estado que el motor reporta cada frame. Solo primitivos planos para poder
 * diffear en O(campos) y no re-renderizar a 60 fps. Lo estructurado (p. ej. el
 * preview de Tetris) se dibuja cada frame, no se guarda aquí.
 */
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  over: boolean;
  extra?: Record<string, number>;
};

/** Entrada de puntero (solo los juegos que la usan, p. ej. Arkanoid). */
export type PointerInput = {
  x: number;
  y: number;
  kind: 'move' | 'down' | 'up';
};

/**
 * Motor de juego puro. `update` avanza la simulación (dt en segundos; el host
 * lo limita a 50 ms) y `draw` pinta la acción en el canvas. El input llega con
 * códigos de KeyboardEvent (`input`) y, opcionalmente, con el puntero
 * (`pointer`). `restart`/`endGame` los disparan los botones del shell.
 */
export interface PlayableEngine<S extends GameSnapshot = GameSnapshot> {
  readonly width: number;
  readonly height: number;
  update(dt: number): void;
  /** `extras` son canvas secundarios (p. ej. el preview del siguiente Tetris). */
  draw(
    ctx: CanvasRenderingContext2D,
    extras?: CanvasRenderingContext2D[],
  ): void;
  input(code: string, down: boolean): void;
  pointer?(p: PointerInput): void;
  restart(): void;
  endGame(): void;
  getSnapshot(): S;
}
