import { notFound } from 'next/navigation';
import { ArkanoidGame } from '@/components/ArkanoidGame';
import { getGame } from '@/lib/games';

// Ruta dedicada para Arkanoid. El juego se lee de av_games y se pasa por props
// al componente cliente (SPEC 10).
export const instant = false;

export default async function ArkanoidPage() {
  const game = await getGame('arkanoid');
  if (!game) notFound();
  return <ArkanoidGame game={game} />;
}
