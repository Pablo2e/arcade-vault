-- ===== SPEC 06 — Leaderboard y tabla de juegos en Supabase =====
-- Catálogo (av_games) + puntajes (av_scores), índices, RLS, vistas y seed.
-- Se aplica a mano en el SQL editor del dashboard de Supabase (sin CLI).

-- ---------------------------------------------------------------------------
-- Catálogo (fuente de verdad; antes era GAMES de lib/data.ts)
-- ---------------------------------------------------------------------------
create table public.av_games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort       integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Puntajes (antes: mock determinista + localStorage "av_scores")
-- ---------------------------------------------------------------------------
create table public.av_scores (
  id         bigint generated always as identity primary key,
  game       text not null references public.av_games(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  score      integer not null check (score between 0 and 100000000),
  created_at timestamptz not null default now()
);

create index av_scores_game_score_idx on public.av_scores (game, score desc);
create index av_scores_name_idx on public.av_scores (name);

-- ---------------------------------------------------------------------------
-- RLS: lectura pública; insert anónimo solo en puntajes
-- ---------------------------------------------------------------------------
alter table public.av_games  enable row level security;
alter table public.av_scores enable row level security;

create policy av_games_read on public.av_games
  for select to anon, authenticated using (true);

create policy av_scores_read on public.av_scores
  for select to anon, authenticated using (true);

create policy av_scores_insert on public.av_scores
  for insert to anon, authenticated with check (true);
-- Sin policies de update/delete: los puntajes no se editan ni se borran desde la app.

-- ---------------------------------------------------------------------------
-- Vistas (security_invoker = true para respetar el RLS de las tablas base)
-- ---------------------------------------------------------------------------

-- Mejor puntaje por (juego, jugador), sin INVITADO. Base del ranking.
create view public.av_game_best with (security_invoker = true) as
select distinct on (game, name) game, name, score, created_at
from public.av_scores
where name <> 'INVITADO'
order by game, name, score desc, created_at asc;

-- Métricas por juego: best excluye INVITADO, plays cuenta todas las partidas.
create view public.av_game_metrics with (security_invoker = true) as
select g.id as game,
       coalesce((select max(b.score) from public.av_game_best b where b.game = g.id), 0) as best,
       (select count(*) from public.av_scores s where s.game = g.id) as plays
from public.av_games g;

-- Ranking global: suma de los mejores puntajes por juego de cada jugador.
create view public.av_global_ranking with (security_invoker = true) as
select name, sum(score) as total
from public.av_game_best
group by name
order by total desc;

-- ---------------------------------------------------------------------------
-- Seed del catálogo: las 9 entradas de lib/data.ts, con sort 0…8
-- (el array GAMES está en este mismo orden). av_scores arranca vacía.
-- ---------------------------------------------------------------------------
insert into public.av_games (id, title, short, long, cat, cover, color, sort) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?', 'ARCADE', 'cover-bricks', 'cyan', 0),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.', 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', 1),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.', 'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.', 'ARCADE', 'cover-snake', 'green', 2),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', 3),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', 4),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.', 'SHOOTER', 'cover-rocas', 'yellow', 5),
  ('asteroides', 'ASTEROIDES', 'Pulveriza rocas en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños.', 'SHOOTER', 'cover-rocas', 'yellow', 6),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.', 'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.', 'ARCADE', 'cover-rana', 'green', 7),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.', 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.', 'VERSUS', 'cover-duelo', 'cyan', 8);
