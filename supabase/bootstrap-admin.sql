-- Run after creating the first Auth user with email junior@hzineh.local.
-- This script only promotes an existing Auth user; it does not create credentials.
insert into public.profiles (id, display_name, role)
select id, 'مدیر اصلی', 'admin'
from auth.users
where lower(email) = 'junior@hzineh.local'
on conflict (id) do update
set display_name = excluded.display_name,
    role = 'admin';
