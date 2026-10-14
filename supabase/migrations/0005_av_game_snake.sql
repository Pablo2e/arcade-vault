-- Migration: Añadir juego SNAKE al catálogo av_games
-- SPEC 11 — Snake

insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'snake', 'SNAKE',
  'Clásico come-frutas',
  'Controla la serpiente, come frutas y crece sin chocar. Frutas del spritesheet Google Snake. 3 vidas, score por fruta.',
  'PUZZLE', 'cover-snake-sprite', 'green', 11
);