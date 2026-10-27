-- TimeLux.Uz — database setup for Supabase.
-- Run once on a new project (SQL editor, or as a migration).
-- Everyone can read published products and banners; only users listed in
-- public.admins can create, change or delete anything, including uploaded images.

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- security definer so policies can check admin status without exposing the table
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins can see their own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- Products ----------
create table if not exists public.products (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  brand       text not null check (char_length(brand) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 80),
  spec        text not null default '' check (char_length(spec) <= 60),
  price       bigint not null check (price >= 0),
  description text not null default '' check (char_length(description) <= 2000),
  specs       jsonb not null default '{}'::jsonb,
  image_url   text,
  published   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.products enable row level security;

create policy "anyone can read published products" on public.products
  for select to anon, authenticated using (published or (select public.is_admin()));
create policy "admins can add products" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins can edit products" on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins can delete products" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- new products go to the end of the list; updated_at tracks edits
create or replace function public.products_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.sort_order := coalesce((select max(sort_order) + 1 from public.products), 0);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_before_write
  before insert or update on public.products
  for each row execute function public.products_before_write();

-- ---------- Banners ----------
create table if not exists public.banners (
  slot       text primary key check (slot in ('new', 'men', 'women', 'best')),
  image_url  text not null,
  updated_at timestamptz not null default now()
);
alter table public.banners enable row level security;

create policy "anyone can read banners" on public.banners
  for select to anon, authenticated using (true);
create policy "admins can add banners" on public.banners
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins can edit banners" on public.banners
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins can remove banners" on public.banners
  for delete to authenticated using ((select public.is_admin()));

-- ---------- Image storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins can upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));
create policy "admins can replace media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and (select public.is_admin()));
create policy "admins can delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));

-- ---------- Starting catalogue (same as data.js) ----------
insert into public.products (id, brand, name, spec, price, description, specs) values
  ('tissot-prx', 'Tissot', 'Tissot PRX', 'Quartz 40mm', 4500000,
   'A modern take on Tissot’s 1978 classic. The PRX pairs a slim tonneau-shaped steel case with an integrated bracelet and a sunburst dial, so it works as well with a suit as it does with a T-shirt.',
   '{"Movement":"Swiss quartz","Case size":"40 mm","Case material":"Stainless steel","Dial":"Green, sunburst finish","Crystal":"Sapphire, scratch-resistant","Water resistance":"100 m (10 bar)","Strap":"Integrated stainless steel bracelet","Functions":"Hours, minutes, seconds, date"}'),
  ('citizen-tsuyosa', 'Citizen', 'Citizen Tsuyosa', 'Automatic 40mm', 4500000,
   'Citizen’s self-winding everyday watch. The Tsuyosa has a bold sunray dial, a magnified date and a smooth integrated bracelet, and it never needs a battery: your wrist movement keeps it running.',
   '{"Movement":"Automatic (self-winding)","Case size":"40 mm","Case material":"Stainless steel","Dial":"Blue, sunray finish","Crystal":"Sapphire with date magnifier","Water resistance":"50 m (5 bar)","Strap":"Integrated stainless steel bracelet","Functions":"Hours, minutes, seconds, date"}'),
  ('seiko-5', 'Seiko', 'Seiko 5', 'Automatic 42.5mm', 3800000,
   'The Seiko 5 Sports is one of the most loved automatic watches in the world: tough, easy to read and built to be worn every day. A rotating bezel and day-date display make it as practical as it is sporty.',
   '{"Movement":"Automatic (self-winding), hand-winding","Case size":"42.5 mm","Case material":"Stainless steel","Dial":"Black","Crystal":"Hardlex","Water resistance":"100 m (10 bar)","Strap":"Stainless steel bracelet","Functions":"Hours, minutes, seconds, day, date"}'),
  ('casio-edifice', 'Casio', 'Casio Edifice', 'Chronograph 44mm', 2200000,
   'Motorsport-inspired styling with a working chronograph. The Edifice has a large, easy-to-read dial, three sub-dials and a leather strap, a sporty look at a very approachable price.',
   '{"Movement":"Quartz chronograph","Case size":"44 mm","Case material":"Stainless steel","Dial":"Black with three sub-dials","Crystal":"Mineral glass","Water resistance":"100 m (10 bar)","Strap":"Black leather","Functions":"Chronograph, date, hours, minutes, seconds"}')
on conflict (id) do nothing;

-- ---------- Make someone an admin ----------
-- 1. Supabase dashboard → Authentication → Users → Add user (email + password).
-- 2. Then run, with that email:
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'admin@example.com';
-- Also turn off public sign-ups: Authentication → Sign In / Providers → "Allow new users to sign up".
