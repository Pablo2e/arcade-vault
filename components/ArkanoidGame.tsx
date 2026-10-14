'use client';

import { useEffect, useRef, useState } from 'react';
import { GameShell } from '@/components/GameShell';
import type { GameSnapshot } from '@/lib/engine';
import { useGameEngine } from '@/lib/useGameEngine';
import { ArkanoidEngine } from '@/lib/arkanoid';
import type { Game } from '@/lib/games';

// ===== ArkanoidGame — juego real de Arkanoid (SPEC 10) =====
// Sobre el contrato compartido (useGameEngine + GameShell): el motor dibuja la
// acción en un canvas 800×600. El adapter carga el spritesheet y los sonidos,
// y los vincula vía callbacks onBounce/onBreak. El HUD usa stats = Vidas + Nivel.

const INITIAL: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  over: false,
  extra: {},
};

// Audio refs se crean una sola vez fuera del ciclo de render para evitar
// el warning de setState en effect. Se inicializan perezamente.
function createAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

export function ArkanoidGame({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spritesheetLoaded, setSpritesheetLoaded] = useState(false);
  const bounceSoundRef = useRef<HTMLAudioElement | null>(null);
  const breakSoundRef = useRef<HTMLAudioElement | null>(null);

  const {
    engine: engineRef,
    snapshot,
    paused,
    togglePause,
    end,
    restart,
  } = useGameEngine({
    create: () => new ArkanoidEngine(),
    canvas: canvasRef,
    playCodes: ['ArrowLeft', 'ArrowRight', 'KeyP', 'Escape'],
    pointer: true,
    initial: INITIAL,
  });

  // Cargar spritesheet y sonidos
  useEffect(() => {
    // Spritesheet
    const img = new Image();
    img.onload = () => {
      setSpritesheetLoaded(true);
    };
    img.src = '/games/arkanoid/spritesheet.png';

    // Sonidos (usar refs para evitar setState en effect)
    if (!bounceSoundRef.current) {
      bounceSoundRef.current = createAudio('/games/arkanoid/ball-bounce.mp3');
    }
    if (!breakSoundRef.current) {
      breakSoundRef.current = createAudio('/games/arkanoid/break-sound.mp3');
    }

    return () => {
      // Cleanup: revocar URLs si fuera necesario
    };
  }, []);

  // Vincular callbacks de sonido al motor una vez que existe
  useEffect(() => {
    const engine = engineRef.current as ArkanoidEngine | null;
    if (!engine) return;

    engine.onBounce = () => {
      const node = bounceSoundRef.current?.cloneNode();
      (node as HTMLAudioElement)?.play().catch(() => {});
    };
    engine.onBreak = () => {
      const node = breakSoundRef.current?.cloneNode();
      (node as HTMLAudioElement)?.play().catch(() => {});
    };
  }, [engineRef]);

  return (
    <GameShell
      game={game}
      score={snapshot.score}
      over={snapshot.over}
      paused={paused}
      stats={[
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
      ]}
      onTogglePause={togglePause}
      onEnd={end}
      onRestart={restart}
    >
      <div
        className="crt-screen"
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="arkanoid-canvas"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
          }}
        />
        {!spritesheetLoaded && (
          <div
            className="crt-content"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              zIndex: 10,
              color: 'var(--cyan)',
              fontFamily: 'var(--mono)',
              fontSize: 16,
            }}
          >
            CARGANDO...
          </div>
        )}
      </div>
    </GameShell>
  );
}
