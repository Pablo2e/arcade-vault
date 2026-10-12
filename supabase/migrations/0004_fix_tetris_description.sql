-- ===== 0004_fix_tetris_description.sql — corrige el texto del catálogo =====
-- SPEC 08. La octava pieza "N" (tuerca) se descartó del motor (solo las siete
-- canónicas), así que la descripción larga ya no debe mencionarla. La fila
-- `tetris` se insertó con la migración 0002 (texto viejo); este UPDATE la corrige.
--
-- Aplicar a mano en el SQL editor del dashboard de Supabase (sin CLI), igual que
-- 0001/0002/0003, PREVIA aprobación del usuario sobre el texto SQL.

update public.av_games
set long = 'Duérmete y la torre te entierra. Rota, desplaza y encaja las siete piezas para completar líneas antes de que lleguen al techo.'
where id = 'tetris';
