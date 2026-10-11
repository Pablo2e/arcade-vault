import { Biblioteca } from '@/components/Biblioteca';
import { getGameMetrics, getGames } from '@/lib/games';

// Catálogo y métricas se leen de av_games / av_game_metrics en cada request.
export const instant = false;

export default async function GamesPage() {
  const [games, metrics] = await Promise.all([getGames(), getGameMetrics()]);
  return <Biblioteca games={games} metrics={metrics} />;
}
