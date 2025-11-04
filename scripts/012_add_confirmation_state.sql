-- Add confirmation_state column to messages table
-- States: 'pending', 'confirmed', 'cancelled', or NULL

alter table public.messages
add column if not exists confirmation_state text
check (confirmation_state in ('pending', 'confirmed', 'cancelled'))
default null;

-- Create index for better query performance
create index if not exists messages_confirmation_state_idx 
on public.messages(confirmation_state) 
where confirmation_state is not null;

-- Add RLS policy for updating confirmation_state
-- Users can update confirmation_state for their own messages
create policy "Users can update confirmation state on their own messages"
  on public.messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Migrate existing confirmation status from metadata to confirmation_state
-- This assumes existing metadata has confirmationStatus field
update public.messages
set confirmation_state = 
  case 
    when metadata->>'confirmationStatus' = 'confirmed' then 'confirmed'
    when metadata->>'confirmationStatus' = 'cancelled' then 'cancelled'
    when metadata->>'confirmationStatus' = 'pending' then 'pending'
    else null
  end
where metadata->>'confirmationStatus' is not null;

