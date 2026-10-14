// ===== lib/arkanoid.ts — port de references/started-games/04-arkanoid/game.js (SPEC 10) =====
// Motor de juego puro: no toca el DOM (ni document, window, new Audio, new Image).
// El host (useGameEngine) le pasa el input y llama update/draw; el HUD y el modal
// viven en React vía getSnapshot(). El adapter carga el spritesheet y los sonidos
// y los vincula vía callbacks onBounce/onBreak.

import type { GameSnapshot, PlayableEngine, PointerInput } from '@/lib/engine';

export const W = 800;
export const H = 600;
export const PADDLE_SPEED = 400;
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const EXPLOSION_DURATION = 150;
export const EXPLOSION_FRAMES = 4;

export const BLOCK_COLORS = [
  'red',
  'yellow',
  'cyan',
  'magenta',
  'hotpink',
  'green',
  'gray',
];

export const LEVEL_SPEEDS = [1.0, 1.1, 1.21, 1.33, 1.46];

type GameState = 'playing' | 'paused' | 'gameover' | 'win';

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
};

type Paddle = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};

// Patrones de niveles — fieles al original (levels.js)
const LEVEL_PATTERNS: { col: number; row: number; color: string }[][] = [
  // Nivel 1: parrilla completa (6 filas × 10 cols)
  (() => {
    const rowColors = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
    const blocks: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        blocks.push({ col, row, color: rowColors[row] });
    return blocks;
  })(),
  // Nivel 2: pirámide
  (() => {
    const rowColors = ['gray', 'cyan', 'hotpink', 'yellow', 'magenta', 'green'];
    const pyStart = [4, 3, 2, 1, 0, 0];
    const pyEnd = [5, 6, 7, 8, 9, 9];
    const blocks: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = pyStart[row]; col <= pyEnd[row]; col++)
        blocks.push({ col, row, color: rowColors[row] });
    return blocks;
  })(),
  // Nivel 3: ajedrez
  (() => {
    const blocks: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        if ((col + row) % 2 === 0)
          blocks.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });
    return blocks;
  })(),
  // Nivel 4: huecos
  (() => {
    const rowColors = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];
    const gaps4 = [
      [2, 5, 8],
      [0, 4, 7, 9],
      [1, 3, 6],
      [2, 5, 8, 9],
      [0, 4, 7],
      [1, 3, 6, 9],
    ];
    const blocks: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        if (!gaps4[row].includes(col))
          blocks.push({ col, row, color: rowColors[row] });
    return blocks;
  })(),
  // Nivel 5: marco + cruz
  (() => {
    const blocks: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++) {
        const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
        const isCross = col === 4 || row === 2;
        if (isFrame || isCross)
          blocks.push({
            col,
            row,
            color: isCross && !isFrame ? 'hotpink' : 'cyan',
          });
      }
    return blocks;
  })(),
];

function initPaddle(): Paddle {
  return {
    x: (W - 81) / 2,
    y: 560,
    w: 81,
    h: 14,
  };
}

function initBall(paddle: Paddle, levelSpeed: number): Ball {
  return {
    x: paddle.x + (paddle.w - 16) / 2,
    y: paddle.y - 16,
    w: 16,
    h: 16,
    vx: BASE_BALL_VX * levelSpeed,
    vy: BASE_BALL_VY * levelSpeed,
  };
}

function loadLevel(
  level: number,
  paddle: Paddle,
): { blocks: Block[]; ball: Ball } {
  const pattern = LEVEL_PATTERNS[level - 1];
  const speed = LEVEL_SPEEDS[level - 1];
  const blocks: Block[] = pattern.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }));
  const ball = initBall(paddle, speed);
  return { blocks, ball };
}

function collideAABB(ball: Ball, block: Block): boolean {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

export class ArkanoidEngine implements PlayableEngine {
  readonly width = W;
  readonly height = H;

  private paddle!: Paddle;
  private ball!: Ball;
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private lives = 3;
  private score = 0;
  private level = 1;
  private gameState: GameState = 'playing';
  private isPaused = false;
  private held = new Set<string>();

  // Callbacks opcionales para sonidos (el adapter los vincula)
  onBounce?: () => void;
  onBreak?: () => void;

  constructor() {
    this.resetGame();
  }

  // Reinicio completo (JUGAR DE NUEVO)
  restart(): void {
    this.resetGame();
  }

  // FIN prematuro: termina la partida en curso (el modal lo gestiona GameShell)
  endGame(): void {
    this.gameState = 'gameover';
  }

  // Input desde el componente (teclado)
  input(code: string, down: boolean): void {
    if (down) this.held.add(code);
    else this.held.delete(code);

    // Pausa: P / Escape (solo en playing)
    if (
      down &&
      (code === 'KeyP' || code === 'Escape') &&
      this.gameState === 'playing'
    ) {
      this.isPaused = !this.isPaused;
    }
  }

  // Puntero (ratón) — mueve el paddle
  pointer(p: PointerInput): void {
    if (p.kind === 'move') {
      this.paddle.x = Math.max(
        0,
        Math.min(W - this.paddle.w, p.x - this.paddle.w / 2),
      );
    }
  }

  // dt en segundos (el host lo limita a 50 ms)
  update(dt: number): void {
    if (this.gameState !== 'playing' || this.isPaused) return;

    // Paddle
    if (this.held.has('ArrowLeft')) {
      this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    }
    if (this.held.has('ArrowRight')) {
      this.paddle.x = Math.min(
        W - this.paddle.w,
        this.paddle.x + PADDLE_SPEED * dt,
      );
    }

    // Ball movement
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Wall bounces (left, right, top)
    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.onBounce?.();
    }
    if (this.ball.x + this.ball.w >= W) {
      this.ball.x = W - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.onBounce?.();
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.onBounce?.();
    }

    // Paddle bounce
    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.onBounce?.();
    }

    // Block collisions
    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (collideAABB(this.ball, block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        this.ball.vy = -this.ball.vy;
        this.onBreak?.();
        if (this.blocks.every((b) => !b.alive)) {
          if (this.level < 5) {
            this.level++;
            const { blocks, ball } = loadLevel(this.level, this.paddle);
            this.blocks = blocks;
            this.ball = ball;
            this.explosions = [];
          } else {
            this.gameState = 'win';
          }
        }
        break; // one block per frame
      }
    }

    // Explosions
    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    // Ball lost
    if (this.ball.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameState = 'gameover';
      } else {
        this.ball = initBall(this.paddle, LEVEL_SPEEDS[this.level - 1]);
      }
    }
  }

  // Solo la acción: el HUD de React se encarga del resto.
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Blocks
    for (const block of this.blocks) {
      if (block.alive) {
        // Dibuja un rectángulo con el color del bloque (el adapter usa spritesheet)
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        // Borde sutil
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(block.x, block.y, block.w, block.h);
      }
    }

    // Explosions
    for (const exp of this.explosions) {
      // Dibuja un rectángulo que se desvanece como placeholder
      const alpha = 1 - exp.elapsed / EXPLOSION_DURATION;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = exp.color;
      ctx.fillRect(exp.x, exp.y, exp.w, exp.h);
      ctx.globalAlpha = 1;
    }

    // Paddle
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    // Ball
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.ball.x, this.ball.y, this.ball.w, this.ball.h);
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      over: this.gameState === 'gameover' || this.gameState === 'win',
      extra: {},
    };
  }

  private resetGame(): void {
    this.paddle = initPaddle();
    const { blocks, ball } = loadLevel(1, this.paddle);
    this.blocks = blocks;
    this.ball = ball;
    this.explosions = [];
    this.lives = 3;
    this.score = 0;
    this.level = 1;
    this.gameState = 'playing';
    this.isPaused = false;
    this.held.clear();
  }
}
