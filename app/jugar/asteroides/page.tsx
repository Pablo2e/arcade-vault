import { notFound } from 'next/navigation';
import { AsteroidsGame } from '@/components/AsteroidsGame';
import { getGame } from '@/lib/games';

// Ruta dedicada para el único juego real de la plataforma. El juego se lee de
// av_games y se pasa por props al componente cliente (SPEC 06).
export const instant = false;

export default async function AsteroidesPage() {
  const game = await getGame('asteroides');
  if (!game) notFound();
  return <AsteroidsGame game={game} />;
}
