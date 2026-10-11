# SPEC 06 — Leaderboard y tabla de juegos en Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02, SPEC 04, SPEC 05
> **Date:** 2026-10-11
> **Objective:** Crear las tablas `av_games` y `av_scores` en Supabase y servir desde ahí un leaderboard real (por juego y global) y el guardado de puntuaciones, reemplazando los mocks deterministas del Salón y del Detalle.

## Por qué existe este spec

La plataforma promete "competir por la mayor cantidad de puntos", pero hoy no compite nadie: `/salon` y `components/Detalle.tsx` pintan un ranking inventado con `seededScores()` (PRNG determinista sobre `PLAYERS`), el catálogo es el array estático `GAMES` de `lib/data.ts`, y `SessionProvider.saveScore` escribe en `localStorage` bajo `av_scores` sin que ninguna pantalla lo lea jamás. SPEC 04 dejó fuera de scope a propósito "tablas, migraciones, RLS" y "puntuaciones del Salón en BD". Este es el spec que las crea: convierte el catálogo en una tabla de Supabase, guarda los puntajes reales, y hace que el Salón y las fichas muestren datos verdaderos en vez de ruido generado. La decisión no obvia es que el catálogo deja de ser código y pasa a ser datos — lo que obliga a sembrar `av_games` con las 9 entradas actuales y a que las pantallas que hoy importan `GAMES` pasen a leer de la BD.

## Scope

**In:**

- Migración SQL versionada en `supabase/migrations/0001_av_games_scores.sql` (aplicada a mano en el dashboard; sin CLI) con:
  - Tabla `public.av_games` (catálogo) y `public.av_scores` (puntajes).
  - Índices para ranking por `(game, score desc)` y búsqueda por `name`.
  - RLS activado en ambas tablas: `select` público para `anon`/`authenticated`; `insert` público solo en `av_scores`; sin `update`/`delete`.
  - Vistas `av_game_best` (mejor puntaje por jugador y juego, excluyendo `INVITADO`), `av_game_metrics` (`best` y `plays` por juego) y `av_global_ranking` (suma de mejores por jugador), con `security_invoker = true`.
  - `INSERT` de las 9 entradas de `lib/data.ts` en `av_games`. `av_scores` arranca **vacía**.
- Capa de datos de servidor `lib/games.ts`: funciones tipadas `getGames()`, `getGame(id)`, `getGameMetrics()`, `getGameRanking(gameId)`, `getGlobalRanking()` y `getPlayerBest(name, gameId)`, sobre `lib/supabase/server.ts`.
- `saveScore` de `components/SessionProvider.tsx` pasa a insertar en `av_scores` con el cliente de navegador; si la escritura falla, mantiene el respaldo en `localStorage` (`av_scores`) para no perder la partida.
- Reescribir `components/Salon.tsx` y `app/salon/page.tsx` para leer datos reales: podio, tabla por juego con tabs y un tab **GLOBAL** (suma de los mejores puntajes por juego de cada jugador). La fila "▸ TU MEJOR MARCA" se conserva, consultada desde el cliente para el nombre de la sesión.
- `components/Detalle.tsx` y `app/juego/[id]/page.tsx` pasan a leer el juego y su ranking real de la BD (adiós `seededScores`).
- `app/games/page.tsx` + `components/Biblioteca.tsx`, `components/Home.tsx`, `components/Reproductor.tsx` y `components/AsteroidsGame.tsx` reciben el catálogo desde la BD: las páginas de servidor le hacen `fetch` y lo pasan por props a los componentes cliente. `best` y `plays` de cada card salen de `av_game_metrics`.
- `app/jugar/[id]/page.tsx` y `app/juego/[id]/page.tsx`: `generateStaticParams` y la validación `notFound()` pasan a usar los ids de `av_games`.
- Limpieza de `lib/data.ts`: se retiran `GAMES`, `PLAYERS`, `seededScores` y `ScoreRow` (los mocks). Se conserva `CATS` (constantes de UI) y el tipo `Game` si sigue usándose.
- Antes de escribir nada, leer en `node_modules/next/dist/docs/` las guías de Server Components, caching (`cacheComponents`), route handlers y cookies que indica CLAUDE.md.

**Out of scope (for future specs):**

- Autenticación real (signup/login/sesión en el Nav): sigue el login mock de `SessionProvider`.
- Anti-cheat, validación o sanitización del puntaje en servidor: el cliente declara su puntaje, igual que hoy.
- Service role key en cualquier parte.
- Docker/CLI de Supabase, tests automatizados, Realtime, Storage.
- Portar los juegos restantes (`03-tetris`, `04-arkanoid`, etc.): cada uno en su spec.
- Cambios visuales al diseño de `/salon`, `/games` o `/juego/*`: este spec cambia de dónde vienen los datos, no cómo se ven.
- Paginación del leaderboard más allá del top 12.

## Data model

Migración `supabase/migrations/0001_av_games_scores.sql` (aplicada manualmente en el SQL editor del dashboard):

```sql
-- Catálogo (fuente de verdad; antes era GAMES de lib/data.ts)
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

-- Puntajes (antes: mock determinista + localStorage "av_scores")
create table public.av_scores (
  id         bigint generated always as identity primary key,
  game       text not null references public.av_games(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  score      integer not null check (score between 0 and 100000000),
  created_at timestamptz not null default now()
);

create index av_scores_game_score_idx on public.av_scores (game, score desc);
create index av_scores_name_idx on public.av_scores (name);
```

```sql
-- RLS: lectura pública; insert anónimo solo en puntajes
alter table public.av_games  enable row level security;
alter table public.av_scores enable row level security;

create policy av_games_read on public.av_games
  for select to anon, authenticated using (true);

create policy av_scores_read on public.av_scores
  for select to anon, authenticated using (true);

create policy av_scores_insert on public.av_scores
  for insert to anon, authenticated with check (true);
-- Sin policies de update/delete: los puntajes no se editan ni se borran desde la app.
```

```sql
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
```

`INSERT` de las 9 entradas actuales en `av_games` (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color` de `lib/data.ts`, con `sort` 0…8 en el orden del array). `av_scores` no se siembra.

Tipos en la app (en `lib/games.ts`):

```ts
export type GameMetrics = { game: string; best: number; plays: number };
export type RankRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};
export type GlobalRow = { rank: number; name: string; total: number };
export type PlayerBest = { rank: number; score: number } | null;
```

Convenciones heredadas:

- Nombres de puntaje tal cual los escribe `saveScore`: el nombre de la sesión o `"INVITADO"`.
- `date` se formatea `dd/mm/aaaa` en `lib/games.ts` (lo que hoy produce `seededScores`), no en los componentes.
- Top del ranking: 12 filas (lo que hoy pide el Salón); el podio usa las 3 primeras.

## Implementation plan

1. **Migración y seed.** Escribir `supabase/migrations/0001_av_games_scores.sql` (tablas, índices, RLS, vistas, seed de `av_games`). Aplicarlo en el SQL editor del dashboard. Verificar: `select count(*) from av_games` → 9; `select count(*) from av_scores` → 0; `GET $SUPABASE_URL/rest/v1/av_games?select=id` con la publishable key devuelve las 9 filas; un `POST` a `av_scores` con `{"game":"asteroides","name":"TEST","score":100}` devuelve 201 y luego se borra desde el dashboard.
2. **Capa de datos.** Crear `lib/games.ts` con `getGames()`, `getGame(id)`, `getGameMetrics()`, `getGameRanking(gameId)`, `getGlobalRanking()` y `getPlayerBest(name, gameId)`, todas sobre el cliente de servidor (`lib/supabase/server.ts`) y devolviendo los tipos de arriba. Verificar: `npx tsc --noEmit` y `npm run lint` en verde; las funciones importan sin efectos secundarios.
3. **Guardado real.** En `components/SessionProvider.tsx`, `saveScore` inserta en `av_scores` con el cliente de navegador y, si la inserción falla, mantiene la escritura en `localStorage`. Verificar: jugar Asteroides, guardar, y ver la fila nueva en `av_scores` desde el dashboard; con la URL de Supabase inalcanzable, la entrada igual queda en `localStorage`.
4. **Salón.** Reescribir `app/salon/page.tsx` (server) para traer juegos, rankings y global, y `components/Salon.tsx` para recibirlos por props: tabs por juego + tab **GLOBAL**, podio, tabla y fila "▸ TU MEJOR MARCA" consultada desde el cliente. Verificar: `/salon` lista el ranking real por juego y el GLOBAL; con `av_scores` vacía muestra un estado vacío en vez de crashear.
5. **Detalle.** `app/juego/[id]/page.tsx` trae el juego y su ranking de la BD y los pasa a `components/Detalle.tsx`; se retira `seededScores`. Verificar: `/juego/asteroides` muestra el `best`/`plays` reales y la tabla de puntajes de la BD (o vacío).
6. **Catálogo en pantallas.** `app/games/page.tsx` trae los juegos y sus métricas y los pasa a `components/Biblioteca.tsx`; `components/Home.tsx` recibe el preview de juegos; `components/Reproductor.tsx` y `components/AsteroidsGame.tsx` reciben el juego por props desde su página. Verificar: `/games` muestra las cards con `MEJOR PUNTUACIÓN` y `PARTIDAS` de `av_game_metrics`; `/`, `/jugar/asteroides` y `/jugar/rocas` siguen funcionando.
7. **Rutas dinámicas.** `app/juego/[id]/page.tsx` y `app/jugar/[id]/page.tsx` construyen `generateStaticParams` y la validación `notFound()` desde `getGames()`; revisar la interacción con `cacheComponents` / `instant = false` en `node_modules/next/dist/docs/` y ajustar si hace falta. Verificar: `/juego/<id inexistente>` da 404; los ids reales navegan bien.
8. **Limpieza.** Retirar `GAMES`, `PLAYERS`, `seededScores` y `ScoreRow` de `lib/data.ts` (conservar `CATS` y `Game` si siguen usándose). Verificar: `grep -rn "seededScores\|PLAYERS" app components lib` sin resultados; `npx tsc --noEmit` y `npm run lint` en verde.

## Acceptance criteria

- [ ] `supabase/migrations/0001_av_games_scores.sql` existe y crea `av_games`, `av_scores`, sus índices, RLS, las tres vistas y el seed de 9 juegos.
- [ ] Tras aplicar la migración, `select count(*) from av_games` devuelve 9 y `av_scores` está vacía.
- [ ] La publishable key puede leer `av_games` y `av_scores` por REST; no puede hacer `UPDATE` ni `DELETE` en ninguna tabla.
- [ ] `insert` anónimo en `av_scores` funciona; `insert` en `av_games` es rechazado por RLS.
- [ ] `lib/games.ts` exporta `getGames`, `getGame`, `getGameMetrics`, `getGameRanking`, `getGlobalRanking` y `getPlayerBest`, todas tipadas.
- [ ] `/games` renderiza las cards del catálogo leyendo de `av_games`, con `MEJOR PUNTUACIÓN` y `PARTIDAS` de `av_game_metrics` (0 y 0 con la tabla vacía).
- [ ] `best` de un juego excluye a `INVITADO`; `plays` cuenta todas las partidas, incluidas las anónimas.
- [ ] `/juego/<id>` muestra el ranking real de ese juego leído de `av_scores`, y el detalle del juego leído de `av_games`.
- [ ] `/salon` muestra el ranking real por juego y un tab **GLOBAL** que ordena por la suma de los mejores puntajes por juego de cada jugador.
- [ ] `INVITADO` no aparece en ningún ranking (por juego ni global); sus partidas sí cuentan en `plays`.
- [ ] Con sesión activa, `/salon` muestra la fila "▸ TU MEJOR MARCA" con el mejor puntaje real del jugador en el juego activo.
- [ ] Guardar una partida de Asteroides inserta una fila en `av_scores` (nombre = sesión o `INVITADO`).
- [ ] Si Supabase no responde, guardar la partida no crashea y la entrada queda en `localStorage` (`av_scores`).
- [ ] Con `av_scores` vacía, `/salon`, `/juego/*` y `/games` muestran estados vacíos/cero sin errores en consola.
- [ ] `/`, `/auth`, `/jugar/asteroides`, `/jugar/rocas`, `/sobre-nosotros` siguen navegando y renderizando igual; `Nav.tsx` intacto.
- [ ] `lib/data.ts` ya no exporta `GAMES`, `PLAYERS`, `seededScores` ni `ScoreRow`, y ninguna pantalla importa de ahí el catálogo.
- [ ] `npx tsc --noEmit` y `npm run lint` terminan sin errores.
- [ ] El repo no contiene valores reales de Supabase fuera de `.env.local`.

## Decisions

- **Sí:** un solo spec para leaderboard y tabla de juegos (decisión del usuario). Comparten la misma fuente (Supabase) y el mismo cambio de "catálogo como datos", así que se implementan en una pasada.
- **Sí:** `av_games` es la fuente de verdad del catálogo (decisión del usuario sobre convivir con `GAMES`). `lib/data.ts` queda como semilla histórica; las pantallas leen de la BD.
- **Sí:** SQL versionado en `supabase/migrations/` aplicado a mano en el dashboard (decisión del usuario sobre CLI o solo-dashboard). Mantiene SPEC 04 sin CLI y deja el esquema reproducible en el repo.
- **Sí:** leaderboard en Supabase, no en `localStorage` (decisión del usuario). Es la única forma de que compitan jugadores distintos; `localStorage` solo vería este navegador.
- **Sí:** `saveScore` escribe en Supabase con fallback a `localStorage` (decisión del usuario). Un fallo de red no debe descartar la partida del jugador.
- **Sí:** ranking global = suma del mejor puntaje de cada juego por jugador (decisión del usuario sobre suma total o mejor único). Premia la excelencia en varios juegos y no se infla jugando el mismo título.
- **Sí:** `best` y `plays` calculados desde `av_scores` (decisión del usuario sobre columnas estáticas). Datos vivos; `av_games` no duplica contadores que pueden quedar desincronizados.
- **Sí:** `best` excluye `INVITADO`; `plays` cuenta todas las partidas (decisión del usuario). Coherente con dejar a los anónimos fuera del ranking sin dejar de medir actividad.
- **Sí:** `INVITADO` se guarda pero se excluye de los rankings (decisión del usuario). Evita agrupar a todos los anónimos en una sola fila gigante.
- **Sí:** lectura desde Server Components (decisión del usuario sobre client-side). Coherente con `cacheComponents` y CLAUDE.md, y deja el leaderboard como dato de servidor.
- **Sí:** `/salon` se reescribe con un tab **GLOBAL** (decisión del usuario sobre una ruta `/leaderboard` nueva). Conserva ruta, podio y tabs existentes.
- **Sí:** `av_scores` arranca vacía (decisión del usuario sobre sembrar partidas demo). Sin datos falsos en la BD; los estados vacíos se ven.
- **Sí:** se conserva "▸ TU MEJOR MARCA" con query del cliente (decisión del usuario sobre retirarla). El nombre de sesión vive en `localStorage`, así que la consulta es naturalmente de cliente.
- **Sí:** las vistas usan `security_invoker = true`. Sin ello correrían con permisos del dueño y saltarían el RLS de las tablas subyacentes.
- **No:** autenticación real. Es un spec propio; aquí el `name` sigue viniendo de la sesión mock.
- **No:** anti-cheat o validación de puntaje en servidor. El cliente declara el puntaje, igual que el mock actual.
- **No:** paginación del leaderboard. Top 12 es lo que muestran hoy las pantallas.
- **No:** tocar el diseño de las pantallas. Solo cambia de dónde vienen los datos.
- **No:** service role key, Realtime, Storage, CLI o tests automatizados.

## Risks

| Riesgo                                                                         | Mitigación                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS mal configurado deja `av_games` escribible o expone filas de más.          | Policies mínimas (select en ambas, insert solo en `av_scores`); criterios de aceptación prueban que el `UPDATE`/`DELETE` y el `insert` en `av_games` fallan con la publishable key. |
| `insert` anónimo abierto permite spam de puntajes.                             | Fuera de scope el anti-cheat (spec propio); el `check` de `score` y `name` acota el daño. Se documenta como riesgo aceptado.                                                        |
| `cacheComponents: true` cachea el leaderboard y muestra datos viejos.          | Leer la guía de caching en `node_modules/next/dist/docs/` antes del paso 4; el ranking se sirve como dinámico, no como contenido cacheado estático.                                 |
| Las vistas corren con permisos del dueño y saltan RLS.                         | `with (security_invoker = true)` en las tres vistas; además excluyen `INVITADO` explícitamente.                                                                                     |
| Migrar el catálogo a BD desincroniza las pantallas que importan `GAMES`.       | El paso 6 las pasa una por una a props desde el servidor; el paso 8 solo retira los símbolos cuando el `grep` de consumidores está vacío.                                           |
| Un fallo de red en `saveScore` pierde la partida.                              | Fallback a `localStorage`; criterio de aceptación cubre Supabase inalcanzable.                                                                                                      |
| `/salon`, `/games` y `/juego/*` crashean o se ven rotos con `av_scores` vacía. | Criterio de aceptación explícito de estado vacío; las vistas devuelven 0/[] en vez de `null`.                                                                                       |

## What is **not** in this spec

- Autenticación real (sigue el login mock de `SessionProvider`).
- Anti-cheat, validación o sanitización de puntajes en servidor.
- Service role key, Realtime, Storage, CLI de Supabase.
- Portar los juegos restantes del catálogo.
- Rediseño visual de `/salon`, `/games` o `/juego/*`.
- Paginación del leaderboard más allá del top 12.
- Tests automatizados.

Cada uno de estos, si llega, va en su propio spec.
