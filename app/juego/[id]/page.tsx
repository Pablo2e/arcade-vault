import { notFound } from 'next/navigation';
import { Detalle } from '@/components/Detalle';
import { getGameMetrics, getGameRanking, getGames } from '@/lib/games';

// El ranking es dato vivo: la ficha y su leaderboard se leen en cada request.
//
// Sin `generateStaticParams` a propósito: los ids salen de av_games, pero
// getGames() usa el cliente de servidor (cookies()) y Next no permite cookies()
// dentro de generateStaticParams (se ejecuta en build sin request). La ruta es
// dinámica igualmente (rankings vivos); la validación del id se hace aquí con
// notFound() desde av_games (fuente de verdad del catálogo).
export const instant = false;

export default async function JuegoPage({ params }: PageProps<'/juego/[id]'>) {
  const { id } = await params;
  const [games, ranking, metrics] = await Promise.all([
    getGames(),
    getGameRanking(id),
    getGameMetrics(),
  ]);

  const game = games.find((g) => g.id === id);
  if (!game) notFound();

  const gameMetrics = metrics.find((m) => m.game === id) ?? {
    game: id,
    best: 0,
    plays: 0,
  };

  return <Detalle game={game} metrics={gameMetrics} ranking={ranking} />;
}
