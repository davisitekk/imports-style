-- =====================================================================
-- IMPORTADOS STYLE — Schema completo Supabase (tabelas, RLS, RPCs)
-- Execute no SQL Editor do Supabase (pode rodar mais de uma vez).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- TABELAS
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  brand text,
  image_url text,
  images text[] not null default '{}',
  featured boolean not null default false,
  active boolean not null default true,
  weight numeric(10,3) default 0.5,
  height numeric(10,2) default 10,
  width numeric(10,2) default 20,
  length numeric(10,2) default 30,
  min_stock int not null default 2,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  sku text unique,
  stock int not null default 0 check (stock >= 0),
  price_override numeric(12,2),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants(product_id);

create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','pago','em_separacao','enviado','entregue','cancelado')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_cpf text,
  shipping_cep text,
  shipping_street text,
  shipping_number text,
  shipping_complement text,
  shipping_district text,
  shipping_city text,
  shipping_state text,
  shipping_method text,
  shipping_cost numeric(12,2) not null default 0,
  payment_method text not null default 'pix',
  notes text,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text,
  variant_label text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  type text not null check (type in ('entrada','saida','ajuste','venda','devolucao')),
  quantity int not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'vendas' check (role in ('admin','estoque','financeiro','vendas')),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, phone text, cpf text, city text, state text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_customers_email on public.customers(lower(email));

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact text, email text, phone text, document text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null, type text default 'banco', initial_balance numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pagar','receber')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  paid boolean not null default false,
  paid_at date,
  account_id uuid references public.financial_accounts(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- HELPERS
create or replace function public.has_role(roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and (role = 'admin' or role = any(roles)))
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          case when (select count(*) from public.profiles) = 0 then 'admin' else 'vendas' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_entries enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy cat_read on public.categories for select using (active or auth.uid() is not null);
create policy cat_write on public.categories for all using (public.has_role(array['estoque'])) with check (public.has_role(array['estoque']));
create policy prod_read on public.products for select using (active or auth.uid() is not null);
create policy prod_write on public.products for all using (public.has_role(array['estoque'])) with check (public.has_role(array['estoque']));
create policy var_read on public.product_variants for select using (active or auth.uid() is not null);
create policy var_write on public.product_variants for all using (public.has_role(array['estoque'])) with check (public.has_role(array['estoque']));

create policy ord_read on public.orders for select using (public.has_role(array['vendas','financeiro','estoque']));
create policy ord_write on public.orders for update using (public.has_role(array['vendas','financeiro'])) with check (public.has_role(array['vendas','financeiro']));
create policy ord_del on public.orders for delete using (public.has_role(array[]::text[]));
create policy oi_read on public.order_items for select using (public.has_role(array['vendas','financeiro','estoque']));

create policy sm_read on public.stock_movements for select using (public.has_role(array['estoque','vendas']));
create policy sm_ins on public.stock_movements for insert with check (public.has_role(array['estoque']));

create policy prof_read on public.profiles for select using (id = auth.uid() or public.has_role(array[]::text[]));
create policy prof_admin on public.profiles for update using (public.has_role(array[]::text[])) with check (public.has_role(array[]::text[]));

create policy set_read on public.settings for select using (auth.uid() is not null);
create policy set_write on public.settings for all using (public.has_role(array[]::text[])) with check (public.has_role(array[]::text[]));

create policy cust_all on public.customers for all using (public.has_role(array['vendas','financeiro'])) with check (public.has_role(array['vendas','financeiro']));
create policy sup_all on public.suppliers for all using (public.has_role(array['estoque','financeiro'])) with check (public.has_role(array['estoque','financeiro']));
create policy fa_all on public.financial_accounts for all using (public.has_role(array['financeiro'])) with check (public.has_role(array['financeiro']));
create policy fe_all on public.financial_entries for all using (public.has_role(array['financeiro'])) with check (public.has_role(array['financeiro']));

-- ---------------------------------------------------------------- RPCs
create or replace function public.get_store_public_info()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', coalesce((select value->>0 from settings where key='store_name'), 'Importados Style'),
    'whatsapp', (select value->>0 from settings where key='whatsapp'),
    'instagram', (select value->>0 from settings where key='instagram'),
    'pix_discount', coalesce((select (value->>0)::numeric from settings where key='pix_discount'), 5),
    'free_shipping_over', coalesce((select (value->>0)::numeric from settings where key='free_shipping_over'), 499),
    'products_count', (select count(*) from products where active),
    'categories_count', (select count(*) from categories where active),
    'brands_count', (select count(distinct brand) from products where active and brand is not null)
  )
$$;

create or replace function public.get_product_stock(p_product_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(stock),0)::int from product_variants where product_id = p_product_id and active
$$;

create or replace function public.create_store_order(p json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_item json;
  v_var record;
  v_qty int;
  v_price numeric;
  v_subtotal numeric := 0;
  v_ship numeric := coalesce((p->'shipping'->>'cost')::numeric, 0);
  v_pix numeric := coalesce((select (value->>0)::numeric from settings where key='pix_discount'), 5);
  v_discount numeric := 0;
  v_method text := coalesce(p->>'payment_method','pix');
begin
  if p->'items' is null or json_array_length(p->'items') = 0 then
    raise exception 'Carrinho vazio';
  end if;
  if coalesce(trim(p->'customer'->>'name'),'') = '' or coalesce(trim(p->'customer'->>'email'),'') = '' then
    raise exception 'Dados do cliente incompletos';
  end if;
  if v_method not in ('pix','cartao','boleto') then raise exception 'Forma de pagamento invalida'; end if;
  if v_ship < 0 then v_ship := 0; end if;

  insert into orders(customer_name, customer_email, customer_phone, customer_cpf,
    shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_district,
    shipping_city, shipping_state, shipping_method, shipping_cost, payment_method, notes)
  values (p->'customer'->>'name', lower(p->'customer'->>'email'), p->'customer'->>'phone', p->'customer'->>'cpf',
    p->'shipping'->>'cep', p->'shipping'->>'street', p->'shipping'->>'number', p->'shipping'->>'complement',
    p->'shipping'->>'district', p->'shipping'->>'city', p->'shipping'->>'state', p->'shipping'->>'method',
    v_ship, v_method, p->>'notes')
  returning * into v_order;

  for v_item in select * from json_array_elements(p->'items') loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantidade invalida'; end if;

    select v.*, pr.name as pname, pr.price as pprice, pr.active as pactive
      into v_var
      from product_variants v join products pr on pr.id = v.product_id
     where v.id = (v_item->>'variant_id')::uuid
     for update of v;

    if not found or not v_var.active or not v_var.pactive then
      raise exception 'Produto indisponivel';
    end if;
    if v_var.stock < v_qty then
      raise exception 'Estoque insuficiente para % (%/%). Disponivel: %', v_var.pname, coalesce(v_var.size,'-'), coalesce(v_var.color,'-'), v_var.stock;
    end if;

    v_price := coalesce(v_var.price_override, v_var.pprice);
    update product_variants set stock = stock - v_qty where id = v_var.id;
    insert into order_items(order_id, product_id, variant_id, product_name, variant_label, quantity, unit_price)
      values (v_order.id, v_var.product_id, v_var.id, v_var.pname,
              concat_ws(' / ', v_var.size, v_var.color), v_qty, v_price);
    insert into stock_movements(product_id, variant_id, type, quantity, reason)
      values (v_var.product_id, v_var.id, 'venda', -v_qty, 'Pedido #' || v_order.number);
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  if v_method = 'pix' then v_discount := round(v_subtotal * v_pix / 100, 2); end if;

  update orders set subtotal = v_subtotal, discount = v_discount, total = v_subtotal - v_discount + v_ship
   where id = v_order.id returning * into v_order;

  insert into customers(name, email, phone, cpf, city, state)
  values (v_order.customer_name, v_order.customer_email, v_order.customer_phone, v_order.customer_cpf,
          v_order.shipping_city, v_order.shipping_state)
  on conflict (lower(email)) do update set name = excluded.name, phone = excluded.phone;

  insert into financial_entries(kind, description, amount, due_date, order_id)
  values ('receber', 'Pedido #' || v_order.number, v_order.total, current_date + 3, v_order.id);

  return json_build_object('number', v_order.number, 'total', v_order.total, 'payment_method', v_order.payment_method);
end $$;

create or replace function public.move_stock(p_variant_id uuid, p_type text, p_quantity int, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_new int; v_pid uuid; v_delta int;
begin
  if not public.has_role(array['estoque']) then raise exception 'Sem permissao'; end if;
  if p_type = 'ajuste' then
    if p_quantity < 0 then raise exception 'Estoque nao pode ser negativo'; end if;
    select stock, product_id into v_new, v_pid from product_variants where id = p_variant_id for update;
    v_delta := p_quantity - v_new;
    update product_variants set stock = p_quantity where id = p_variant_id returning stock into v_new;
  else
    if p_quantity <= 0 then raise exception 'Quantidade deve ser maior que zero'; end if;
    v_delta := case when p_type in ('entrada','devolucao') then p_quantity else -p_quantity end;
    update product_variants set stock = stock + v_delta where id = p_variant_id returning stock, product_id into v_new, v_pid;
    if v_new is null then raise exception 'Variacao nao encontrada'; end if;
    if v_new < 0 then raise exception 'Estoque insuficiente'; end if;
  end if;
  insert into stock_movements(product_id, variant_id, type, quantity, reason, created_by)
    values (v_pid, p_variant_id, p_type, v_delta, p_reason, auth.uid());
  return v_new;
end $$;

create or replace function public._apply_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; r record; v_num bigint;
begin
  select status, number into v_old, v_num from orders where id = p_order_id for update;
  if v_old is null then raise exception 'Pedido nao encontrado'; end if;
  if v_old = p_status then return; end if;
  if v_old = 'cancelado' then raise exception 'Pedido cancelado nao pode ser reaberto'; end if;
  if p_status = 'cancelado' then
    for r in select * from order_items where order_id = p_order_id and variant_id is not null loop
      update product_variants set stock = stock + r.quantity where id = r.variant_id;
      insert into stock_movements(product_id, variant_id, type, quantity, reason)
        values (r.product_id, r.variant_id, 'devolucao', r.quantity, 'Cancelamento pedido #' || v_num);
    end loop;
    delete from financial_entries where order_id = p_order_id and not paid;
  elsif p_status = 'pago' then
    update financial_entries set paid = true, paid_at = current_date where order_id = p_order_id;
  end if;
  update orders set status = p_status where id = p_order_id;
end $$;
revoke all on function public._apply_order_status(uuid, text) from public, anon, authenticated;

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['vendas','financeiro']) then raise exception 'Sem permissao'; end if;
  perform public._apply_order_status(p_order_id, p_status);
end $$;

create or replace function public.webhook_set_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin perform public._apply_order_status(p_order_id, p_status); end $$;
revoke all on function public.webhook_set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.webhook_set_order_status(uuid, text) to service_role;

grant execute on function public.get_store_public_info() to anon, authenticated;
grant execute on function public.get_product_stock(uuid) to anon, authenticated;
grant execute on function public.create_store_order(json) to anon, authenticated;
grant execute on function public.move_stock(uuid, text, int, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------- STORAGE
insert into storage.buckets (id, name, public) values ('products', 'products', true)
on conflict (id) do nothing;
drop policy if exists "prod img read" on storage.objects;
drop policy if exists "prod img write" on storage.objects;
drop policy if exists "prod img update" on storage.objects;
drop policy if exists "prod img delete" on storage.objects;
create policy "prod img read" on storage.objects for select using (bucket_id = 'products');
create policy "prod img write" on storage.objects for insert to authenticated with check (bucket_id = 'products');
create policy "prod img update" on storage.objects for update to authenticated using (bucket_id = 'products');
create policy "prod img delete" on storage.objects for delete to authenticated using (bucket_id = 'products');

-- ---------------------------------------------------------------- CONFIG
insert into public.settings(key, value) values
  ('store_name', '["Importados Style"]'),
  ('pix_discount', '[5]'),
  ('free_shipping_over', '[499]'),
  ('whatsapp', '["5511999999999"]'),
  ('instagram', '["importadosstyle"]')
on conflict (key) do nothing;
