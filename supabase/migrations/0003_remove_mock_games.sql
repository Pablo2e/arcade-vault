-- ===== 0003_remove_mock_games.sql — retira las filas de relleno de av_games =====
-- SPEC 09: eliminar todo lo mockeado; el catálogo queda solo con juegos reales
-- ('asteroides', 'tetris'). Aplicar a mano en el SQL editor del dashboard (sin
-- CLI), igual que 0001/0002. Requiere rol postgres (RLS en av_games solo
-- permite SELECT con la anon/publishable key).
--
-- La siembra 0001 reutilizó las clases de cover para los rellenos: 'caida' usa
-- cover-tetro (la misma clase que hoy usa TETRIS) y 'bloque-buster' cover-bricks.
-- Borrar las 8 filas deja el catálogo con solo los juegos reales.
-- av_scores.game tiene on delete cascade: borrar una fila limpia sus puntajes
-- (eran generados por el mock Reproductor, sin valor).

delete from public.av_games
where id in (
  'bloque-buster',
  'caida',
  'serpentina',
  'gloton',
  'invasores',
  'rocas',
  'ranaria',
  'duelo-pixel'
);