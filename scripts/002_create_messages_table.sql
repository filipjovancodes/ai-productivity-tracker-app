-- Create messages table to store n8n responses and chat history
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'n8n')),
  content text not null,
  source text default 'chat', -- 'chat', 'n8n', etc.
  created_at timestamptz not null default now(),
  metadata jsonb -- for storing additional data like webhook responses
);

-- Enable Row Level Security
alter table public.messages enable row level security;

-- RLS Policies for messages table
create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "System can insert messages for users"
  on public.messages for insert
  with check (true); -- Allow system to insert messages (for n8n responses)

-- Create indexes for better performance
create index if not exists messages_user_id_idx on public.messages(user_id);
create index if not exists messages_activity_id_idx on public.messages(activity_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists messages_source_idx on public.messages(source);

-- Create function to automatically update updated_at timestamp (if needed)
create or replace function public.handle_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

-- Create trigger to update created_at on row insert
drop trigger if exists messages_created_at on public.messages;
create trigger messages_created_at
  before insert on public.messages
  for each row
  execute function public.handle_messages_updated_at();
