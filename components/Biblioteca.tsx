'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { CATS } from '@/lib/data';
import type { Game, GameMetrics } from '@/lib/games';

// ===== Biblioteca — port de biblioteca.jsx (SPEC 06: catálogo desde av_games) =====
// El tilt de GameCard es manipulación directa del DOM (igual que la
// plantilla): no es estado renderizado, así que no genera re-renders.
// `games` y `metrics` llegan por props desde la página de servidor.

function GameCard({
  game,
  best,
  plays,
  onSelect,
}: {
  game: Game;
  best: number;
  plays: number;
  onSelect: (game: Game) => void;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };
  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = '';
  };

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => onSelect(game)}
    >
      <div className="cover">
        <div className={`cover-bg ${game.cover}`}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="score-badge">
              <span>MEJOR PUNTUACIÓN</span>
              <b>{best.toLocaleString('es-ES')}</b>
            </div>
            <div className="score-badge">
              <span>PARTIDAS</span>
              <b>{plays.toLocaleString('es-ES')}</b>
            </div>
          </div>
          <button
            className={`btn ${game.color === 'magenta' ? 'magenta' : game.color === 'yellow' ? 'yellow' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(game);
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}

export function Biblioteca({
  games,
  metrics,
}: {
  games: Game[];
  metrics: GameMetrics[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('TODOS');

  // best y plays por juego desde av_game_metrics (0 si no hay partidas).
  const metricOf = useMemo(() => {
    const map = new Map(metrics.map((m) => [m.game, m]));
    return (id: string) => map.get(id);
  }, [metrics]);

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (cat === 'TODOS' || g.cat === cat) &&
          g.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [games, q, cat],
  );

  const goDetalle = (game: Game) => router.push(`/juego/${game.id}`);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={`chip${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            best={metricOf(g.id)?.best ?? 0}
            plays={metricOf(g.id)?.plays ?? 0}
            onSelect={goDetalle}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 80,
              color: 'var(--ink-faint)',
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: 'var(--magenta)',
                marginBottom: 12,
              }}
            >
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </div>
  );
}
