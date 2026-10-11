import { getPlayerBest } from '@/lib/games';

/**
 * Mejor marca de un jugador en un juego (SPEC 06).
 *
 * El Salón necesita consultar la marca de la sesión, pero el nombre vive en
 * localStorage (cliente), y `getPlayerBest` usa el cliente de servidor. Este
 * route handler es el puente: el cliente hace fetch aquí y delega en la capa
 * de datos, sin duplicar la lógica de ranking.
 *
 * GET /api/player-best?game=<id>&name=<nombre>
 *   200 { best: { rank, score } | null }
 *   400 { best: null }  — faltan parámetros
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const game = searchParams.get('game');

  if (!name || !game) {
    return Response.json({ best: null }, { status: 400 });
  }

  const best = await getPlayerBest(name, game);
  return Response.json({ best });
}
