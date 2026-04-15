-- ─────────────────────────────────────────────────────────────────────────────
-- Isograph v1 — Database Schema
-- Run this in Supabase SQL Editor (once, on a fresh project)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── user_profiles ───────────────────────────────────────────────────────────
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  headline text,
  industry text,
  interests text[] default '{}',
  personal_constraints text[] default '{}',
  location text,
  avatar_url text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
create policy "Users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = id);

-- ─── social_connections ──────────────────────────────────────────────────────
create table public.social_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('linkedin','instagram','twitter')),
  platform_user_id text,
  platform_username text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  connected_at timestamptz default now(),
  last_synced_at timestamptz,
  is_active boolean default true,
  unique(user_id, platform)
);

alter table public.social_connections enable row level security;
create policy "Users can manage own connections"
  on public.social_connections for all using (auth.uid() = user_id);

-- ─── style_models ────────────────────────────────────────────────────────────
create table public.style_models (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  model jsonb not null,
  source text not null check (source in ('onboarding','inference','reflection')),
  is_current boolean default true,
  post_count_at_reflection integer,
  created_at timestamptz default now()
);

alter table public.style_models enable row level security;
create policy "Users can manage own style models"
  on public.style_models for all using (auth.uid() = user_id);

create index idx_style_models_user_current on public.style_models(user_id, is_current);

-- ─── posts ───────────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'linkedin',
  source text not null check (source in ('generated','imported')),
  status text not null check (status in ('draft','published','failed')) default 'draft',
  generated_content text,
  published_content text,
  was_edited boolean default false,
  opportunity_id uuid,
  opportunity_snapshot jsonb,
  style_model_used jsonb,
  platform_post_id text,
  guardian_result jsonb,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table public.posts enable row level security;
create policy "Users can manage own posts"
  on public.posts for all using (auth.uid() = user_id);

create index idx_posts_user_status on public.posts(user_id, status);
create index idx_posts_user_published on public.posts(user_id, published_at desc);

-- ─── post_analytics ──────────────────────────────────────────────────────────
create table public.post_analytics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'linkedin',
  impressions integer default 0,
  reactions integer default 0,
  comments integer default 0,
  shares integer default 0,
  clicks integer default 0,
  engagement_rate numeric(6,2) default 0,
  reach integer,
  fetched_at timestamptz default now(),
  period_start timestamptz default now(),
  period_end timestamptz default now(),
  source text check (source in ('api','manual')) default 'api',
  unique(post_id, period_start)
);

alter table public.post_analytics enable row level security;
create policy "Users can manage own analytics"
  on public.post_analytics for all using (auth.uid() = user_id);

-- ─── opportunities ───────────────────────────────────────────────────────────
create table public.opportunities (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  hook text,
  why text,
  signal_strength integer default 0,
  personal_fit integer default 0,
  source_signals text[] default '{}',
  trending_terms text[] default '{}',
  status text check (status in ('new','used','dismissed')) default 'new',
  scouted_at timestamptz default now()
);

alter table public.opportunities enable row level security;
create policy "Users can manage own opportunities"
  on public.opportunities for all using (auth.uid() = user_id);

-- ─── reflection_history ──────────────────────────────────────────────────────
create table public.reflection_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  style_model_before jsonb,
  style_model_after jsonb,
  insights text[] default '{}',
  deltas jsonb,
  summary text,
  posts_analysed integer default 0,
  triggered_by text check (triggered_by in ('manual','scheduled','threshold')) default 'manual',
  created_at timestamptz default now()
);

alter table public.reflection_history enable row level security;
create policy "Users can manage own reflection history"
  on public.reflection_history for all using (auth.uid() = user_id);

-- ─── subscriptions ───────────────────────────────────────────────────────────
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text check (plan in ('free','pro')) default 'free',
  status text check (status in ('active','canceled','past_due','trialing')) default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  ai_posts_used_this_period integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "Users can read own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);
create policy "Users can update own subscription"
  on public.subscriptions for update using (auth.uid() = user_id);
create policy "Users can insert own subscription"
  on public.subscriptions for insert with check (auth.uid() = user_id);

-- ─── Helper function: increment_post_usage ───────────────────────────────────
-- Called by usageLimits.ts after successful post generation
create or replace function public.increment_post_usage(uid uuid)
returns void
language sql
security definer
as $$
  update public.subscriptions
  set ai_posts_used_this_period = ai_posts_used_this_period + 1,
      updated_at = now()
  where user_id = uid;
$$;
