-- Run this once in Supabase's SQL editor (Database → SQL Editor → New query)
-- to create the table the new community-photo upload feature needs.
-- This file is not read by any code — it's a one-time setup script for you
-- to paste and run, then it can be deleted.

create table if not exists community_photos (
  id uuid primary key default gen_random_uuid(),
  herb_name text not null,
  image_url text not null,
  credit text not null default 'Anonymous',
  part text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists community_photos_herb_status_idx
  on community_photos (herb_name, status);

-- After running this, you also need to create a Storage bucket (separate
-- from SQL, done via the Storage tab in the Supabase dashboard):
--   1. Storage → New bucket
--   2. Name it exactly: herb-photos
--   3. Turn ON "Public bucket" (uploaded photos need to be viewable without
--      a login for them to show up on the site)
--
-- And in Netlify (Site settings → Environment variables), add one new
-- variable alongside your existing ANTHROPIC_API_KEY / SUPABASE_URL /
-- SUPABASE_KEY:
--   GARDEN_ADMIN_PASSCODE = <a password only you know>
-- This is what protects the photo-approval screen — pick something you
-- can remember but nobody could guess.
