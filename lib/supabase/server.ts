import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para Server Components y route handlers.
 *
 * Crea uno nuevo por request (nunca se comparte entre requests). Lee las
 * cookies de la petición y escribe las actualizadas cuando Supabase refresca
 * la sesión. En un Server Component `setAll` no puede escribir cookies; ahí el
 * fallo se ignora porque el refresco de sesión es responsabilidad del
 * middleware (que llega con el spec de auth).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Llamado desde un Server Component: no se pueden setear cookies.
            // El middleware refresca la sesión cuando exista (spec de auth).
          }
        },
      },
    },
  );
}
