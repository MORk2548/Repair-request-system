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
| Run every package's tests and the Edge Function handler tests (`supabase/functions/**/*.test.ts`, root `vitest.config.ts`) | `corepack pnpm test` |
| Run one package's tests | `corepack pnpm --filter @repair/core test` (the web app is `--filter web`) |
| Start the web app on http://localhost:3000 (copy `apps/web/.env.example` to `apps/web/.env.local` first) | `corepack pnpm web:dev` |
| Production build of the web app | `corepack pnpm --filter web build` |
| Type-check everything | `corepack pnpm typecheck` |
| Start local Supabase (Docker Desktop must run); this also serves the Edge Functions from the checkout it was started in | `corepack pnpm db:start` |
| Rebuild the local database from migrations and load the dev seed | `corepack pnpm db:reset` |
| Run the pgTAP tests, the core parity test and the `@repair/api` tests (the local stack must be running, including the `admin-users` function; see Dev database) | `corepack pnpm test:db` |
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
- `packages/core/src/admin.ts` holds the zod schemas for the admin forms and the `admin-users` request body (`adminUsersRequestSchema`), with Thai messages. `updateUserSchema` checks `userId` with `z.guid()`, because the seed ids are not RFC uuids. Core imports use `.ts` extensions so the Deno function can import core source directly.
- `packages/core/src/display.ts` holds the Thai labels (`STATUS_LABELS`, `PRIORITY_LABELS`, `ROLE_LABELS`, `EQUIPMENT_STATUS_LABELS`, `eventLabel` for the timeline) and `formatThaiDateTime` (Asia/Bangkok, Buddhist-era year, `dd/MM/yyyy HH:mm`). Web and mobile both use them, so never hard-code a status label or date format in an app. The photo limits (`MAX_PHOTOS`, `MAX_PHOTO_BYTES`, `PHOTO_MIME_TYPES`) live in `ticket.ts`.
- `packages/core/src/dates.ts` holds `bangkokMonthRange(now)` (first and last day of the current Asia/Bangkok month as `yyyy-MM-dd`) and `dateRangeSchema` (real dates, `from` <= `to`, Thai messages) for the report range.
- `packages/api` owns every Supabase call the apps make (tables, RPCs, storage). Apps create their own `Db` client and pass it in. `rows.ts` is the only place that maps snake_case rows to core's camelCase types. `errors.ts` maps database exception messages to error classes through one table (`throwDbError`), so a new exception message gets a row there. Every api test needs the local stack, so the package has `test:db` and no `test`. `listCategories`, `listDepartments` and `listEquipment` leave out inactive or retired rows for pickers; admin pages pass `{ includeInactive: true }`. `admin.ts` calls the `admin-users` Edge Function (`adminListUsers`, `adminCreateUser`, `adminUpdateUser`, refusals become `AdminError` carrying the function's Thai `error`) and writes lookups straight through RLS (`saveDepartment`, `saveCategory`, `saveEquipment`, insert without `id`, update with it; a duplicate asset tag is `DuplicateAssetTagError`). Outside the Edge Functions, the service-role key appears only in `packages/api/test/helpers.ts`, to create test users and lookup rows.
- `apps/web` is the Next.js 15 App Router app (package name `web`). `middleware.ts` refreshes the Supabase session, sends signed-out users to `/login` (only `/login` and `/auth/confirm` are public) and sends a signed-in non-admin on `/admin/*` to `/tickets`. `lib/supabase-server.ts` (server components) and `lib/supabase-browser.ts` (client components) create the `Db` that `@repair/api` functions take; both use only the anon key from `.env.local`. Pages live in `app/`. `login` is public; `auth/confirm/route.ts` verifies an invite link's `token_hash` and sends the new user to `set-password` (or to `/login?error=link`). Every other signed-in page sits in the route group `app/(app)/` (`tickets`, `tickets/new`, `tickets/[id]`, `admin/users`, `admin/lists`, `admin/equipment`; the header links to the admin pages only for admins), whose `layout.tsx` draws the header, so the group adds nothing to URLs. `lib/session.ts` `getSession()` gives the layout and pages one cached user, profile and role per request. `/tickets` shows by role: a reporter sees what RLS returns; a technician gets `?tab=mine` (default, assigned to them) and `?tab=queue` (every `new` ticket); an admin sees everything with a `?status=` filter. Paging links keep `tab` and `status`. Client components that change data call `router.refresh()` on success, because a server page cannot pass them a callback. Components live in `components/` with their tests beside them; admin forms use `Field` (label, `aria-invalid`/`aria-describedby`, unique ids per row) and `useAction` (one call at a time, `router.refresh()` on success, Thai error); the tests mock `@repair/api` and the browser client, so `corepack pnpm --filter web test` needs no database. Styling is one stylesheet, `app/globals.css`, with color tokens on `:root`. The app pins TypeScript 6, not 7, because `next build` loads the TypeScript JS API, which TypeScript 7 does not ship.
- `supabase/` holds `config.toml`, numbered SQL files in `migrations/` (schema, RLS, RPCs), pgTAP tests in `tests/` (one file per concern, each self-contained inside `begin; ... rollback;`), Edge Functions in `functions/` and email templates in `templates/`.
- `supabase/functions/admin-users/` and `notify-ticket-event/` are the only runtime uses of the service-role key. `handler.ts` holds every rule (no Deno imports, so Vitest runs `handler.test.ts` with fake deps): no token 401, a caller who is not an active admin 403 before any other call, body parsed by core's `adminUsersRequestSchema` (400 with the Thai message), an email already in Auth 409 `อีเมลนี้มีผู้ใช้แล้ว` (checked before inviting, because Auth re-sends an invite to an unconfirmed address instead of refusing), no deactivating or demoting yourself 400, an `isActive` change also bans or unbans in Auth, and a failed profile write deletes the invited Auth user. `index.ts` is the Deno wiring: CORS, the service-role client from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `ban_duration` `876000h`/`none`, and the invite `redirectTo` `${WEB_BASE_URL}/auth/confirm` (`supabase/functions/.env`, default `http://localhost:3000`). `verify_jwt` stays on.
- `packages/core/src/notify.ts` holds the notification rules as two tables keyed by status: `RECIPIENTS` (who hears about a move to that status; `recipientsFor` drops duplicates, nulls and the actor) and `MESSAGES` (the Thai title and body; `messageFor` adds the ticket number). `in_progress` includes the assignee on purpose, so a reporter's reopen reaches the technician. `ticketEventPayloadSchema` parses the body the trigger posts.
- Notifications: the trigger `notify_ticket_event` (`0007_notify.sql`, after insert on `ticket_events` with a `to_status`) posts the event row, plus the ticket's `reporter_id` and `assignee_id` read in the same transaction, with `pg_net` to the URL in the Vault secret `notify_function_url`, with the header `x-webhook-secret` set to the Vault secret `notify_webhook_secret`. Without both secrets it does nothing, and any error is only a warning, so a notification can never roll back a ticket change. `supabase/seed.sql` creates both secrets locally (`http://kong:8000/...`, the gateway's name on the Docker network). `supabase/functions/notify-ticket-event/` has `verify_jwt = false` in `config.toml` because the database calls it, not a user; `process.ts` (no Deno imports, tested by `process.test.ts`) checks the header against env `NOTIFY_WEBHOOK_SECRET` (401), parses the body (400), ignores events without a status, then picks recipients from the people in that payload (never from the ticket as it is later, which may already have a new assignee), and sends one push per recipient with a token and counts sent, failed and skipped; a failed send is logged, never thrown. `index.ts` wires the service-role client and posts to `EXPO_PUSH_URL` (default Expo's push API). To see pushes locally without a phone, set `EXPO_PUSH_URL=http://host.docker.internal:<port>/push` in `supabase/functions/.env`, restart the stack, run any HTTP listener on that port and give a profile an `expo_push_token`. Production needs both Vault secrets and the function secret `NOTIFY_WEBHOOK_SECRET` (Task 12).
- Invites: the function calls `inviteUserByEmail`; `templates/invite.html` (wired in `config.toml` `[auth.email.template.invite]`) links to `{{ .RedirectTo }}?token_hash=…&type=invite`; `/auth/confirm` verifies it and `/set-password` sets the password. The web origins must be in `additional_redirect_urls` (3000, 3001, 3100 now), or Auth falls back to `site_url`. Locally the email lands in the mail server at http://127.0.0.1:54324.
- `current_app_role()` and `can_see_ticket()` in `supabase/migrations/0002_rls.sql` are the single source of who sees what. Every policy and view filters through them, so change visibility there and nowhere else. Since `0005_admin.sql`, any active user reads every department, category and equipment row (old tickets must still show the names of inactive ones); hiding them from pickers is `@repair/api`'s job.
- `transition_ticket()` and `reassign_ticket()` in `supabase/migrations/0003_transition.sql` are the only way a ticket's status or assignee changes. Clients have no direct update on those columns. After each change both call `sync_equipment_status()` (`0005_admin.sql`, not callable by clients), which sets the ticket's equipment to `under_repair` while any ticket on it is `in_progress` and to `active` otherwise, and never touches `retired`.
- `ticket_summary(p_from, p_to)` in `supabase/migrations/0006_reports.sql` is the admin report: it counts tickets created on those Asia/Bangkok days (both inclusive) by status (all six, zeros included), category, assignee (one null row for unassigned) and `avg_resolve_hours`. A caller who is not an active admin gets `forbidden`, `p_from > p_to` gets `invalid_range`; `@repair/api` `getTicketSummary` (`reports.ts`) parses the jsonb with a local zod schema and maps it to camelCase, and `errors.ts` maps both messages to `ForbiddenError` and `InvalidRangeError`. `/admin/reports` is a server component with a plain GET form (`?from=&to=`, default the current month, an invalid range shows the Thai message and falls back) and three count tables.
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

- `db:start` serves the Edge Functions too, and reads `supabase/functions/.env` (copy `supabase/functions/.env.example`) only when the stack starts, so restart it (`corepack pnpm exec supabase stop`, then `db:start`) after changing that file. The `admin-users` tests in `test:db` fail if the function is not served: after Docker Desktop restarts, `supabase start` leaves the edge runtime container stopped, so `db:start` also runs `docker start supabase_edge_runtime_repair-request-system`. `supabase functions serve` is not needed.
- With the seed's Vault secrets, every ticket event the api tests commit also calls `notify-ticket-event`. That is expected; test users have no push token, so those calls only count skips.
- `corepack pnpm test:db` writes test users, categories, equipment and tickets into the local dev database and leaves them there. Run `corepack pnpm db:reset` afterwards to get back to seed data only (it also deletes any tickets created by hand).
