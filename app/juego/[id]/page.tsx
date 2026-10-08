import { notFound } from "next/navigation";
import { Detalle } from "@/components/Detalle";
import { GAMES } from "@/lib/data";

// `await params` + `notFound()` bloquean la navegación: el segmento se
// declara no-instant para que la validación de Cache Components lo permita.
export const instant = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ id: game.id }));
}

export default async function JuegoPage({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  if (!GAMES.some((g) => g.id === id)) notFound();
  return <Detalle id={id} />;
}
