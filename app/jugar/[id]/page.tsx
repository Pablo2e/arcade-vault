import { notFound } from 'next/navigation';
import { Reproductor } from '@/components/Reproductor';
import { getGames } from '@/lib/games';

// Mismo criterio que /juego/[id]: el id se valida con notFound() contra av_games
// (getGames() usa cookies(), no disponible en generateStaticParams, así que se
// omite y la ruta queda dinámica).
export const instant = false;

export default async function JugarPage({ params }: PageProps<'/jugar/[id]'>) {
  const { id } = await params;
  const games = await getGames();
  const game = games.find((g) => g.id === id);
  if (!game) notFound();

  return <Reproductor game={game} />;
}
