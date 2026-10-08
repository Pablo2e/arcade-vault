import { notFound } from "next/navigation";
import { Reproductor } from "@/components/Reproductor";
import { GAMES } from "@/lib/data";

// Mismo criterio que /juego/[id]: params + notFound() bloquean,
// el segmento se declara no-instant (guía instant-navigation de Next 16).
export const instant = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ id: game.id }));
}

export default async function JugarPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  if (!GAMES.some((g) => g.id === id)) notFound();
  return <Reproductor id={id} />;
}
