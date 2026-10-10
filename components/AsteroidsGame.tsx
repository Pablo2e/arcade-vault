'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/components/SessionProvider';
import { AsteroidsEngine } from '@/lib/asteroids';
import { GAMES } from '@/lib/data';

// ===== AsteroidsGame — juego real de Asteroids =====
// Port de game.js sobre un <canvas> 800×600. El HUD y el modal viven en React
// (igual que el mock de Reproductor); el canvas solo dibuja la acción.
// El bucle rAF corre en un useEffect que se monta una vez; pausar/es reanudar
// se lee vía pausedRef para no recrear listeners ni el frame a cada toggle.

const PLAY_CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);

const GAME_ID = 'asteroides';

export function AsteroidsGame() {
  const router = useRouter();
  const { user, ready, saveScore } = useSession();

  // El motor se instancia una vez por montaje, dentro del efecto del bucle,
  // y se guarda aquí para que los handlers (FIN / JUGAR DE NUEVO) accedan a él.
  const engineRef = useRef<AsteroidsEngine | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRef = useRef({
    score: -1,
    lives: -1,
    level: -1,
    over: false,
    tripleShot: 0,
  });
  const pausedRef = useRef(false);

  const game = GAMES.find((g) => g.id === GAME_ID);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [tripleShot, setTripleShot] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);

  // El contexto arranca en null (hidratación); una vez listo, el nombre
  // por defecto pasa a ser el de la sesión, como en el Reproductor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && user && name === 'INVITADO') setName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  // El bucle lee paused sin depender de él (evita recrear el effect).
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Bucle de juego + listeners de teclado. Se monta una sola vez.
  useEffect(() => {
    // El motor se crea aquí, una vez por montaje (no puede ir en el render:
    // acceder a un ref durante render está prohibido). Los handlers de FIN/
    // JUGAR DE NUEVO acceden vía engineRef una vez montado.
    if (!engineRef.current) engineRef.current = new AsteroidsEngine();
    const engine = engineRef.current;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Las teclas del juego no deben hacer scroll de la página.
      if (PLAY_CODES.has(e.code)) e.preventDefault();
      engine.input(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      engine.input(e.code, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let raf = 0;
    let last = performance.now();

    const sync = () => {
      const s = engine.getSnapshot();
      const lastSnap = lastRef.current;
      if (s.score !== lastSnap.score) {
        lastSnap.score = s.score;
        setScore(s.score);
      }
      if (s.lives !== lastSnap.lives) {
        lastSnap.lives = s.lives;
        setLives(s.lives);
      }
      if (s.level !== lastSnap.level) {
        lastSnap.level = s.level;
        setLevel(s.level);
      }
      if (s.over !== lastSnap.over) {
        lastSnap.over = s.over;
        setOver(s.over);
      }
      if (s.tripleShot !== lastSnap.tripleShot) {
        lastSnap.tripleShot = s.tripleShot;
        setTripleShot(s.tripleShot);
      }
    };

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((ts - last) / 1000, 0.05); // dt limitado a 50 ms
      last = ts;
      // La pausa congela el update Y el draw: el último frame queda en el
      // canvas y el overlay EN PAUSA lo cubre.
      if (!pausedRef.current) {
        engine.update(dt);
        engine.draw(ctx);
      }
      sync();
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  if (!game) return null;

  const endGame = () => {
    engineRef.current?.endGame();
    setOver(true);
  };

  const restart = () => {
    engineRef.current?.restart();
    setScore(0);
    setLives(3);
    setLevel(1);
    setTripleShot(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{'♥ '.repeat(lives).trim() || '—'}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
          {tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l">Power-up</div>
              <div className="v">3x {tripleShot.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="asteroids-canvas"
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd" onClick={() => {}}>
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push('/games')}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
