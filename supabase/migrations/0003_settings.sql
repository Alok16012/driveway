-- Platform settings and broadcast announcements, managed from the admin panel.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

create table if not exists app_settings (
  id             int primary key default 1 check (id = 1),
  commission_pct numeric not null default 20 check (commission_pct between 0 and 100),
  surge_on       boolean not null default true,
  surge_mult     numeric not null default 1.3 check (surge_mult between 1 and 5),
  cash           boolean not null default true,
  online         boolean not null default true,
  auto_assign    boolean not null default true,
  sos            boolean not null default true,
  scheduled      boolean not null default false,
  maintenance    boolean not null default false,
  service_areas  jsonb   not null default '[{"city":"Noida","active":true},{"city":"Delhi","active":true},{"city":"Gurugram","active":true},{"city":"Lucknow","active":true},{"city":"Ghaziabad","active":false},{"city":"Faridabad","active":false}]',
  updated_at     timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  audience   text not null check (audience in ('All customers', 'All drivers', 'Noida only', 'Inactive riders')),
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- The apps read settings (fares, payment options, maintenance) and broadcasts; only the admin writes.
alter table app_settings  enable row level security;
alter table announcements enable row level security;
drop policy if exists "public read" on app_settings;
create policy "public read" on app_settings for select using (true);
drop policy if exists "public read" on announcements;
create policy "public read" on announcements for select using (true);
revoke insert, update, delete on app_settings, announcements from anon, authenticated;

insert into announcements (audience, title, body, created_at)
select * from (values
  ('All customers', 'Weekend offer', 'Use code WEEKEND for 15 percent off Saturday and Sunday rides.', timestamptz '2026-09-27 10:00:00+05:30'),
  ('All drivers',   'Complete 5 rides, get 500', 'Finish 5 trips today to unlock the Daily Target bonus.', timestamptz '2026-09-28 07:00:00+05:30')
) v where not exists (select 1 from announcements);
