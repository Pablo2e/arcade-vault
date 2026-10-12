-- ===== Seed de una fila nueva en el catálogo av_games =====
-- Aplicar a mano en el SQL editor del dashboard de Supabase (sin CLI),
-- igual que la migración base 0001_av_games_scores.sql (SPEC 06).
-- Guardar el archivo como supabase/migrations/000N_av_game_<id>.sql.

-- Restricciones de av_games (verificadas en 0001_av_games_scores.sql):
--   cat   in ('ARCADE','PUZZLE','SHOOTER','VERSUS')      -- obligatorio
--   color in ('cyan','magenta','yellow','green')          -- obligatorio
--   cover text not null (sin check; usar una clase cover-* de app/globals.css
--                        o crear una nueva)
--   sort  integer not null (siguiente libre; hoy el máximo es 8)
--   id    text primary key  ===  segmento de ruta /jugar/<id>

-- ⚠️  Reusar una fila existente (p. ej. 'caida' / 'bloque-buster') es una
--     decisión de la Fase C; NO la tomes por defecto. El patrón de SPEC 05
--     fue AÑADIR una fila nueva ('asteroides') y dejar las de relleno intactas.

insert into public.av_games (id, title, short, long, cat, cover, color, sort)
values (
  '<id>',                                   -- id/segmento de ruta, kebab-case, único
  '<TITLE>',                                -- título en mayúsculas, como el resto
  '<Frase corta de una línea.>',            -- `short`
  '<Descripción larga de 2-3 frases.>',     -- `long`
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>',
  'cover-<x>',                              -- cover-* existente o nueva clase CSS
  '<cyan|magenta|yellow|green>',
  9                                         -- sort; el siguiente libre tras 0…8
);

-- av_scores no se siembra: el leaderboard se llena al guardar partidas
-- (saveScore inserta con el cliente de navegador; fallback a localStorage).
