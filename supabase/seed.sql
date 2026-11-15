-- Dados de exemplo (opcional). Execute APOS schema.sql.
do $$
declare c_cam uuid; c_mol uuid; c_tenis uuid; c_ace uuid; c_os uuid; p uuid;
  s text; col text; sizes text[]; colors text[]; rec record;
begin
  if exists (select 1 from products) then return; end if;
  insert into categories(name, image_url) values ('Camisetas','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800') returning id into c_cam;
  insert into categories(name, image_url) values ('Moletons','https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800') returning id into c_mol;
  insert into categories(name, image_url) values ('Tenis','https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800') returning id into c_tenis;
  insert into categories(name, image_url) values ('Acessorios','https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800') returning id into c_ace;
  insert into categories(name, parent_id) values ('Oversized', c_cam) returning id into c_os;

  for rec in select * from (values
    ('Camiseta Oversized Essentials','Algodao premium 240g, modelagem ampla.',249.90,c_os,'DESIGN','https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900',true,'roupa'),
    ('Camiseta Logo Gold','Estampa dourada em silk de alta definicao.',199.90,c_cam,'NIKE','https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900',true,'roupa'),
    ('Moletom Heavy Hoodie','Moletom flanelado 480g com capuz duplo.',459.90,c_mol,'ADIDAS','https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900',true,'roupa'),
    ('Moletom Crewneck Black','Gola careca, punhos canelados.',389.90,c_mol,'DESIGN','https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=900',false,'roupa'),
    ('Tenis Air Street','Cabedal em couro, solado de alta tracao.',899.90,c_tenis,'NIKE','https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900',true,'tenis'),
    ('Tenis Runner Retro','Visual retro com conforto atual.',749.90,c_tenis,'ADIDAS','https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=900',false,'tenis'),
    ('Bone Dad Hat','Ajuste traseiro em metal.',149.90,c_ace,'NEW ERA','https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900',true,'unico'),
    ('Bag Shoulder Utility','Nylon resistente, alca regulavel.',299.90,c_ace,'DESIGN','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900',false,'unico')
  ) as t(name,descr,price,cat,brand,img,feat,kind) loop
    insert into products(name, description, price, category_id, brand, image_url, images, featured)
    values (rec.name, rec.descr, rec.price, rec.cat, rec.brand, rec.img, array[rec.img], rec.feat) returning id into p;
    sizes := case rec.kind when 'roupa' then array['P','M','G','GG'] when 'tenis' then array['39','40','41','42'] else array['Unico'] end;
    colors := case rec.kind when 'unico' then array['Preto'] else array['Preto','Branco'] end;
    foreach s in array sizes loop foreach col in array colors loop
      insert into product_variants(product_id, size, color, sku, stock)
      values (p, s, col, upper(left(regexp_replace(rec.name,'[^A-Za-z]','','g'),6))||'-'||s||'-'||left(col,3)||'-'||left(p::text,4), (random()*8)::int);
    end loop; end loop;
  end loop;
end $$;
