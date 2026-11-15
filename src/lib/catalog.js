import { sb } from './supabase.js';

const SELECT = 'id,name,description,price,brand,image_url,images,featured,category_id,created_at,product_variants(id,size,color,stock,price_override,image_url,active,sku)';

export function withStock(p) {
  const vars = (p.product_variants || []).filter((v) => v.active);
  return { ...p, variants: vars, stock: vars.reduce((s, v) => s + (v.stock || 0), 0) };
}

export async function fetchProducts({ featured, categoryIds, limit } = {}) {
  let q = sb().from('products').select(SELECT).eq('active', true).order('created_at', { ascending: false });
  if (featured) q = q.eq('featured', true);
  if (categoryIds?.length) q = q.in('category_id', categoryIds);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(withStock);
}

export async function fetchProduct(id) {
  const { data, error } = await sb().from('products').select(SELECT).eq('id', id).eq('active', true).maybeSingle();
  if (error) throw error;
  return data ? withStock(data) : null;
}

export async function fetchCategories() {
  const { data, error } = await sb().from('categories').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data || [];
}

export const descendants = (cats, id) => {
  const out = [id];
  cats.filter((c) => c.parent_id === id).forEach((c) => out.push(...descendants(cats, c.id)));
  return out;
};
