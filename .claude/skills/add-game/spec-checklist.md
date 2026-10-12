# Spec checklist for a game

Phase E of `/add-game` does **not** invent the spec format. It reads the repo's
own `/spec` skill and follows it. This file only adds the game-specific
content that the generic `/spec` method does not know about.

## First: follow the repo's /spec

Read and follow, literally:

- `.claude/skills/spec/SKILL.md` — the four phases, the section order, the rules,
  and the save step (next number, session date, `Borrador` state,
  `specs/.spec-config.yml` seeding).
- `.claude/skills/spec/template.md` — the section shape.
- The two most recent files in `specs/` — the repo writes specs in Spanish;
  match their state wording (`Borrador`/`Implementado`) and headings
  (`## Scope`, `## Data model`, `## Implementation plan`, `## Acceptance
criteria`, `## Decisions`, `## Risks`).

Write the result to `specs/NN-<slug>.md`, state `Borrador`.

## Game-specific additions

### Data model

Add a section mapping this game onto the shared contract
(`engine-contract.md`):

- The engine's public surface: `class <Game>Engine implements PlayableEngine` —
  `width`/`height`, `update`, `draw`, `input` (+ `pointer?`), `restart`,
  `endGame`, `getSnapshot`.
- Its `GameSnapshot`: the core fields plus what goes in `extra` (flat primitives
  only). One line per extra field and where it shows in the HUD.
- The new `av_games` row values (see `sql-seed.template.sql`): `id`, `title`,
  `short`, `long`, `cat`, `cover`, `color`, `sort`.

### Implementation plan

A runnable step order:

1. Engine `lib/<id>.ts` (apply `porting-guide.md` or scaffold from the contract).
2. Adapter `components/<Game>.tsx` — `useGameEngine` + `GameShell`, no game logic.
3. Route `app/jugar/<id>/page.tsx` — `export const instant = false;`.
4. Migration `supabase/migrations/000N_av_game_<id>.sql` — the `av_games` INSERT.
5. Assets (if any) → `public/games/<id>/`.
6. CSS polish inside the 4/3 CRT (layout decision for non-4:3 canvases).

### Acceptance criteria (always include these)

- [ ] `/jugar/<id>` mounts the game and responds to its controls; nothing fails in
      the console.
- [ ] The React HUD shows the game's live stats (score + the game's own tiles).
- [ ] PAUSA freezes the game and shows "EN PAUSA"; REANUDAR continues.
- [ ] FIN ends the run and opens the "FIN DEL JUEGO" modal with the final score.
- [ ] GUARDAR PUNTUACIÓN inserts a row into `av_scores` (name = session name or
      `INVITADO`) and shows "PUNTUACIÓN GUARDADA_".
- [ ] After saving, the score appears on `/juego/<id>` and in `/salon`; `INVITADO`
      is excluded from the rankings but counts in `plays`.
- [ ] Leaving the route (navigating away) releases the rAF loop and listeners (no
      accumulation across repeated visits).
- [ ] `/jugar/<other-id>` and `/games` are unchanged.
- [ ] `npx tsc --noEmit` and `npm run lint` are green.

Use the exact spec shape and wording of the existing specs; the list above is
content, not the format.

### Out of scope to name explicitly

Anything the reconnaissance surfaced but you are not porting (audio, theme
toggle, touch controls, the OVNI, multi-level selectors…), plus the standing
exclusions: server-side score validation, anti-cheat, real auth.
