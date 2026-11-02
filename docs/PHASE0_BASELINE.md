# SV Real Estate CRM Upgrade — Phase 0 Baseline

Date: 2026-11-01
Repository: maheshraja12/sv-realestatehyd
Base branch: main
Working branch: feature/sv-crm-marketing-interiors
Supabase project: sv relastates (ref: gkkoqknmwynqbrpadosf)
Region: ap-south-1
Database engine: PostgreSQL 17
Project status at inspection: ACTIVE_HEALTHY

## Safety boundary

- No production rows, schema, policies, secrets, storage objects, or environment variables were modified.
- No production deployment was triggered.
- Existing website design is to remain unchanged; work is scoped to an admin dashboard upgrade plus CRM, marketing, and interiors modules.
- Production changes require separate user approval after staging validation.

## Verified production row-count baseline

Read-only counts collected from the live public schema:

| Table | Rows |
|---|---:|
| leads | 37 |
| properties | 40 |
| property_images | 0 |
| appointments | 0 |
| enquiries | 0 |
| users | 2 |
| settings | 11 |
| session | 0 |
| app_secrets | 1 |

These counts are a baseline snapshot only. They are not a backup and must be rechecked immediately before and after any approved release.

## Live Supabase migration history

The connected production project reports these applied migrations:

- 20261017110916 — sv_realestate_enquiry_storage
- 20261017111017 — sv_realestate_edge_api_secret
- 20261017111324 — revoke_public_rls_auto_enable_execution
- 20261017113210 — sv_realestate_properties_persistent_storage
- 20261017113358 — create_public_property_images_storage_bucket

## Git migration history reconciliation finding

The repository main branch contains:
- supabase/migrations/20241015000000_init.sql
- database/supabase_schema.sql
- database/postgres_schema.sql
- other legacy SQLite/PostgreSQL database code and schema files.

The repository's 20241015000000_init.sql does not match the five migration versions recorded in the live Supabase project. It also contains an INSERT ... ON CONFLICT DO UPDATE for settings, so it must NOT be replayed against production. Treat it as historical source material only until the full migration chain is reconciled.

Before creating any new schema migration:
1. Retrieve and review the source for all five applied production migrations.
2. Compare live catalog definitions (tables, columns, constraints, indexes, triggers, policies, grants, functions, storage buckets) against repository SQL.
3. Identify the exact migration lineage and any dashboard/manual changes.
4. Build a canonical, non-destructive migration baseline for staging.
5. Never use db reset, drop/recreate, truncate, or seed operations against production.

## Security findings requiring remediation planning

Read-only inspection found permissive policies/grants:
- anon and authenticated can SELECT and UPDATE leads.
- anon and authenticated can SELECT and UPDATE appointments.
- anon and authenticated can SELECT and UPDATE enquiries.
- anon and authenticated can read/insert/update settings.
- public API roles have broad table privileges on several public tables, including app_secrets.
- RLS is enabled but no policies were reported for properties, property_images, session, and app_secrets.

Do not apply blanket policy changes before verifying the existing website's server-side access patterns. The intended end state is public read access only for published property data and controlled public lead submission; all customer records, staff records, settings, sessions, and secrets must be server-side/admin-only.

## Backup status — BLOCKER / NOT YET VERIFIED

The Supabase organization reports the Free plan. Supabase documentation states downloadable database backups are not available for Free projects. No verified downloadable backup or restorable snapshot was created during this Phase 0 run.

A real backup must be completed before any schema or policy changes. Preferred options:
1. Export a full logical backup using Supabase CLI from a trusted local environment with database credentials kept out of chat and source control; include schema and data, and separately inventory Storage objects.
2. Upgrade/enable a supported backup/PITR option if appropriate, then verify restoration capability.
3. Store encrypted backup artifacts outside the production database and test restore into an isolated project.

A Supabase development branch is not a substitute for a data backup; Supabase branches start with schema/migrations and do not copy production data.

## Staging branch cost

Supabase branch quote returned: USD $0.01344 per hour. This is a recurring hourly charge while the branch exists. Branch creation was not attempted because the user has not yet explicitly approved this additional recurring cost.

## Git isolation

Created Git branch:
feature/sv-crm-marketing-interiors

Branch is based on main at commit:
3901fd5373e7f20ab79cf52064d2f076fb2ef86e

No application code or production configuration was changed in this Phase 0 commit.

## Next steps

1. Obtain/verify a restorable production backup.
2. Obtain approval for the quoted Supabase staging-branch hourly cost, or use a separate staging Supabase project with an agreed cost.
3. Retrieve all five applied migration source files and reconcile live schema against repository state.
4. Build a staging-only migration chain and test security changes without touching production.
5. Implement CRM, marketing, and interiors modules on the Git feature branch.
6. Run the acceptance checklist and verify the original baseline counts.
7. Request explicit approval before production migration, deployment, or any action affecting production data.
