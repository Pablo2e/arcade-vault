// ===== lib/tetris.ts — port de references/started-games/03-tetris/game.js (SPEC 08) =====
// Motor de juego puro: no toca el DOM (ni getComputedStyle ni theme toggle).
// El host (useGameEngine) le pasa el input y llama update/draw; el HUD y el modal
// viven en React vía getSnapshot(). El preview de la pieza siguiente lo pinta el
// motor cada frame sobre extras[0] (canvas 120×120), sin guardarlo en estado.

import type { GameSnapshot } from '@/lib/engine';

export const TETRIS_COLS = 10;
export const TETRIS_ROWS = 20;
export const TETRIS_BLOCK = 30;

// Índice 1..8: I cyan, O amarillo, T morado, S verde, Z rojo, J azul pálido,
// L naranja, N "tuerca" gris metálico (octava pieza del original).
const COLORS = [
  null,
  '#4dd0e1',
  '#ffd54f',
  '#ba68c8',
  '#81c784',
  '#e57373',
  '#90caf9',
  '#ffb74d',
  '#9e9e9e',
];

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Color fijo de la rejilla: reemplaza el getComputedStyle('--grid-line') del
// original (un motor no puede leer el CSS); se usa un trazo sutil de neón.
const GRID_LINE = 'rgba(0, 245, 255, 0.08)';

type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

function createBoard(): number[][] {
  return Array.from({ length: TETRIS_ROWS }, () =>
    new Array<number>(TETRIS_COLS).fill(0),
  );
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  // type siempre ∈ 1..8 (índices 1..8 de PIECES; 0 = null es solo centinela).
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(TETRIS_COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(
  shape: number[][],
  ox: number,
  oy: number,
  board: number[][],
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= TETRIS_COLS || ny >= TETRIS_ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export class TetrisEngine {
  readonly width = TETRIS_COLS * TETRIS_BLOCK; // 300
  readonly height = TETRIS_ROWS * TETRIS_BLOCK; // 600

  private board: number[][];
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private state: 'playing' | 'over' = 'playing';
  private dropAccum = 0;
  private dropInterval = 1000;

  constructor() {
    this.board = createBoard();
    this.next = randomPiece();
    this.spawn();
  }

  // Re-todo el estado (JUGAR DE NUEVO). Igual que init() del original.
  restart() {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = 'playing';
    this.dropAccum = 0;
    this.dropInterval = 1000;
    this.next = randomPiece();
    this.spawn();
  }

  // FIN de la partida en curso (el modal lo gestiona GameShell).
  endGame() {
    this.state = 'over';
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lives: 3, // Tetris no usa vidas; el HUD no muestra el tile
      level: this.level,
      over: this.state === 'over',
      extra: { lines: this.lines },
    };
  }

  // Input del teclado (solo la pulsación importa en Tetris). El host hace
  // preventDefault sobre estas teclas; la pausa no entra aquí (vive en el shell).
  input(code: string, down: boolean) {
    if (this.state === 'over' || !down) return;
    switch (code) {
      case 'ArrowLeft':
        if (
          !collide(
            this.current.shape,
            this.current.x - 1,
            this.current.y,
            this.board,
          )
        )
          this.current.x--;
        break;
      case 'ArrowRight':
        if (
          !collide(
            this.current.shape,
            this.current.x + 1,
            this.current.y,
            this.board,
          )
        )
          this.current.x++;
        break;
      case 'ArrowDown':
        this.softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.tryRotate();
        break;
      case 'Space':
        this.hardDrop();
        break;
    }
  }

  // dt en segundos (el host lo limita a 50 ms). Auto-caída cronometrada.
  update(dt: number) {
    if (this.state === 'over') return;
    this.dropAccum += dt * 1000;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (
        !collide(
          this.current.shape,
          this.current.x,
          this.current.y + 1,
          this.board,
        )
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  // ctx = canvas 300×600 (tablero); extras[0] = canvas 120×120 (preview).
  draw(ctx: CanvasRenderingContext2D, extras?: CanvasRenderingContext2D[]) {
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawGrid(ctx);

    // board
    for (let r = 0; r < TETRIS_ROWS; r++)
      for (let c = 0; c < TETRIS_COLS; c++)
        drawBlock(ctx, c, r, this.board[r][c], TETRIS_BLOCK);

    // ghost
    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            TETRIS_BLOCK,
            0.2,
          );

    // pieza actual
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          TETRIS_BLOCK,
        );

    // preview de la siguiente (cada frame; nunca en estado React)
    const nextCtx = extras?.[0];
    if (nextCtx) {
      nextCtx.clearRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
      const shape = this.next.shape;
      const offX = Math.floor((4 - shape[0].length) / 2);
      const offY = Math.floor((4 - shape.length) / 2);
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          drawBlock(nextCtx, offX + c, offY + r, shape[r][c], 30);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < TETRIS_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TETRIS_BLOCK, 0);
      ctx.lineTo(c * TETRIS_BLOCK, TETRIS_ROWS * TETRIS_BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < TETRIS_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TETRIS_BLOCK);
      ctx.lineTo(TETRIS_COLS * TETRIS_BLOCK, r * TETRIS_BLOCK);
      ctx.stroke();
    }
  }

  private tryRotate() {
    const rotated = rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (
        !collide(rotated, this.current.x + kick, this.current.y, this.board)
      ) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!collide(this.current.shape, this.current.x, gy + 1, this.board))
      gy++;
    return gy;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop() {
    if (
      !collide(
        this.current.shape,
        this.current.x,
        this.current.y + 1,
        this.board,
      )
    ) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private merge() {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(TETRIS_COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private spawn() {
    this.current = this.next;
    this.next = randomPiece();
    // Al nacer encima de otro bloque, la torre ha llegado al techo.
    if (
      collide(this.current.shape, this.current.x, this.current.y, this.board)
    ) {
      this.endGame();
    }
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex]!; // colorIndex ∈ 1..8 cuando no es 0
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}
