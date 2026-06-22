-- ============================================================
-- TradeNet Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Waitlist table — stores email signups (no auth account needed)
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  source text default 'website',
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

-- Anyone can insert into waitlist (public form)
create policy "Anyone can insert waitlist"
  on waitlist for insert
  with check (true);

-- Only authenticated users or service role can read
create policy "Service role can read waitlist"
  on waitlist for select
  using (auth.role() = 'service_role');


-- 2. Profiles table — extends auth.users with subscription data
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro_monthly', 'pro_annual', 'founding')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (non-subscription fields)
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Service role can do anything (for webhooks)
create policy "Service role full access profiles"
  on profiles for all
  using (auth.role() = 'service_role');


-- 3. Auto-create profile when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- 4. Auto-update updated_at on profile changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
