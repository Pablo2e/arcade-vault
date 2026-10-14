import { notFound } from 'next/navigation';
import { SnakeGame } from '@/components/SnakeGame';
import { getGame } from '@/lib/games';

// Ruta dedicada para Snake. El juego se lee de av_games y se pasa por props
// al componente cliente (SPEC 06/11).
export const instant = false;

export default async function SnakePage() {
  const game = await getGame('snake');
  if (!game) notFound();
  return <SnakeGame game={game} />;
}
