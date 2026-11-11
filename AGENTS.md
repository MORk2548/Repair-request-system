# ระบบแจ้งซ่อม (Repair request system)

An internal repair-request system for one organization. Reporters file repair tickets with photos on the web or the mobile app. Technicians take or are assigned tickets, record how they fixed them, and hand tickets to another technician when needed. Admins manage users, departments, categories, equipment, and a summary report.

## Working with the user

- Reply in Thai. Keep code, commands, and file names as they are.
- The user works on Windows with PowerShell and is not comfortable with Linux. Give PowerShell commands, never bash-only steps.
- `docs/plan.md` is the source of truth. Work one task at a time, TDD as each task's steps say, tick its boxes when done, and commit per task. When scope changes, change `docs/plan.md` first.
- The old PHP helpdesk at `../Repair System/Repair System` is reference data only (dev seed accounts, departments). Do not port its code.

## Stack

- TypeScript, pnpm workspaces, Supabase (Postgres, Auth, Storage, Edge Functions), Next.js 15 (`apps/web`), Expo (`apps/mobile`), Resend for email, zod, Vitest, pgTAP, Playwright.
- pnpm is not installed globally. Run it through corepack: `corepack pnpm <args>`. The version is pinned by `packageManager` in `package.json`.

## Commands (PowerShell, repo root)

| Task | Command |
|---|---|
| Install dependencies | `corepack pnpm install` |
| Run every package's tests | `corepack pnpm test` |
| Run one package's tests | `corepack pnpm --filter @repair/core test` (the web app is `--filter web`) |
| Start the web app on http://localhost:3000 (copy `apps/web/.env.example` to `apps/web/.env.local` first) | `corepack pnpm web:dev` |
| Production build of the web app | `corepack pnpm --filter web build` |
| Type-check everything | `corepack pnpm typecheck` |
| Start local Supabase (Docker Desktop must run) | `corepack pnpm db:start` |
| Rebuild the local database from migrations and load the dev seed | `corepack pnpm db:reset` |
| Run the pgTAP tests, the core parity test and the `@repair/api` tests (the local stack must be running) | `corepack pnpm test:db` |
| Regenerate `packages/api/src/database.types.ts` after a migration (the local stack must be running) | `corepack pnpm gen:types` |

## Dev accounts

`supabase/seed.sql` (loaded only by `db:reset`) creates the old helpdesk's departments, categories, sample equipment and 10 users. Every account signs in with the password `helpdesk-dev`.

| Role | Email |
|---|---|
| admin | `admin@helpdesk.test` |
| technician | `kittipong@helpdesk.test`, `orathai@helpdesk.test`, `nattapon@helpdesk.test` |
| reporter | `nattawut@helpdesk.test`, `pimchanok@helpdesk.test`, `thanaporn@helpdesk.test`, `warin@helpdesk.test`, `suppachai@helpdesk.test`, `orathai.k@helpdesk.test` |

Seed user ids start with `5eed0000-`, so pgTAP tests that insert fixed `00000000-…` ids never collide with them. Tests must create their own rows and never assume the database is empty.

## Layout

- `packages/core` holds rules with no network access: types, the ticket status machine, validation, notification and email builders. It ships TypeScript source (`exports` points at `src/index.ts`), with no build step.
- `packages/core/src/status.ts` owns ticket statuses. `TRANSITIONS` is a flat table with one row per (from, to, role). Change who can move a ticket where only there, and keep the seed of the database table `status_transitions` in `supabase/migrations/0003_transition.sql` identical (`packages/core/test/parity.db.test.ts` enforces it). Ownership (the reporter owns the ticket, the technician is the assignee) is enforced only in the database.
- `packages/core/src/actions.ts` `ticketActions(ticket, user)` is the single source for which action buttons a ticket shows (web `StatusActions` now, mobile in Task 11). It starts from `nextStatuses` and mirrors the ownership checks of `transition_ticket()`/`reassign_ticket()` only to hide buttons the database would refuse, and holds the Thai button labels. A new row in `TRANSITIONS` needs a label there (`actions.test.ts` checks it).
- `packages/core/src/display.ts` holds the Thai labels (`STATUS_LABELS`, `PRIORITY_LABELS`, `eventLabel` for the timeline) and `formatThaiDateTime` (Asia/Bangkok, Buddhist-era year, `dd/MM/yyyy HH:mm`). Web and mobile both use them, so never hard-code a status label or date format in an app. The photo limits (`MAX_PHOTOS`, `MAX_PHOTO_BYTES`, `PHOTO_MIME_TYPES`) live in `ticket.ts`.
- `packages/api` owns every Supabase call the apps make (tables, RPCs, storage). Apps create their own `Db` client and pass it in. `rows.ts` is the only place that maps snake_case rows to core's camelCase types. `errors.ts` maps database exception messages to error classes through one table (`throwDbError`), so a new exception message gets a row there. Every api test needs the local stack, so the package has `test:db` and no `test`. The service-role key appears only in `packages/api/test/helpers.ts`, to create test users and lookup rows.
- `apps/web` is the Next.js 15 App Router app (package name `web`). `middleware.ts` refreshes the Supabase session and sends signed-out users to `/login`. `lib/supabase-server.ts` (server components) and `lib/supabase-browser.ts` (client components) create the `Db` that `@repair/api` functions take; both use only the anon key from `.env.local`. Pages live in `app/`. `login` is public; every signed-in page sits in the route group `app/(app)/` (`tickets`, `tickets/new`, `tickets/[id]`, and `/admin` from Task 7.5), whose `layout.tsx` draws the header, so the group adds nothing to URLs. `lib/session.ts` `getSession()` gives the layout and pages one cached user, profile and role per request. `/tickets` shows by role: a reporter sees what RLS returns; a technician gets `?tab=mine` (default, assigned to them) and `?tab=queue` (every `new` ticket); an admin sees everything with a `?status=` filter. Paging links keep `tab` and `status`. Client components that change data call `router.refresh()` on success, because a server page cannot pass them a callback. Components live in `components/` with their tests beside them; the tests mock `@repair/api` and the browser client, so `corepack pnpm --filter web test` needs no database. Styling is one stylesheet, `app/globals.css`, with color tokens on `:root`. The app pins TypeScript 6, not 7, because `next build` loads the TypeScript JS API, which TypeScript 7 does not ship.
- `supabase/` holds `config.toml`, numbered SQL files in `migrations/` (schema, RLS, RPCs), and pgTAP tests in `tests/`, one file per concern, each self-contained inside `begin; ... rollback;`.
- `current_app_role()` and `can_see_ticket()` in `supabase/migrations/0002_rls.sql` are the single source of who sees what. Every policy and view filters through them, so change visibility there and nowhere else.
- `transition_ticket()` and `reassign_ticket()` in `supabase/migrations/0003_transition.sql` are the only way a ticket's status or assignee changes. Clients have no direct update on those columns.
- Supabase default privileges grant every new public table to `anon` and `authenticated` and every new function to `public`. Each migration that adds one must enable RLS and revoke explicitly, then grant back only what clients need (see `0003_transition.sql`).

## Rules

- Permissions and status changes are decided in the database (RLS and RPC). TypeScript reads the same rules to decide which buttons to show. It never grants access itself.
- Every table has RLS on. Never use the service-role key in web or app code.
- UI text is Thai. Code, identifiers, and commit messages are English.

## Conventions

- Files use LF line endings (`.gitattributes`).
- Secrets live in `.env`, which git ignores. Add every new variable to `.env.example` too.
- Keep comments for the non-obvious why only.

## Dev database

- `corepack pnpm test:db` writes test users, categories, equipment and tickets into the local dev database and leaves them there. Run `corepack pnpm db:reset` afterwards to get back to seed data only (it also deletes any tickets created by hand).
