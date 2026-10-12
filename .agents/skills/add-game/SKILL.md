---
name: add-game
description: Integrates a playable game into Arcade Vault end to end — a pure PlayableEngine in lib/, a React shell built on the shared GameShell + useGameEngine, a static route under app/jugar/, and its av_games catalog row so its leaderboard works. Ports a reference game from references/started-games/ (DOM-decoupling surgery) or scaffolds an original game against the engine contract. Writes a spec under specs/NN-slug.md (following the repo's /spec skill) and implements it step by step.
disable-model-invocation: true
argument-hint: '<reference game (e.g. 03-tetris) or game id>'
allowed-tools: Read, Glob, Grep, Write, Edit, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(npx tsc:*), Bash(npm run lint:*)
---

# /add-game — Integrate a game into the Vault

## Session context

Today's date (use it for the spec header, never guess it):
!`date +%F`

Reference games available:
!`ls references/started-games/ 2>/dev/null || echo "none"`

Existing specs:
!`ls specs/ 2>/dev/null`

Existing /jugar routes:
!`ls app/jugar/ 2>/dev/null`

Shared layer present?
!`ls components/GameShell.tsx lib/engine.ts lib/useGameEngine.ts 2>/dev/null || echo "NO — build it first (Phase D)"`

Current branch / tree:
!`git branch --show-current` / !`git status --short`

Branch config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default)"`

---

A game is not "done" when it runs on screen. It is done when it has its
leaderboard, its `av_games` catalog row, and it reuses the shared chrome.
This skill encodes the pattern proven by SPEC 05 (port a game) and SPEC 06
(catalog + leaderboard in Supabase): engine in `lib/`, shell in
`components/`, static route in `app/jugar/<id>/`, row in `av_games`.

Your replies must be in the same language as the user's prompt.

Read, in the same directory as this skill: `engine-contract.md`,
`porting-guide.md`, `spec-checklist.md`, `sql-seed.template.sql`, and the
per-game note under `games/`.

## Two sources

- **Reference port** — the game lives in `references/started-games/<NN-game>/`
  as vanilla HTML5 canvas + JS. Apply the DOM-decoupling surgery from
  `porting-guide.md`.
- **Original** — no reference folder. Scaffold directly against the
  `PlayableEngine` contract in `engine-contract.md`.

## Phase A — Identify the game

Resolve `$ARGUMENTS` against `references/started-games/`: by full folder name
(`03-tetris`), number (`03`) or slug (`tetris`). If it does not match and is not
an obviously-original game id, list the references and ask. If it matches
`02-asteroids`, say it is already ported and offer it as the contract reference
— do not port it again. If `$ARGUMENTS` is empty, ask for the game.

## Phase B — Reconnaissance (reference) or design (original)

Reference: read `games/<id>.md` first, then the real files (`index.html`,
`game.js`, `levels.js`, `assets/*`, `README.md`). Echo a structured summary:
logical canvas size(s) and aspect; input model (key codes, pointer,
`preventDefault` needs); assets and paths; DOM calls inside the game logic
(`getElementById`, `getComputedStyle`, `new Audio`, `new Image`); HUD fields and
their source variables; end states (`gameover`/`win`); cultural constants to
preserve verbatim (scoring tables, level formulas, piece sets).

Original: sketch the top-level entities, the snapshot fields, and the controls.

## Phase C — Clarify (blocks of 3–5, use AskUserQuestion)

Always cover: (1) reuse an existing catalog row (`caida`, `bloque-buster`) or
add a new one (recommended — the SPEC 05 precedent)? (2) `id` / route segment
(unique, kebab-case, equals `/jugar/<id>`); (3) `cat` ∈ ARCADE/PUZZLE/SHOOTER/
VERSUS, `color` ∈ cyan/magenta/yellow/green, `sort` (next free); (4) `cover`
(reuse an existing `cover-*` class or author a new one); (5) `title`/`short`/
`long` copy; (6) mechanics to keep or drop (e.g. Tetris theme toggle, Arkanoid
sounds / in-canvas level-select); (7) control parity. Record closed decisions
(HUD + modal in React; canvas draws only the action; pause lives in the shell).

## Phase D — Ensure the shared layer

If `components/GameShell.tsx` / `lib/engine.ts` / `lib/useGameEngine.ts` are
missing, stop: the shared layer is the prerequisite. Author it as its own spec
(`specs/NN-shared-game-contract.md`, written with the repo's /spec flow — see
Phase E) and implement it first (create the three files; refactor
`AsteroidsGame.tsx` + `Reproductor.tsx`; no visual regression), then continue.
If it exists, skip to Phase E.

## Phase E — Write the spec (delegate to the repo's /spec flow)

**Do not reinvent the spec format.** First read the repo's own spec skill and
follow it literally — its four phases, its section order, its hard rules, and
its save step (including determining the next number, using the session date,
marking the state `Borrador`, and seeding `specs/.spec-config.yml` if missing).
Read, in order:

- `.claude/skills/spec/SKILL.md` — the method: the four phases, the section
  order, the length rules, and the final save/confirm behavior.
- `.claude/skills/spec/template.md` — the exact section shape and examples.
- The two most recent files in `specs/` — to match this repo's language
  (Spanish) and the exact wording it uses for states and headings.

Then layer in the game-specific extras from `spec-checklist.md` (the
`PlayableEngine` mapping and the `av_games` row values). The result is a normal
repo spec at `specs/NN-<slug>.md`, written with the /spec method, in Spanish,
state `Borrador`, whose data model is this game's `PlayableEngine` mapping plus
its `av_games` row, and whose acceptance criteria include "saving writes
`av_scores` and the score shows on `/juego/<id>` and `/salon`".

## Phase F — Implement step by step

Branch `spec-NN-slug` (respect `AutoCreateBranch`), show the spec summary, then
pause after each step: (1) engine `lib/<id>.ts` → `npx tsc --noEmit` + `npm run
lint`; (2) adapter `components/<Game>.tsx` with `useGameEngine` + `GameShell`;
(3) route `app/jugar/<id>/page.tsx` (`export const instant = false;`, async
server component, `getGame(id)` → `notFound()`), verifying the static segment
beats `/jugar/[id]`; (4) migration `supabase/migrations/000N_av_game_<id>.sql`
with the `av_games` INSERT; (5) assets if any (copy to `public/games/<id>/`);
(6) CSS polish inside the 4/3 CRT.

## Phase G — Verify

Walk the acceptance criteria. Confirm a saved score inserts into `av_scores` and
appears in `/juego/<id>` and `/salon`. Remind the user to set the spec to
`Implementado`.

## Hard rules

- Never write code before the spec exists (Phase E before F).
- Pause after each plan step and wait for review.
- **Never commit automatically** — committing is the user's call.
- Ambiguity → stop and offer 2–3 concrete options; do not improvise.
- Out-of-scope requests → defer to a new spec.
- **Never edit anything under `references/`** (the hook blocks it anyway).
- Do not manually reformat code you write: a `PostToolUse` hook runs Prettier +
  `eslint --fix` on every Write/Edit. If ESLint fails it exits 2 and shows the
  error — treat it as blocking and fix it in the same turn.
