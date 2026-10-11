import { Home } from '@/components/Home';
import { getGames } from '@/lib/games';

// El preview de juegos del landing sale de av_games.
export const instant = false;

export default async function Page() {
  const games = await getGames();
  return <Home games={games} />;
}
