-- Amanah Facebook Marketing: secure Meta Page OAuth + encrypted Page tokens.
-- This migration is intentionally one top-level PostgreSQL statement (DO block)
-- so SQL runners that accept only a singular query can execute it.
-- Tokens are never exposed to the browser; Edge Functions access these tables with the server key.

DO $facebook_marketing_migration$
BEGIN
  EXECUTE $sql$
    create table if not exists public.facebook_oauth_states (
      state_hash text primary key,
      user_id uuid not null references auth.users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  $sql$;

  EXECUTE $sql$
    create index if not exists facebook_oauth_states_expires_idx
      on public.facebook_oauth_states(expires_at)
  $sql$;

  EXECUTE $sql$
    create table if not exists public.facebook_page_connections (
      page_id text primary key,
      page_name text not null,
      connected_by uuid not null references auth.users(id) on delete cascade,
      token_ciphertext text not null,
      token_iv text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

  EXECUTE $sql$
    create index if not exists facebook_page_connections_owner_idx
      on public.facebook_page_connections(connected_by)
  $sql$;

  EXECUTE 'alter table public.facebook_oauth_states enable row level security';
  EXECUTE 'alter table public.facebook_page_connections enable row level security';

  -- Do not grant browser roles direct access to OAuth state or encrypted tokens.
  EXECUTE 'revoke all on table public.facebook_oauth_states from anon, authenticated';
  EXECUTE 'revoke all on table public.facebook_page_connections from anon, authenticated';

  -- Supabase service-role access from the Edge Function bypasses RLS.
END
$facebook_marketing_migration$;
