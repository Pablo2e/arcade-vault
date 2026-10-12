import { redirect } from 'next/navigation';

// Comodín de /jugar: sin mock (SPEC 09). Cualquier id con ruta estática
// (asteroides, tetris) gana este segmento; los demás se envían al detalle
// /juego/[id], que valida el id contra el catálogo y devuelve notFound() si
// no existe. Así /jugar nunca fabrica un simulacro de juego.
export const instant = false;

export default async function JugarPage({ params }: PageProps<'/jugar/[id]'>) {
  const { id } = await params;
  redirect(`/juego/${id}`);
}
