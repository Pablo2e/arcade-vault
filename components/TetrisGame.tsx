'use client';

import { useEffect, useRef } from 'react';
import { GameShell } from '@/components/GameShell';
import type { GameSnapshot, HudStat } from '@/lib/engine';
import { useGameEngine } from '@/lib/useGameEngine';
import { TetrisEngine } from '@/lib/tetris';
import type { Game } from '@/lib/games';

// ===== TetrisGame — juego real de Tetris (SPEC 08) =====
// Sobre el contrato compartido (useGameEngine + GameShell): el motor dibuja el
// tablero 300×600 y el preview 120×120 (extras[0]). El HUD de React no muestra
// Vidas (Tetris no las tiene) — solo Puntuación (GameShell), Nivel y Líneas.
// Los atajos P/F1 alternan la pausa como en el original, reutilizando el mismo
// togglePause que el botón del shell.

const INITIAL: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  over: false,
  extra: { lines: 0 },
};

export function TetrisGame({ game }: { game: Game }) {
  const boardRef = useRef<HTMLCanvasElement | null>(null);
  const nextRef = useRef<HTMLCanvasElement | null>(null);

  const { snapshot, paused, togglePause, end, restart } = useGameEngine({
    create: () => new TetrisEngine(),
    canvas: boardRef,
    extraCanvases: [nextRef],
    playCodes: [
      'ArrowLeft',
      'ArrowRight',
      'ArrowDown',
      'ArrowUp',
      'KeyX',
      'Space',
      'KeyP',
      'KeyF1',
    ],
    initial: INITIAL,
  });

  // Teclas de pausa (P/F1), como en el original. El engine ignora 'KeyP' en
  // input(), así que no hay doble efecto; solo alterna `paused` igual que el botón.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'KeyF1') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  const stats: HudStat[] = [
    {
      key: 'level',
      label: 'Nivel',
      value: String(snapshot.level).padStart(2, '0'),
      tone: 'level',
    },
    {
      key: 'lines',
      label: 'Líneas',
      value: String(snapshot.extra?.lines ?? 0),
    },
  ];

  return (
    <GameShell
      game={game}
      score={snapshot.score}
      over={snapshot.over}
      paused={paused}
      stats={stats}
      onTogglePause={togglePause}
      onEnd={end}
      onRestart={restart}
    >
      <div className="tetris-stage">
        <canvas
          ref={boardRef}
          width={300}
          height={600}
          className="tetris-board"
        />
        <div className="tetris-side">
          <span className="tetris-side-label">Siguiente</span>
          <canvas
            ref={nextRef}
            width={120}
            height={120}
            className="tetris-next"
          />
        </div>
      </div>
    </GameShell>
  );
}
