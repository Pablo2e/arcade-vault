'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/components/SessionProvider';
import type { HudStat } from '@/lib/engine';
import type { Game } from '@/lib/games';

// ===== GameShell — chrome único de un juego (SPEC 07) =====
// Presentacional y sin motor: pinta el HUD (Jugador/Puntuación + stats), los
// botones PAUSA/FIN/SALIR, el marco CRT, el overlay EN PAUSA y el modal FIN DEL
// JUEGO con guardado en av_scores. Los juegos solo aportan sus canvas como
// children (el mock se eliminó en SPEC 09).

type GameShellProps = {
  game: Game;
  score: number;
  over: boolean;
  paused: boolean;
  stats: HudStat[];
  onTogglePause: () => void;
  onEnd: () => void;
  onRestart: () => void;
  children: ReactNode;
};

export function GameShell({
  game,
  score,
  over,
  paused,
  stats,
  onTogglePause,
  onEnd,
  onRestart,
  children,
}: GameShellProps) {
  const router = useRouter();
  const { user, ready, saveScore } = useSession();

  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);

  // El contexto arranca en null (hidratación); una vez listo, el nombre por
  // defecto pasa a ser el de la sesión. Al reiniciar se limpia `saved`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && user && name === 'INVITADO') setName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!over) setSaved(false);
  }, [over]);

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
          {stats.map((s) => (
            <div
              key={s.key}
              className={`hud-stat${s.tone && s.tone !== 'default' ? ` ${s.tone}` : ''}`}
            >
              <div className="l">{s.label}</div>
              <div className="v">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={onTogglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={onEnd}>
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
          {children}
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
              <button className="btn" onClick={onRestart}>
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
