import { notFound } from 'next/navigation';
import { TetrisGame } from '@/components/TetrisGame';
import { getGame } from '@/lib/games';

// Ruta dedicada para el Tetris. El juego se lee de av_games y se pasa por
// props al componente cliente (SPEC 06/08). El segmento estático 'tetris'
// tiene prioridad sobre /jugar/[id] en Next.
export const instant = false;

export default async function TetrisPage() {
  const game = await getGame('tetris');
  if (!game) notFound();
  return <TetrisGame game={game} />;
}
