const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Smoke test de la conexión con Supabase (SPEC 04).
 *
 * No lee ni escribe tablas: solo comprueba que las env vars están presentes y
 * que el endpoint de salud de Supabase responde con la publishable key. Con
 * `cacheComponents`, el `fetch` hace que la ruta se ejecute en request time.
 *
 * 200 { ok: true }                  — env vars presentes y Supabase respondió
 * 500 { ok: false, error: string }  — faltan env vars, o el fetch falló
 */
export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json(
      {
        ok: false,
        error:
          'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno.',
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_KEY },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error: `Supabase respondió ${res.status} ${res.statusText}`,
        },
        { status: 500 },
      );
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error desconocido al conectar con Supabase',
      },
      { status: 500 },
    );
  }
}
