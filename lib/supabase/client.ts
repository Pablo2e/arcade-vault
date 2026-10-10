import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para componentes de cliente ("use client").
 *
 * Devuelve un singleton por pestaña: `createBrowserClient` reutiliza la misma
 * instancia entre llamadas, así que se puede invocar sin costo desde cualquier
 * componente. La sesión se persiste en cookies para que el servidor pueda leerla.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
