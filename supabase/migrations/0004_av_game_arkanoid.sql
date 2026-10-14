-- Migration: Añadir juego ARKANOID al catálogo av_games
-- SPEC 10 — Arkanoid

insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'arkanoid', 'ARKANOID',
  'Rompe bloques con la bola y el paddle.',
  'Controla el paddle, devuelve la bola y destruye todos los bloques en 5 niveles de dificultad creciente. 3 vidas, sin power-ups, solo reflejos puros.',
  'ARCADE', 'cover-arkanoid', 'cyan', 10
);