'use client';

import { useRef } from 'react';
import { GameShell } from '@/components/GameShell';
import type { GameSnapshot, HudStat } from '@/lib/engine';
import { useGameEngine } from '@/lib/useGameEngine';
import { AsteroidsEngine } from '@/lib/asteroids';
import type { Game } from '@/lib/games';

// ===== AsteroidsGame — juego real de Asteroids (SPEC 07) =====
// Port de game.js sobre un <canvas> 800×600. Solo compone el motor (AsteroidsEngine)
// con el contrato compartido: useGameEngine conduce el bucle y GameShell pinta el
// chrome. El canvas solo dibuja la acción.

const INITIAL: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  over: false,
  extra: { tripleShot: 0 },
};

export function AsteroidsGame({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { snapshot, paused, togglePause, end, restart } = useGameEngine({
    create: () => new AsteroidsEngine(),
    canvas: canvasRef,
    playCodes: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'],
    initial: INITIAL,
  });

  const tripleShot = snapshot.extra?.tripleShot ?? 0;

  const stats: HudStat[] = [
    {
      key: 'lives',
      label: 'Vidas',
      value: '♥ '.repeat(snapshot.lives).trim() || '—',
      tone: 'lives',
    },
    {
      key: 'level',
      label: 'Nivel',
      value: String(snapshot.level).padStart(2, '0'),
      tone: 'level',
    },
  ];
  if (tripleShot > 0) {
    stats.push({
      key: 'powerup',
      label: 'Power-up',
      value: `3x ${tripleShot.toFixed(1)}s`,
    });
  }

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
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="asteroids-canvas"
      />
    </GameShell>
  );
}
