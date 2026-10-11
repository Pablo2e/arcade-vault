'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';

// ===== SessionProvider — sesión mock en localStorage =====
// Claves idénticas a la plantilla: "av_user" y "av_scores".
// El estado inicial es null y localStorage se lee en useEffect tras montar
// para no romper la hidratación de SSR (decisión del spec).
// saveScore inserta en av_scores (Supabase); localStorage queda solo como
// respaldo para no perder la partida si la escritura falla (SPEC 06).

export type User = { name: string };

export type SavedScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

type SessionContextValue = {
  user: User | null;
  /** true mientras no se ha leído localStorage (hidratando) */
  ready: boolean;
  login: (user: User) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, 'at'>) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function readUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('av_user') || 'null');
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Lectura diferida a propósito: el estado inicial es null para no
    // romper la hidratación de SSR (decisión del spec).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readUser());
    setReady(true);
  }, []);

  const login = useCallback((u: User) => {
    setUser(u);
    try {
      localStorage.setItem('av_user', JSON.stringify(u));
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem('av_user');
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const saveScore = useCallback((entry: Omit<SavedScore, 'at'>) => {
    // Respaldo local: la partida nunca se pierde. Se usa solo si la
    // inserción en Supabase falla (red caída, RLS, etc.).
    const persistLocal = () => {
      try {
        const all: SavedScore[] = JSON.parse(
          localStorage.getItem('av_scores') || '[]',
        );
        all.push({ ...entry, at: Date.now() });
        localStorage.setItem('av_scores', JSON.stringify(all));
      } catch {
        /* almacenamiento no disponible */
      }
    };

    // Insert en av_scores con el cliente de navegador (fire-and-forget:
    // el modal ya muestra "guardada" y no espera por la red).
    void (async () => {
      try {
        const { error } = await createClient()
          .from('av_scores')
          .insert({ game: entry.game, name: entry.name, score: entry.score });
        if (error) persistLocal();
      } catch {
        persistLocal();
      }
    })();
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, login, signOut, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
