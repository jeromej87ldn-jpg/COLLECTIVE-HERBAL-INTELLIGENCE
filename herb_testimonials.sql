-- Run this once in Supabase's SQL editor (Database → SQL Editor → New query)
-- to create the table the herb testimonials feature needs. Mirrors the
-- community_photos.sql pattern already used for photo moderation.
-- This file is not read by any code — it's a one-time setup script for you
-- to paste and run, then it can be deleted.

create table if not exists herb_testimonials (
  id uuid primary key default gen_random_uuid(),
  herb_name text not null,
  display_name text not null default 'Anonymous',
  rating int not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists herb_testimonials_herb_status_idx
  on herb_testimonials (herb_name, status);

-- Uses the same GARDEN_ADMIN_PASSCODE Netlify environment variable already
-- set up for photo moderation -- no new env var needed.
