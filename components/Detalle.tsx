'use client';

import { useRouter } from 'next/navigation';
import type { Game, GameMetrics, RankRow } from '@/lib/games';

// ===== Detalle — port de detalle.jsx (SPEC 06: datos reales de Supabase) =====
// La página le pasa el juego (av_games), sus métricas (av_game_metrics) y su
// ranking (av_game_best). La página garantiza que el juego existe
// (notFound()), así que aquí siempre llega uno.

type Props = {
  game: Game;
  metrics: GameMetrics;
  ranking: RankRow[];
};

export function Detalle({ game, metrics, ranking }: Props) {
  const router = useRouter();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{metrics.plays.toLocaleString('es-ES')}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: 'var(--magenta)',
                  textShadow: '0 0 6px rgba(255,0,110,0.5)',
                }}
              >
                {metrics.best.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn xl pulse"
              onClick={() => router.push(`/jugar/${game.id}`)}
            >
              ▶&nbsp;&nbsp;JUGAR AHORA
            </button>
            <button
              className="btn ghost lg"
              onClick={() => router.push('/games')}
            >
              VOLVER AL VAULT
            </button>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {ranking.map((r, i) => (
            <div
              key={`${r.name}-${r.rank}`}
              className={`lb-row${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}
            >
              <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString('es-ES')}</div>
            </div>
          ))}
          {ranking.length === 0 && (
            <div
              style={{
                padding: '20px 0',
                color: 'var(--ink-faint)',
                fontSize: 12,
                letterSpacing: '0.12em',
              }}
            >
              AÚN NO HAY PUNTUACIONES EN ESTE JUEGO.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
