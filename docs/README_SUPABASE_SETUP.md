# Invest Football Market — Supabase Setup

## 1) Create Supabase Project
- Grab Project URL, anon key, and service role key.

## 2) Apply Schema
- Open Supabase → SQL Editor → paste `schema.sql`.
- Then run `seed_teams.sql` to preload 20 clubs.

## 3) Configure Environment
- Copy `.env.example` to `.env.local` in your app repo.
- Fill in SUPABASE_URL and keys.

## 4) Test
- Use a simple script or page to `select * from teams`.
