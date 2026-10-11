import { Salon } from '@/components/Salon';
import { getGameRanking, getGames, getGlobalRanking } from '@/lib/games';

// El leaderboard es dato vivo: lee av_scores en cada request, sin cachear.
// Se opta fuera de la validación de navegación instantánea (mismo criterio
// que /juego/[id] y /jugar/[id] en este repo).
export const instant = false;

export default async function SalonPage() {
  const games = await getGames();

  const [globalRows, ...perGame] = await Promise.all([
    getGlobalRanking(),
    ...games.map((g) => getGameRanking(g.id)),
  ]);

  const rankings: Record<
    string,
    Awaited<ReturnType<typeof getGameRanking>>
  > = {};
  games.forEach((g, i) => {
    rankings[g.id] = perGame[i];
  });

  return <Salon games={games} rankings={rankings} globalRows={globalRows} />;
}
