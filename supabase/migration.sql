-- Dashboarding Tool schema + RLS
-- Run this once in the Supabase project's SQL editor (Dashboard -> SQL Editor -> New query).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- db_connections: optional saved live-database connections (encrypted at rest)
-- ---------------------------------------------------------------------------
create table if not exists public.db_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    dialect text not null check (dialect in ('postgresql', 'mysql')),
    encrypted_uri text not null,   -- Fernet-encrypted connection string, decrypted only in the backend
    created_at timestamptz not null default now()
);

alter table public.db_connections enable row level security;

create policy "db_connections_owner_all" on public.db_connections
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- datasets: one row per uploaded file or imported DB query result. Every
-- dataset (including database-sourced ones) gets a snapshot file in Storage,
-- so downstream code (summary/chart-data) always reads from one place.
-- ---------------------------------------------------------------------------
create table if not exists public.datasets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    filename text not null,
    source_type text not null check (source_type in ('file', 'database')),
    storage_path text,                 -- path in the 'datasets' storage bucket (snapshot, always populated)
    connection_id uuid references public.db_connections(id) on delete set null,
    source_query text,                 -- SQL query used, when source_type = 'database'
    rows integer not null default 0,
    columns jsonb not null default '[]',
    dtypes jsonb not null default '{}',
    preview jsonb not null default '[]',
    summary jsonb not null default '{}',  -- numeric/categorical/datetime column lists
    created_at timestamptz not null default now()
);

alter table public.datasets enable row level security;

create policy "datasets_owner_select" on public.datasets
    for select using (auth.uid() = user_id);
create policy "datasets_owner_insert" on public.datasets
    for insert with check (auth.uid() = user_id);
create policy "datasets_owner_update" on public.datasets
    for update using (auth.uid() = user_id);
create policy "datasets_owner_delete" on public.datasets
    for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- dashboards: AI-generated chart configs + layout for a dataset
-- ---------------------------------------------------------------------------
create table if not exists public.dashboards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    dataset_id uuid not null references public.datasets(id) on delete cascade,
    title text not null,
    description text not null default '',
    charts jsonb not null default '[]',
    layout jsonb not null default '[]',
    is_public boolean not null default false,
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.dashboards enable row level security;

create policy "dashboards_owner_select" on public.dashboards
    for select using (auth.uid() = user_id);
create policy "dashboards_public_select" on public.dashboards
    for select using (is_public = true);
create policy "dashboards_owner_insert" on public.dashboards
    for insert with check (auth.uid() = user_id);
create policy "dashboards_owner_update" on public.dashboards
    for update using (auth.uid() = user_id);
create policy "dashboards_owner_delete" on public.dashboards
    for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded files (private; backend uses the service role
-- key and enforces ownership itself, so no public storage policy is needed)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;

create policy "dataset_files_owner_all" on storage.objects
    for all using (bucket_id = 'datasets' and auth.uid()::text = (storage.foldername(name))[1])
    with check (bucket_id = 'datasets' and auth.uid()::text = (storage.foldername(name))[1]);
