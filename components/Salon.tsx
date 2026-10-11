'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionProvider';
import type { Game, GlobalRow, RankRow } from '@/lib/games';

// ===== Salon — port de salon.jsx (SPEC 06: datos reales de Supabase) =====
// Podio (01/02/03), tabla por juego con tabs + tab GLOBAL, y fila
// "TU MEJOR MARCA" consultada desde el cliente (el nombre de sesión vive en
// localStorage, así que la marca se pide al route handler /api/player-best).

const GLOBAL_TAB = 'GLOBAL';

// Fila unificada para pintar el podio y la tabla igual en ambos tabs.
type DisplayRow = { rank: number; name: string; score: number; date: string };

type Props = {
  games: Game[];
  rankings: Record<string, RankRow[]>;
  globalRows: GlobalRow[];
};

export function Salon({ games, rankings, globalRows }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState(games[0]?.id ?? GLOBAL_TAB);
  const [you, setYou] = useState<{ rank: number; score: number } | null>(null);

  const isGlobal = tab === GLOBAL_TAB;
  const game = games.find((g) => g.id === tab);

  // TU MEJOR MARCA: consulta de cliente al route handler. Se recalcula al
  // cambiar de tab o de sesión; se ignora la respuesta si el componente ya
  // cambió de tab (flag `alive`).
  useEffect(() => {
    if (!user || isGlobal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYou(null);
      return;
    }
    let alive = true;
    fetch(
      `/api/player-best?game=${encodeURIComponent(tab)}&name=${encodeURIComponent(user.name)}`,
    )
      .then((r) => (r.ok ? r.json() : { best: null }))
      .then((d) => {
        if (alive) setYou(d.best ?? null);
      })
      .catch(() => {
        if (alive) setYou(null);
      });
    return () => {
      alive = false;
    };
  }, [user, tab, isGlobal]);

  // Tanto el podio como la tabla se pintan con DisplayRow. El ranking global
  // no trae fecha, así que se muestra "—" en esa columna.
  const rows: DisplayRow[] = isGlobal
    ? globalRows.map((r) => ({
        rank: r.rank,
        name: r.name,
        score: r.total,
        date: '—',
      }))
    : (rankings[tab] ?? []).map((r) => ({ ...r }));

  const empty = rows.length === 0;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={`chip${tab === g.id ? 'active' : ''}`}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
        <button
          className={`chip${isGlobal ? 'active' : ''}`}
          onClick={() => setTab(GLOBAL_TAB)}
        >
          {GLOBAL_TAB}
        </button>
      </div>

      {!empty && (
        <div className="podium">
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{rows[1]?.name ?? '—'}</div>
            <div className="score">
              {rows[1] ? rows[1].score.toLocaleString('es-ES') : '—'}
            </div>
            <div className="date">{rows[1]?.date ?? '—'}</div>
          </div>
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: 'var(--gold)',
                letterSpacing: '0.18em',
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{rows[0].name}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {rows[0].score.toLocaleString('es-ES')}
            </div>
            <div className="date">{rows[0].date}</div>
          </div>
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{rows[2]?.name ?? '—'}</div>
            <div className="score">
              {rows[2] ? rows[2].score.toLocaleString('es-ES') : '—'}
            </div>
            <div className="date">{rows[2]?.date ?? '—'}</div>
          </div>
        </div>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${r.rank}`}
            className={`tr${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString('es-ES')}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {empty && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
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
              AÚN NO HAY PUNTUACIONES
            </div>
            <div>
              {isGlobal
                ? 'Juega una partida en cualquier juego para estrenar el ranking.'
                : 'Sé el primero en dejar tu marca en este juego.'}
            </div>
          </div>
        )}
        {user && !isGlobal && you && (
          <>
            <div className="tr you-label">
              ▸ TU MEJOR MARCA EN {game?.title ?? tab}
            </div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: 'var(--yellow)' }}>
                #{String(you.rank).padStart(2, '0')}
              </div>
              <div className="pl" style={{ color: 'var(--yellow)' }}>
                {user.name}
              </div>
              <div
                className="sc"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                {you.score.toLocaleString('es-ES')}
              </div>
              <div className="dt">—</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push('/games')}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
