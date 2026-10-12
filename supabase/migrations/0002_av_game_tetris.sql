-- ===== 0002_av_game_tetris.sql — fila nueva en el catálogo av_games =====
-- SPEC 08. Aplicar a mano en el SQL editor del dashboard de Supabase (sin CLI),
-- igual que la migración base 0001_av_games_scores.sql (SPEC 06).
-- Patrón de SPEC 05: se AÑADE una ficha nueva y se dejan las de relleno
-- ('caida', PUZZLE, cover-tetro, sort 1) intactas.
--
-- Restricciones verificadas en 0001:
--   cat   in ('ARCADE','PUZZLE','SHOOTER','VERSUS')
--   color in ('cyan','magenta','yellow','green')
--   cover text (sin check); se reutiliza la clase cover-tetro de app/globals.css
--   sort  entero (siguiente libre tras 0…8)

insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  'tetris',
  'TETRIS',
  'Alinea filas y encadena tetrominós.',
  'Duérmete y la torre te entierra. Rota, desplaza y encaja las siete piezas (y una octava tuerca) para completar líneas antes de que lleguen al techo.',
  'PUZZLE',
  'cover-tetro',
  'magenta',
  9
);

-- av_scores no se siembra: el leaderboard se llena al guardar partidas.