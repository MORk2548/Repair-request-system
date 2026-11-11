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
| Run one package's tests | `corepack pnpm --filter @repair/core test` |
| Type-check everything | `corepack pnpm typecheck` |
| Start local Supabase (Docker Desktop must run) | `corepack pnpm db:start` |
| Rebuild the local database from migrations | `corepack pnpm db:reset` |
| Run the pgTAP tests and the core parity test (the local stack must be running) | `corepack pnpm test:db` |

## Layout

- `packages/core` holds rules with no network access: types, the ticket status machine, validation, notification and email builders. It ships TypeScript source (`exports` points at `src/index.ts`), with no build step.
- `packages/core/src/status.ts` owns ticket statuses. `TRANSITIONS` is a flat table with one row per (from, to, role). Change who can move a ticket where only there, and keep the seed of the database table `status_transitions` in `supabase/migrations/0003_transition.sql` identical (`packages/core/test/parity.db.test.ts` enforces it). Ownership (the reporter owns the ticket, the technician is the assignee) is checked only in the database.
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
