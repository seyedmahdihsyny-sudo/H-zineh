alter table public.profiles add column if not exists username text;
update public.profiles p
set username = lower(coalesce(nullif(u.raw_user_meta_data->>'username',''), nullif(split_part(u.email,'@',1),'')))
from auth.users u
where u.id = p.id and (p.username is null or p.username = '');
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.app_settings enable row level security;
grant select, insert, update on public.app_settings to authenticated;
drop policy if exists app_settings_read_authenticated on public.app_settings;
create policy app_settings_read_authenticated on public.app_settings for select to authenticated using (true);
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists history_read_authenticated on public.expense_history;
drop policy if exists history_read_admin on public.expense_history;
create policy history_read_admin on public.expense_history for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
