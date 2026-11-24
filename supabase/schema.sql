-- H-zineh schema; applied to the connected Supabase project.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', role text not null default 'partner' check (role in ('partner','admin')), username text unique, created_at timestamptz not null default now());
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
create table if not exists public.app_settings (key text primary key, value text not null default '', updated_at timestamptz not null default now(), updated_by uuid references auth.users(id));
create table if not exists public.expense_categories (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table if not exists public.expenses (id uuid primary key default gen_random_uuid(), title text not null, amount numeric(14,2) not null check (amount > 0), expense_date date not null default current_date, category_id uuid references public.expense_categories(id) on delete set null, partner_id uuid not null references public.profiles(id), created_by uuid not null references auth.users(id), description text not null default '', invoice_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.expense_history (id bigint generated always as identity primary key, expense_id uuid not null, actor_id uuid not null references auth.users(id), action text not null check (action in ('created','updated','deleted')), old_data jsonb, new_data jsonb, created_at timestamptz not null default now());
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), kind text not null, message text not null, expense_id uuid, created_at timestamptz not null default now());
create table if not exists public.notification_reads (notification_id uuid not null references public.notifications(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, read_at timestamptz not null default now(), primary key (notification_id,user_id));
alter table public.profiles enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_history enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
create policy categories_read on public.expense_categories for select to authenticated using (true);
create policy categories_admin_insert on public.expense_categories for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy categories_admin_update on public.expense_categories for update to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy categories_admin_delete on public.expense_categories for delete to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy expenses_read_authenticated on public.expenses for select to authenticated using (true);
create policy expenses_insert_self on public.expenses for insert to authenticated with check (created_by = (select auth.uid()) and partner_id = (select auth.uid()));
create policy expenses_update_owner on public.expenses for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()) and partner_id = (select auth.uid()));
create policy expenses_delete_owner on public.expenses for delete to authenticated using (created_by = (select auth.uid()));
create policy history_read_admin on public.expense_history for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
alter table public.app_settings enable row level security;
create policy app_settings_read_authenticated on public.app_settings for select to authenticated using (true);
create policy app_settings_admin_write on public.app_settings for all to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant select, insert, update on public.app_settings to authenticated;
revoke insert, update, delete on public.expense_history from anon, authenticated;
create policy notifications_read_authenticated on public.notifications for select to authenticated using (true);
revoke insert, update, delete on public.notifications from anon, authenticated;
create policy notification_reads_own on public.notification_reads for select to authenticated using (user_id = (select auth.uid()));
create policy notification_reads_insert_own on public.notification_reads for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_reads_delete_own on public.notification_reads for delete to authenticated using (user_id = (select auth.uid()));
grant select on public.expense_categories, public.expenses, public.expense_history, public.notifications, public.notification_reads to authenticated;
grant insert, update, delete on public.expenses to authenticated;
grant insert, delete on public.notification_reads to authenticated;
grant usage, select on all sequences in schema public to authenticated;
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists expenses_partner_id_idx on public.expenses(partner_id);
create index if not exists expenses_expense_date_idx on public.expenses(expense_date desc);
create index if not exists expense_history_actor_id_idx on public.expense_history(actor_id);
create index if not exists notification_reads_user_id_idx on public.notification_reads(user_id);
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles (id, display_name, username) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), nullif(lower(new.raw_user_meta_data ->> 'username'), '')); return new; end; $;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function private.handle_new_user();
create or replace function private.track_expense_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
  insert into public.expense_history(expense_id,actor_id,action,new_data) values (new.id,new.created_by,'created',to_jsonb(new));
  insert into public.notifications(kind,message,expense_id) values ('expense_created','هزینه جدید ثبت شد',new.id); return new;
 elsif tg_op = 'UPDATE' then
  new.updated_at := now();
  insert into public.expense_history(expense_id,actor_id,action,old_data,new_data) values (new.id,auth.uid(),'updated',to_jsonb(old),to_jsonb(new)); return new;
 else
  insert into public.expense_history(expense_id,actor_id,action,old_data) values (old.id,auth.uid(),'deleted',to_jsonb(old)); return old;
 end if;
end; $$;
drop trigger if exists expenses_track_changes on public.expenses;
create trigger expenses_track_changes before insert or update or delete on public.expenses for each row execute function private.track_expense_change();
insert into public.expense_categories(name) values ('مواد اولیه'),('حمل‌ونقل'),('حقوق و دستمزد'),('تعمیرات'),('آب و برق'),('ابزار و تجهیزات'),('سایر') on conflict (name) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('invoices','invoices',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif']) on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif'];
create policy invoice_read_authenticated on storage.objects for select to authenticated using (bucket_id='invoices');
create policy invoice_upload_own_folder on storage.objects for insert to authenticated with check (bucket_id='invoices' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy invoice_update_own_folder on storage.objects for update to authenticated using (bucket_id='invoices' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='invoices' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy invoice_delete_own_folder on storage.objects for delete to authenticated using (bucket_id='invoices' and (storage.foldername(name))[1]=(select auth.uid())::text);
