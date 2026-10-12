'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSnapshot, PlayableEngine, PointerInput } from '@/lib/engine';

// ===== lib/useGameEngine.ts — host del motor (SPEC 07) =====
// Conduce un PlayableEngine sobre uno o varios <canvas>: instancia el motor una
// vez por montaje, corre el bucle requestAnimationFrame (dt limitado a 50 ms),
// reenvía teclado y —si el juego lo pide— puntero, y sincroniza el snapshot al
// estado de React solo cuando cambia. La pausa vive aquí (vía ref) para no
// recrear el bucle ni los listeners a cada toggle.

type UseGameEngineOptions<S extends GameSnapshot> = {
  /** Fábrica del motor; se invoca una vez por montaje. */
  create: () => PlayableEngine<S>;
  /** Canvas donde dibuja el motor. */
  canvas: React.RefObject<HTMLCanvasElement | null>;
  /** Canvas secundarios (p. ej. el preview del siguiente Tetris). */
  extraCanvases?: React.RefObject<HTMLCanvasElement | null>[];
  /** Códigos de tecla a los que se les hace preventDefault. */
  playCodes?: string[];
  /** Escucha mousemove/mousedown/mouseup sobre el canvas → engine.pointer(). */
  pointer?: boolean;
  /** Snapshot inicial (y estado al que vuelve restart()). */
  initial: S;
};

export type UseGameEngine<S extends GameSnapshot> = {
  engine: React.RefObject<PlayableEngine<S> | null>;
  snapshot: S;
  paused: boolean;
  togglePause: () => void;
  end: () => void;
  restart: () => void;
};

/** Igualdad superficial de dos bolsas de primitivos planos. */
function sameExtra(
  a?: Record<string, number>,
  b?: Record<string, number>,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

export function useGameEngine<S extends GameSnapshot>(
  opts: UseGameEngineOptions<S>,
): UseGameEngine<S> {
  const engineRef = useRef<PlayableEngine<S> | null>(null);
  // Config "latest ref": el effect del bucle se monta una sola vez y lee de
  // aquí, sin meter objetos recreados en cada render en sus dependencias. La
  // escritura va en un effect (no en render: la regla react-hooks/refs).
  const configRef = useRef(opts);
  useEffect(() => {
    configRef.current = opts;
  });

  const pausedRef = useRef(false);
  const lastRef = useRef<S | null>(null);

  const [snapshot, setSnapshot] = useState<S>(opts.initial);
  const [paused, setPaused] = useState(false);

  // El bucle lee paused sin depender de él (evita recrear el effect).
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Bucle de juego + listeners. Se monta una sola vez.
  useEffect(() => {
    const { create, canvas, extraCanvases, playCodes, pointer } =
      configRef.current;

    if (!engineRef.current) engineRef.current = create();
    const engine = engineRef.current;

    const canvasEl = canvas.current;
    const ctx = canvasEl?.getContext('2d');
    if (!canvasEl || !ctx) return;

    const extraCtx = (extraCanvases ?? [])
      .map((ref) => ref.current?.getContext('2d'))
      .filter((c): c is CanvasRenderingContext2D => Boolean(c));

    const codes = new Set(playCodes ?? []);

    const onKeyDown = (e: KeyboardEvent) => {
      // Las teclas del juego no deben hacer scroll de la página.
      if (codes.has(e.code)) e.preventDefault();
      engine.input(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      engine.input(e.code, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Puntero opcional (Arkanoid): coordenadas escaladas al sistema interno.
    let onMove: ((e: MouseEvent) => void) | undefined;
    let onDown: ((e: MouseEvent) => void) | undefined;
    let onUp: ((e: MouseEvent) => void) | undefined;
    if (pointer && engine.pointer) {
      const send = engine.pointer.bind(engine);
      const toInput = (
        e: MouseEvent,
        kind: PointerInput['kind'],
      ): PointerInput => {
        const rect = canvasEl.getBoundingClientRect();
        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
          kind,
        };
      };
      onMove = (e) => send(toInput(e, 'move'));
      onDown = (e) => send(toInput(e, 'down'));
      onUp = (e) => send(toInput(e, 'up'));
      canvasEl.addEventListener('mousemove', onMove);
      canvasEl.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
    }

    // Diff superficial → setState solo en cambios (no re-render a 60 fps).
    const sync = () => {
      const s = engine.getSnapshot();
      const last = lastRef.current;
      if (
        !last ||
        s.score !== last.score ||
        s.lives !== last.lives ||
        s.level !== last.level ||
        s.over !== last.over ||
        !sameExtra(s.extra, last.extra)
      ) {
        lastRef.current = s;
        setSnapshot(s);
      }
    };

    let raf = 0;
    let last = performance.now();

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((ts - last) / 1000, 0.05); // dt limitado a 50 ms
      last = ts;
      // La pausa congela update Y draw: el último frame queda en el canvas y
      // el overlay EN PAUSA lo cubre.
      if (!pausedRef.current) {
        engine.update(dt);
        engine.draw(ctx, extraCtx);
      }
      sync();
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (onMove) canvasEl.removeEventListener('mousemove', onMove);
      if (onDown) canvasEl.removeEventListener('mousedown', onDown);
      if (onUp) window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const end = useCallback(() => {
    engineRef.current?.endGame();
    lastRef.current = null;
    setSnapshot((s) => ({ ...s, over: true }));
  }, []);

  const restart = useCallback(() => {
    engineRef.current?.restart();
    lastRef.current = null;
    setSnapshot(configRef.current.initial);
    setPaused(false);
  }, []);

  return { engine: engineRef, snapshot, paused, togglePause, end, restart };
}
