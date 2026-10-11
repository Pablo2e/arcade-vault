import { createClient } from '@/lib/supabase/server';

// ===== lib/games.ts — capa de datos de servidor (SPEC 06) =====
// Todas las funciones leen de Supabase con el cliente de servidor
// (lib/supabase/server.ts) y devuelven los tipos de la app. Cada una abre su
// propio cliente: `createServerClient` no se comparte entre requests.
//
// Nota sobre Cache Components: aquí NO se usa `use cache` a propósito. El
// ranking es dato vivo (cada partida lo cambia) y las vistas de ranking leen
// `av_scores` sin cachear; con `cacheComponents: true` esas páginas se
// renderizan en request time detrás de un <Suspense>/loading. La ficha del
// juego sí es estable, así que el paso 7 decidirá si conviene cachearla.

/** Fila de `av_games` (catálogo). Fuente de verdad del juego. */
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
  cover: string;
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  sort: number;
};

export type GameMetrics = { game: string; best: number; plays: number };

export type RankRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export type GlobalRow = { rank: number; name: string; total: number };

export type PlayerBest = { rank: number; score: number } | null;

/** Top del ranking en pantalla (lo que hoy pide el Salón). */
const TOP = 12;

/** Formatea un timestamptz como dd/mm/aaaa. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}

const GAME_COLUMNS = 'id, title, short, long, cat, cover, color, sort';

/** Catálogo completo, en el orden de `sort`. */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('av_games')
    .select(GAME_COLUMNS)
    .order('sort', { ascending: true });

  if (error) throw new Error(`getGames: ${error.message}`);
  return (data ?? []) as Game[];
}

/** Un juego por id, o null si no existe. */
export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('av_games')
    .select(GAME_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getGame: ${error.message}`);
  return (data as Game | null) ?? null;
}

/** `best` y `plays` por juego, desde `av_game_metrics`. */
export async function getGameMetrics(): Promise<GameMetrics[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('av_game_metrics')
    .select('game, best, plays');

  if (error) throw new Error(`getGameMetrics: ${error.message}`);
  return (data ?? []) as GameMetrics[];
}

/**
 * Top 12 de un juego. Se lee de `av_game_best` (una fila por jugador, ya sin
 * `INVITADO`), que el spec define como base del ranking. La posición es el
 * índice sobre ese conjunto ordenado por puntaje descendente.
 */
export async function getGameRanking(gameId: string): Promise<RankRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('av_game_best')
    .select('name, score, created_at')
    .eq('game', gameId)
    .order('score', { ascending: false })
    .limit(TOP);

  if (error) throw new Error(`getGameRanking: ${error.message}`);

  const rows = (data ?? []) as {
    name: string;
    score: number;
    created_at: string;
  }[];

  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    date: formatDate(r.created_at),
  }));
}

/** Ranking global: suma de los mejores puntajes por juego (top 12). */
export async function getGlobalRanking(): Promise<GlobalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('av_global_ranking')
    .select('name, total')
    .order('total', { ascending: false })
    .limit(TOP);

  if (error) throw new Error(`getGlobalRanking: ${error.message}`);

  const rows = (data ?? []) as { name: string; total: number }[];
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, total: r.total }));
}

/**
 * Mejor marca de un jugador en un juego, con su posición en ese ranking (el
 * mismo conjunto de `av_game_best`: una fila por jugador, sin `INVITADO`).
 * Devuelve null si el jugador no tiene puntajes (o si es una sesión anónima).
 */
export async function getPlayerBest(
  name: string,
  gameId: string,
): Promise<PlayerBest> {
  const supabase = await createClient();

  const { data: mine, error: mineError } = await supabase
    .from('av_game_best')
    .select('score')
    .eq('game', gameId)
    .eq('name', name)
    .maybeSingle();

  if (mineError) throw new Error(`getPlayerBest: ${mineError.message}`);
  if (!mine) return null;

  const myScore = (mine as { score: number }).score;

  // Posición: cuántos jugadores tienen mejor marca, +1.
  const { count, error: countError } = await supabase
    .from('av_game_best')
    .select('name', { count: 'exact', head: true })
    .eq('game', gameId)
    .gt('score', myScore);

  if (countError) throw new Error(`getPlayerBest: ${countError.message}`);

  return { rank: (count ?? 0) + 1, score: myScore };
}
