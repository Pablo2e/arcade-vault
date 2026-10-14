'use client';

import { useEffect, useRef } from 'react';
import { GameShell } from '@/components/GameShell';
import type { GameSnapshot, HudStat } from '@/lib/engine';
import { useGameEngine } from '@/lib/useGameEngine';
import { SnakeEngine } from '@/lib/snake';
import type { Game } from '@/lib/games';

// ===== SnakeGame — juego real de Snake (SPEC 11) =====
// Sobre el contrato compartido (useGameEngine + GameShell): el motor dibuja
// serpiente + fruta (sprite del spritesheet Google Snake). HUD: Puntuación + Vidas + Longitud.
// Controles: flechas / WASD para mover, Space acelera, P/Escape pausa.

const INITIAL: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  over: false,
  extra: { length: 4 },
};

export function SnakeGame({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fruitImgRef = useRef<HTMLImageElement | null>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  const { snapshot, paused, togglePause, end, restart } = useGameEngine({
    create: () => {
      const engine = new SnakeEngine();
      engineRef.current = engine;
      // Si la imagen ya cargó, inyectarla
      if (fruitImgRef.current) {
        engine.setFruitImage(fruitImgRef.current);
      }
      return engine;
    },
    canvas: canvasRef,
    playCodes: [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'KeyW',
      'KeyS',
      'KeyA',
      'KeyD',
      'Space',
      'KeyP',
      'Escape',
    ],
    initial: INITIAL,
  });

  // Cargar spritesheet de frutas
  useEffect(() => {
    const img = new Image();
    img.src = '/games/snake/fruits.png';
    img.onload = () => {
      fruitImgRef.current = img;
      if (engineRef.current) {
        engineRef.current.setFruitImage(img);
      }
    };
  }, []);

  // Tecla Space = acelerar (opcional, el motor la ignora por ahora)
  // P/Escape = pausa (ya manejado por GameShell via togglePause)

  const stats: HudStat[] = [
    {
      key: 'lives',
      label: 'Vidas',
      value: '♥ '.repeat(snapshot.lives).trim() || '—',
      tone: 'lives',
    },
    {
      key: 'length',
      label: 'Longitud',
      value: String(snapshot.extra?.length ?? 4),
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
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="asteroids-canvas"
      />
    </GameShell>
  );
}
