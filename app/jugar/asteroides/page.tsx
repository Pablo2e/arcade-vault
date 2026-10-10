import { AsteroidsGame } from '@/components/AsteroidsGame';

// Ruta dedicada para el único juego real de la plataforma.
// Es un componente 100% cliente (sin fetch ni `use cache`): no necesita
// `instant = false`. El segmento estático `asteroides` tiene prioridad en
// Next sobre la ruta dinámica `/jugar/[id]`, que sigue servindo el mock.
export default function AsteroidesPage() {
  return <AsteroidsGame />;
}
