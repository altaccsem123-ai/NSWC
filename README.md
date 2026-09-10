# NSWC Website

Static GitHub Pages website for `nswc.us` with a Supabase-backed personnel portal.

## Structure

- `index.html` public landing page
- `apply/` application page
- `login/` personnel login
- `portal/app/` canonical Scheduling, Qualifications, Attendance and Personnel portal
- `portal/orbat/` ORBAT
- `portal/loa/` leave of absence
- `portal/profile/` personnel profile and password management
- `portal/admin/` personnel administration
- `assets/css/` all website stylesheets
- `assets/js/` all website JavaScript
- `assets/js/portal/` all portal JavaScript, including the shared navigation/session shell
- `images/` all local images used by the website
- `supabase/` database schema, migrations and Edge Function source

## Shared portal files

Portal navigation is defined once in `assets/js/portal/shell.js`.

Portal visual styling is defined once in `assets/css/portal.css`. The existing Scheduling portal design is the base design for ORBAT, LOA, Profile and Administration.

Supabase connection configuration is defined once in `assets/js/supabase-client.js`.

## Supabase

For a fresh database, apply SQL in this order:

1. `supabase/schema.sql`
2. `supabase/migrations/002_portal.sql`
3. `supabase/migrations/003_personnel_management.sql`

Migration `003_personnel_management.sql` is additive. It contains the ORBAT, LOA and administration database objects required by the corresponding portal pages.

The `create-unit-account` Edge Function still requires the same Supabase project configuration and secrets as before.

## GitHub Pages

The repository is structured to be published directly from the repository root. `CNAME` remains configured for `nswc.us`. `.nojekyll` is included so GitHub Pages serves the static asset structure without Jekyll processing.
