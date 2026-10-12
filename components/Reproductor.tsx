'use client';

import { useEffect, useState } from 'react';
import { GameShell } from '@/components/GameShell';
import type { HudStat } from '@/lib/engine';
import type { Game } from '@/lib/games';

// ===== Reproductor — port de reproductor.jsx (SPEC 07) =====
// Mock visual de la plantilla: no hay motor real, la puntuación sube sola cada
// 220 ms. Reutiliza el GameShell compartido con su arena decorativa como
// children; el estado de partida (score/lives/level/paused/over) vive aquí.

export function Reproductor({ game }: { game: Game }) {
  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [over, paused]);

  // Subida de nivel calculada desde score, igual que la plantilla.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score]);

  const restart = () => {
    setScore(0);
    setLevel(1);
    setPaused(false);
    setOver(false);
  };

  const stats: HudStat[] = [
    {
      key: 'lives',
      label: 'Vidas',
      value: '♥ '.repeat(lives).trim() || '—',
      tone: 'lives',
    },
    {
      key: 'level',
      label: 'Nivel',
      value: String(level).padStart(2, '0'),
      tone: 'level',
    },
  ];

  return (
    <GameShell
      game={game}
      score={score}
      over={over}
      paused={paused}
      stats={stats}
      onTogglePause={() => setPaused((p) => !p)}
      onEnd={() => setOver(true)}
      onRestart={restart}
    >
      <div className="game-arena">
        <div className="grid-floor"></div>
        <div className="enemy e1"></div>
        <div className="enemy e2"></div>
        <div className="enemy e3"></div>
        <div className="player-ship"></div>
      </div>
    </GameShell>
  );
}
