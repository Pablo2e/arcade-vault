// ===== lib/snake.ts — Snake engine (SPEC 11) =====
// Motor de juego puro: no toca el DOM. El host (useGameEngine) le pasa el input
// y llama update/draw; el HUD y el modal viven en React vía getSnapshot().
// El spritesheet de frutas (fruits.png) se inyecta vía setFruitImage() desde el adapter.

import type { GameSnapshot, PlayableEngine } from '@/lib/engine';

export const W = 800;
export const H = 600;
export const CELL = 20;
export const COLS = W / CELL; // 40
export const ROWS = H / CELL; // 30

export const INITIAL_LENGTH = 4;
export const INITIAL_LIVES = 3;
export const MOVE_INTERVAL = 100; // ms entre pasos (10 Hz base)

// Puntuación base por fruta (claves coinciden con SPRITES_ATLAS.fruits)
export const FRUIT_SCORES: Record<string, number> = {
  banana: 20,
  orange: 30,
  grape: 25,
  garlic: 15,
  eggplant: 35,
  strawberry: 40,
  cherry: 15,
  carrot: 25,
  mushroom: 30,
  broccoli: 20,
  watermelon: 50,
  pepper: 30,
  kiwi: 25,
  lemon: 20,
  peach: 35,
  peanut: 15,
  apple: 10,
  tomato: 30,
  berries: 40,
  grapes2: 25,
  pineapple: 50,
  melon: 45,
};

export type FruitKey = keyof typeof FRUIT_SCORES;

// Coordenadas del spritesheet (copiadas de window.SPRITE_ATLAS.fruits en sprites.js)
export const FRUIT_ATLAS: Record<
  FruitKey,
  { x: number; y: number; w: number; h: number }
> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

type Cell = { x: number; y: number };
type Fruit = { cell: Cell; type: FruitKey };

type Direction = 'up' | 'down' | 'left' | 'right';
type GameState = 'playing' | 'paused' | 'gameover';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCell(exclude: Cell[]): Cell {
  const excluded = new Set(exclude.map((c) => `${c.x},${c.y}`));
  let cell: Cell;
  do {
    cell = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
  } while (excluded.has(`${cell.x},${cell.y}`));
  return cell;
}

function randomFruitType(): FruitKey {
  const keys = Object.keys(FRUIT_SCORES) as FruitKey[];
  return keys[randInt(0, keys.length - 1)];
}

function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export class SnakeEngine implements PlayableEngine {
  readonly width = W;
  readonly height = H;

  private snake: Cell[] = [];
  private direction: Direction = 'right';
  private nextDirection: Direction = 'right';
  private fruit: Fruit | null = null;
  private fruitImg: HTMLImageElement | null = null;
  private lives = INITIAL_LIVES;
  private score = 0;
  private state: GameState = 'playing';
  private moveTimer = 0;
  private held = new Set<string>();
  private justPressed = new Set<string>();

  constructor() {
    this.initGame();
  }

  // Inyecta la imagen del spritesheet cargada por el adapter
  setFruitImage(img: HTMLImageElement): void {
    this.fruitImg = img;
  }

  input(code: string, down: boolean): void {
    if (down && !this.held.has(code)) this.justPressed.add(code);
    if (down) this.held.add(code);
    else this.held.delete(code);
  }

  restart(): void {
    this.initGame();
  }

  endGame(): void {
    this.state = 'gameover';
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      level: 1, // Snake no tiene niveles
      over: this.state === 'gameover',
      extra: { length: this.snake.length },
    };
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    // Procesar input de dirección (no permitir giro 180°)
    this.processDirectionInput();

    this.moveTimer += dt * 1000; // dt en segundos → ms
    if (this.moveTimer < MOVE_INTERVAL) return;
    this.moveTimer = 0;

    this.step();
  }

  private processDirectionInput(): void {
    // Flechas o WASD
    const dirMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    };

    for (const [code, dir] of Object.entries(dirMap)) {
      if (this.justPressed.has(code)) {
        this.justPressed.delete(code);
        if (this.canTurn(dir)) {
          this.nextDirection = dir;
        }
        break; // solo una dirección por frame
      }
    }
  }

  private canTurn(newDir: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    return this.direction !== opposites[newDir];
  }

  private step(): void {
    this.direction = this.nextDirection;

    const head = this.snake[0];
    const newHead: Cell = { x: head.x, y: head.y };

    switch (this.direction) {
      case 'up':
        newHead.y--;
        break;
      case 'down':
        newHead.y++;
        break;
      case 'left':
        newHead.x--;
        break;
      case 'right':
        newHead.x++;
        break;
    }

    // Colisión con paredes
    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      this.hit();
      return;
    }

    // Colisión con el cuerpo (excluyendo la cola que se moverá)
    for (let i = 0; i < this.snake.length - 1; i++) {
      if (cellsEqual(this.snake[i], newHead)) {
        this.hit();
        return;
      }
    }

    // Movimiento normal: agregar cabeza
    this.snake.unshift(newHead);

    // ¿Comió fruta?
    if (this.fruit && cellsEqual(newHead, this.fruit.cell)) {
      this.score += FRUIT_SCORES[this.fruit.type];
      this.spawnFruit();
      // No quitamos la cola → crece 1 segmento
    } else {
      // Movimiento normal: quitar cola
      this.snake.pop();
    }
  }

  private hit(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'gameover';
    } else {
      this.resetSnake();
    }
  }

  private resetSnake(): void {
    this.snake = [];
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      this.snake.push({ x: startX - i, y: startY });
    }
    this.direction = 'right';
    this.nextDirection = 'right';
    this.moveTimer = 0;
    this.spawnFruit();
  }

  private initGame(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.state = 'playing';
    this.moveTimer = 0;
    this.held.clear();
    this.justPressed.clear();
    this.resetSnake();
  }

  private spawnFruit(): void {
    const exclude = this.snake;
    const cell = randomCell(exclude);
    const type = randomFruitType();
    this.fruit = { cell, type };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Fondo negro
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Dibujar grilla sutil (opcional, estilo CRT)
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.04)';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }

    // Dibujar fruta (sprite del spritesheet)
    if (this.fruit && this.fruitImg) {
      const atlas = FRUIT_ATLAS[this.fruit.type];
      const cx = this.fruit.cell.x * CELL + CELL / 2;
      const cy = this.fruit.cell.y * CELL + CELL / 2;
      // Escalar el sprite para que quepa en la celda (CELL x CELL)
      const scale = Math.min(CELL / atlas.w, CELL / atlas.h) * 1.2; // un poco más grande
      const dw = atlas.w * scale;
      const dh = atlas.h * scale;
      ctx.drawImage(
        this.fruitImg,
        atlas.x,
        atlas.y,
        atlas.w,
        atlas.h,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
    } else if (this.fruit) {
      // Fallback: círculo verde si no cargó la imagen
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(
        this.fruit.cell.x * CELL + CELL / 2,
        this.fruit.cell.y * CELL + CELL / 2,
        CELL / 2 - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Dibujar serpiente (cabeza distinta, cuerpo verde)
    this.snake.forEach((cell, i) => {
      const x = cell.x * CELL;
      const y = cell.y * CELL;
      const padding = 1;

      if (i === 0) {
        // Cabeza: verde brillante con ojos
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(
          x + padding,
          y + padding,
          CELL - padding * 2,
          CELL - padding * 2,
        );
        // Ojos
        ctx.fillStyle = '#000';
        const eyeSize = 3;
        const eyeOffset = 5;
        if (this.direction === 'right' || this.direction === 'left') {
          ctx.fillRect(x + CELL - eyeOffset, y + 4, eyeSize, eyeSize);
          ctx.fillRect(
            x + CELL - eyeOffset,
            y + CELL - 4 - eyeSize,
            eyeSize,
            eyeSize,
          );
        } else {
          ctx.fillRect(x + 4, y + eyeOffset, eyeSize, eyeSize);
          ctx.fillRect(x + CELL - 4 - eyeSize, y + eyeOffset, eyeSize, eyeSize);
        }
      } else {
        // Cuerpo: verde más oscuro, alternando tono
        ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#16a34a';
        ctx.fillRect(
          x + padding,
          y + padding,
          CELL - padding * 2,
          CELL - padding * 2,
        );
      }
    });

    // Indicador de pausa (dibujado por el motor para que se vea al pausar)
    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSA', W / 2, H / 2);
    }
  }
}
