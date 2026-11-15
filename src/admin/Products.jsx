import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sb, uploadImage } from '../lib/supabase.js';
import { brl, errMsg, productImage } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { Field, Modal, unwrap, useLoad } from './ui.jsx';

const EMPTY = { name: '', description: '', price: '', category_id: '', brand: '', image_url: '', images: [], featured: false, active: true, weight: 0.5, height: 10, width: 20, length: 30, min_stock: 2 };
const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export function ProductEditor({ product, categories, onClose, onSaved }) {
  const [tab, setTab] = useState('dados');
  const [p, setP] = useState(() => ({ ...EMPTY, ...product, images: product?.images || [] }));
  const [variants, setVariants] = useState(() => (product?.product_variants || []).map((v) => ({ ...v })));
  const [removed, setRemoved] = useState([]);
  const [sizesTxt, setSizesTxt] = useState('P, M, G, GG');
  const [colorsTxt, setColorsTxt] = useState('Preto');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));

  const generate = () => {
    const sizes = sizesTxt.split(',').map((s) => s.trim()).filter(Boolean);
    const colors = colorsTxt.split(',').map((s) => s.trim()).filter(Boolean);
    const S = sizes.length ? sizes : [null], C = colors.length ? colors : [null];
    const next = [...variants];
    S.forEach((s) => C.forEach((c) => {
      if (next.some((v) => (v.size || null) === s && (v.color || null) === c)) return;
      next.push({ _new: true, size: s, color: c, sku: [slug(p.name).slice(0, 6) || 'PROD', slug(s), slug(c).slice(0, 3), Math.random().toString(36).slice(2, 5).toUpperCase()].filter(Boolean).join('-'), stock: 0, price_override: '', image_url: '', active: true });
    }));
    setVariants(next);
  };
  const setV = (i, k, val) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, [k]: val } : v)));
  const removeV = (i) => { const v = variants[i]; if (v.id) setRemoved((r) => [...r, v.id]); setVariants((vs) => vs.filter((_, j) => j !== i)); };

  const upload = async (file, cb) => {
    if (!file) return;
    setUploading(true); setErr('');
    try { cb(await uploadImage(file)); } catch (e) { setErr('Falha no upload: ' + errMsg(e)); } finally { setUploading(false); }
  };

  const save = async () => {
    setErr('');
    if (!p.name.trim()) { setTab('dados'); return setErr('Informe o nome.'); }
    if (!(Number(p.price) >= 0) || p.price === '') { setTab('dados'); return setErr('Informe um preco valido.'); }
    if (variants.length === 0) { setTab('variacoes'); return setErr('Crie ao menos uma variacao (use Gerar combinacoes).'); }
    const skus = variants.map((v) => v.sku?.trim()).filter(Boolean);
    if (new Set(skus).size !== skus.length) { setTab('variacoes'); return setErr('Ha SKUs repetidos.'); }
    if (variants.some((v) => !(Number(v.stock) >= 0))) { setTab('variacoes'); return setErr('Estoque invalido em alguma variacao.'); }
    setSaving(true);
    try {
      const images = p.images.filter(Boolean);
      const row = { name: p.name.trim(), description: p.description || null, price: Number(p.price), category_id: p.category_id || null, brand: p.brand || null,
        image_url: images[0] || p.image_url || null, images, featured: !!p.featured, active: !!p.active,
        weight: Number(p.weight) || 0, height: Number(p.height) || 0, width: Number(p.width) || 0, length: Number(p.length) || 0, min_stock: Number(p.min_stock) || 0 };
      const saved = unwrap(p.id ? await sb().from('products').update(row).eq('id', p.id).select().single() : await sb().from('products').insert(row).select().single());
      if (removed.length) {
        const { error } = await sb().from('product_variants').delete().in('id', removed);
        if (error) unwrap(await sb().from('product_variants').update({ active: false }).in('id', removed));
      }
      for (const v of variants) {
        const vr = { product_id: saved.id, size: v.size || null, color: v.color || null, sku: v.sku?.trim() || null, stock: parseInt(v.stock, 10) || 0,
          price_override: v.price_override === '' || v.price_override == null ? null : Number(v.price_override), image_url: v.image_url || null, active: v.active !== false };
        if (v.id) {
          const rest = { product_id: vr.product_id, size: vr.size, color: vr.color, sku: vr.sku, price_override: vr.price_override, image_url: vr.image_url, active: vr.active };
          unwrap(await sb().from('product_variants').update(rest).eq('id', v.id));
        } else {
          const ins = unwrap(await sb().from('product_variants').insert(vr).select().single());
          if (ins.stock > 0) await sb().from('stock_movements').insert({ product_id: saved.id, variant_id: ins.id, type: 'entrada', quantity: ins.stock, reason: 'Cadastro inicial' });
        }
      }
      onSaved();
    } catch (e) { setErr(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal title={p.id ? 'Editar produto' : 'Novo produto'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-gold" onClick={save} disabled={saving || uploading}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
      <div className="tabs">{[['dados', 'Dados'], ['imagens', 'Imagens'], ['variacoes', `Variacoes (${variants.length})`], ['frete', 'Frete']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'dados' && <div className="form-grid two">
        <Field label="Nome *"><input value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Marca"><input value={p.brand || ''} onChange={(e) => set('brand', e.target.value)} /></Field>
        <Field label="Preco (R$) *"><input type="number" step="0.01" min="0" value={p.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Categoria"><select value={p.category_id || ''} onChange={(e) => set('category_id', e.target.value)}><option value="">Sem categoria</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</option>)}</select></Field>
        <div style={{ gridColumn: '1/-1' }}><Field label="Descricao"><textarea value={p.description || ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
        <label className="check"><input type="checkbox" checked={!!p.active} onChange={(e) => set('active', e.target.checked)} />Ativo na loja</label>
        <label className="check"><input type="checkbox" checked={!!p.featured} onChange={(e) => set('featured', e.target.checked)} />Destaque na home</label>
      </div>}
      {tab === 'imagens' && <div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {p.images.map((u, i) => (
            <div key={u + i} style={{ position: 'relative' }}>
              <img src={u} alt="" style={{ width: 90, height: 110, objectFit: 'cover', borderRadius: 4, border: i === 0 ? '2px solid var(--gold)' : '1px solid var(--b2)' }} />
              <button className="btn btn-danger btn-sm" style={{ position: 'absolute', top: 2, right: 2, minHeight: 26, padding: '0 6px' }} onClick={() => set('images', p.images.filter((_, j) => j !== i))}>×</button>
              {i > 0 && <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', bottom: 2, left: 2, minHeight: 26, padding: '0 6px', background: '#000' }} onClick={() => set('images', [u, ...p.images.filter((_, j) => j !== i)])}>Capa</button>}
            </div>))}
        </div>
        <Field label="Enviar foto"><input type="file" accept="image/*" onChange={(e) => upload(e.target.files[0], (url) => set('images', [...p.images, url]))} /></Field>
        <div style={{ marginTop: 12 }}><Field label="Ou colar URL da imagem e pressionar Enter"><input placeholder="https://..." onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); set('images', [...p.images, e.target.value.trim()]); e.target.value = ''; } }} /></Field></div>
        {uploading && <div className="small gold">Enviando...</div>}
        <p className="small muted">A primeira imagem (borda dourada) e a capa.</p>
      </div>}
      {tab === 'variacoes' && <div>
        <div className="form-grid two">
          <Field label="Tamanhos (separados por virgula)"><input value={sizesTxt} onChange={(e) => setSizesTxt(e.target.value)} /></Field>
          <Field label="Cores (separadas por virgula)"><input value={colorsTxt} onChange={(e) => setColorsTxt(e.target.value)} /></Field>
        </div>
        <button className="btn btn-ghost" style={{ margin: '12px 0' }} onClick={generate}>Gerar combinacoes</button>
        {p.id && <p className="small muted">Para alterar o estoque de variacoes existentes use a tela Estoque (fica registrado no historico).</p>}
        <table className="table responsive">
          <thead><tr><th>Variacao</th><th>SKU</th><th>Estoque</th><th>Preco opc.</th><th>Foto opc.</th><th>Ativa</th><th /></tr></thead>
          <tbody>{variants.map((v, i) => (
            <tr key={v.id || `n${i}`}>
              <td data-label="Variacao"><strong>{[v.size, v.color].filter(Boolean).join(' / ') || 'Unica'}</strong></td>
              <td data-label="SKU"><input value={v.sku || ''} onChange={(e) => setV(i, 'sku', e.target.value)} style={{ minWidth: 130 }} /></td>
              <td data-label="Estoque"><input type="number" min="0" value={v.stock} disabled={!!v.id} onChange={(e) => setV(i, 'stock', e.target.value)} style={{ width: 80 }} /></td>
              <td data-label="Preco opc."><input type="number" step="0.01" min="0" placeholder={String(p.price || '')} value={v.price_override ?? ''} onChange={(e) => setV(i, 'price_override', e.target.value)} style={{ width: 100 }} /></td>
              <td data-label="Foto opc.">
                {v.image_url ? <button className="link-btn" onClick={() => setV(i, 'image_url', '')}><img src={v.image_url} alt="" style={{ width: 36, height: 44, objectFit: 'cover' }} /></button>
                  : <input type="file" accept="image/*" style={{ maxWidth: 170 }} onChange={(e) => upload(e.target.files[0], (url) => setV(i, 'image_url', url))} />}
              </td>
              <td data-label="Ativa"><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={v.active !== false} onChange={(e) => setV(i, 'active', e.target.checked)} /></td>
              <td className="no-label"><button className="btn btn-danger btn-sm" onClick={() => removeV(i)}>Remover</button></td>
            </tr>))}</tbody>
        </table>
        {variants.length === 0 && <p className="muted">Nenhuma variacao. Informe tamanhos/cores e clique em Gerar combinacoes. Para produto sem variacao, deixe ambos vazios e gere.</p>}
      </div>}
      {tab === 'frete' && <div className="form-grid two">
        <Field label="Peso (kg)"><input type="number" step="0.01" value={p.weight ?? ''} onChange={(e) => set('weight', e.target.value)} /></Field>
        <Field label="Altura (cm)"><input type="number" value={p.height ?? ''} onChange={(e) => set('height', e.target.value)} /></Field>
        <Field label="Largura (cm)"><input type="number" value={p.width ?? ''} onChange={(e) => set('width', e.target.value)} /></Field>
        <Field label="Comprimento (cm)"><input type="number" value={p.length ?? ''} onChange={(e) => set('length', e.target.value)} /></Field>
        <Field label="Estoque minimo (alerta)"><input type="number" value={p.min_stock ?? ''} onChange={(e) => set('min_stock', e.target.value)} /></Field>
      </div>}
      {err && <div className="alert error">{err}</div>}
    </Modal>
  );
}

export async function loadAdminProducts(categoryIds) {
  let q = sb().from('products').select('*, product_variants(*)').order('created_at', { ascending: false });
  if (categoryIds?.length) q = q.in('category_id', categoryIds);
  return unwrap(await q);
}

export function ProductTable({ products, categories, onEdit }) {
  const catName = (id) => categories.find((c) => c.id === id)?.name || '-';
  return (
    <table className="table responsive">
      <thead><tr><th /><th>Produto</th><th>Categoria</th><th>Preco</th><th>Estoque</th><th>Status</th></tr></thead>
      <tbody>{products.map((p) => {
        const stock = (p.product_variants || []).filter((v) => v.active).reduce((s, v) => s + v.stock, 0);
        return (
          <tr key={p.id} className="clickable" onClick={() => onEdit(p)}>
            <td className="no-label"><img className="thumb" src={productImage(p)} alt="" /></td>
            <td data-label="Produto"><strong>{p.name}</strong><br /><span className="small muted">{p.brand}</span></td>
            <td data-label="Categoria">{catName(p.category_id)}</td>
            <td data-label="Preco" className="price">{brl(p.price)}</td>
            <td data-label="Estoque"><span className={stock <= p.min_stock ? 'gold' : ''}>{stock}</span> <span className="small muted">({(p.product_variants || []).length} var.)</span></td>
            <td data-label="Status"><span className={`status ${p.active ? 'ok' : 'bad'}`}>{p.active ? 'Ativo' : 'Inativo'}</span>{p.featured && <span className="status warn" style={{ marginLeft: 4 }}>Destaque</span>}</td>
          </tr>);
      })}</tbody>
    </table>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('categoria') || '';
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [toast, showToast] = useToast();
  const cats = useLoad(async () => unwrap(await sb().from('categories').select('*').order('name')));
  const prods = useLoad(() => loadAdminProducts(), []);

  const list = (prods.data || []).filter((p) => (!cat || p.category_id === cat || (cats.data || []).find((c) => c.id === p.category_id)?.parent_id === cat)
    && (!q || `${p.name} ${p.brand} ${(p.product_variants || []).map((v) => v.sku).join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <div className="page-head"><h1>Produtos</h1><button className="btn btn-gold" onClick={() => setEdit({})}>+ Novo produto</button></div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar por nome, marca ou SKU..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
        <select value={cat} onChange={(e) => setParams(e.target.value ? { categoria: e.target.value } : {})}>
          <option value="">Todas as categorias</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</option>)}
        </select>
      </div>
      {prods.error && <div className="alert error">{prods.error}</div>}
      {prods.loading ? <div className="spinner" /> : list.length === 0 ? <div className="empty">Nenhum produto.</div>
        : <ProductTable products={list} categories={cats.data || []} onEdit={setEdit} />}
      {edit && <ProductEditor product={edit.id ? edit : null} categories={cats.data || []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); prods.reload(); showToast('Produto salvo.'); }} />}
      {toast}
    </>
  );
}
