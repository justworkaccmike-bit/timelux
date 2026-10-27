-- Run once on a project that was set up before brand, short spec and price
-- became optional. (schema.sql already includes this for new projects.)
alter table public.products drop constraint if exists products_brand_check;
alter table public.products
  alter column brand set default '',
  add constraint products_brand_check check (char_length(brand) <= 40),
  alter column price drop not null;
