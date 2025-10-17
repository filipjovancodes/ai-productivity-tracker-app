-- Create activities table to track user productivity
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.activities enable row level security;

-- RLS Policies for activities table
create policy "Users can view their own activities"
  on public.activities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own activities"
  on public.activities for update
  using (auth.uid() = user_id);

create policy "Users can delete their own activities"
  on public.activities for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists activities_user_id_idx on public.activities(user_id);
create index if not exists activities_started_at_idx on public.activities(started_at desc);

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger to update updated_at on row update
drop trigger if exists activities_updated_at on public.activities;
create trigger activities_updated_at
  before update on public.activities
  for each row
  execute function public.handle_updated_at();
