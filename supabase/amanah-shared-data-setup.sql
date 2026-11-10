-- Amanah shared orders + chat setup
-- Run once in Supabase Dashboard > SQL Editor.
-- Before running: enable Authentication > Providers > Anonymous Sign-Ins.
-- Create the admin user in Authentication > Users, then replace the UUID
-- in the final INSERT with that user's actual ID.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_amanah_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_amanah_admin() from public;
grant execute on function public.is_amanah_admin() to anon, authenticated;

create table if not exists public.amanah_orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  visitor_id uuid not null references auth.users(id),
  customer_name text not null,
  phone text not null,
  address text not null,
  package_title text not null,
  product_id text,
  quantity integer not null default 1 check (quantity > 0),
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'Pending COD',
  created_at timestamptz not null default now()
);

create index if not exists amanah_orders_created_at_idx
  on public.amanah_orders(created_at desc);
create index if not exists amanah_orders_visitor_id_idx
  on public.amanah_orders(visitor_id);

create table if not exists public.amanah_conversations (
  id text primary key,
  visitor_id uuid not null references auth.users(id),
  customer_name text not null,
  status text not null default 'active',
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists amanah_conversations_updated_at_idx
  on public.amanah_conversations(updated_at desc);
create index if not exists amanah_conversations_visitor_id_idx
  on public.amanah_conversations(visitor_id);

create table if not exists public.amanah_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.amanah_conversations(id) on delete cascade,
  visitor_id uuid not null references auth.users(id),
  sender_type text not null check (sender_type in ('customer','admin','ai')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists amanah_messages_conversation_created_idx
  on public.amanah_messages(conversation_id, created_at);

alter table public.admin_users enable row level security;
alter table public.amanah_orders enable row level security;
alter table public.amanah_conversations enable row level security;
alter table public.amanah_messages enable row level security;

drop policy if exists "Admins can read admin list" on public.admin_users;
create policy "Admins can read admin list" on public.admin_users
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Visitors can create orders" on public.amanah_orders;
create policy "Visitors can create orders" on public.amanah_orders
for insert to authenticated
with check (visitor_id = auth.uid());

drop policy if exists "Visitors can read own orders" on public.amanah_orders;
create policy "Visitors can read own orders" on public.amanah_orders
for select to authenticated
using (visitor_id = auth.uid() or public.is_amanah_admin());

drop policy if exists "Admins can update orders" on public.amanah_orders;
create policy "Admins can update orders" on public.amanah_orders
for update to authenticated
using (public.is_amanah_admin())
with check (public.is_amanah_admin());

drop policy if exists "Visitors can create conversations" on public.amanah_conversations;
create policy "Visitors can create conversations" on public.amanah_conversations
for insert to authenticated
with check (visitor_id = auth.uid());

drop policy if exists "Participants and admins can read conversations" on public.amanah_conversations;
create policy "Participants and admins can read conversations" on public.amanah_conversations
for select to authenticated
using (visitor_id = auth.uid() or public.is_amanah_admin());

drop policy if exists "Participants and admins can update conversations" on public.amanah_conversations;
create policy "Participants and admins can update conversations" on public.amanah_conversations
for update to authenticated
using (visitor_id = auth.uid() or public.is_amanah_admin())
with check (visitor_id = auth.uid() or public.is_amanah_admin());

drop policy if exists "Participants and admins can read messages" on public.amanah_messages;
create policy "Participants and admins can read messages" on public.amanah_messages
for select to authenticated
using (
  visitor_id = auth.uid()
  or public.is_amanah_admin()
);

drop policy if exists "Visitors can send own messages" on public.amanah_messages;
create policy "Visitors can send own messages" on public.amanah_messages
for insert to authenticated
with check (
  visitor_id = auth.uid()
  and sender_type in ('customer','ai')
  and exists (
    select 1 from public.amanah_conversations c
    where c.id = conversation_id and c.visitor_id = auth.uid()
  )
);

drop policy if exists "Admins can send messages" on public.amanah_messages;
create policy "Admins can send messages" on public.amanah_messages
for insert to authenticated
with check (
  public.is_amanah_admin()
  and sender_type = 'admin'
  and exists (
    select 1 from public.amanah_conversations c
    where c.id = conversation_id
  )
);

-- Add the new tables to Supabase Realtime publication, safely/idempotently.
do $$
declare tbl text;
begin
  foreach tbl in array array['amanah_orders','amanah_conversations','amanah_messages']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

-- Register the administrator Auth user. This UUID must belong to an existing
-- user in Supabase Authentication > Users.
insert into public.admin_users (user_id)
values ('365e59b0-84a2-4d7a-9ddc-588b2d0af14e')
on conflict (user_id) do nothing;
