import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sb, uploadImage } from '../lib/supabase.js';
import { errMsg } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { Field, Modal, unwrap, useLoad } from './ui.jsx';

export default function Categories() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('categoria') || '';
  const [edit, setEdit] = useState(null);
  const [toast, showToast] = useToast();
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const cats = useLoad(async () => unwrap(await sb().from('categories').select('*').order('name')));
  const prods = useLoad(async () => unwrap(await sb().from('products').select('*, product_variants(*)').order('name')), []);

  const all = cats.data || [];
  const roots = all.filter((c) => !c.parent_id);
  const childrenOf = (id) => all.filter((c) => c.parent_id === id);
  const current = all.find((c) => c.id === selected);
  const ids = current ? [current.id, ...childrenOf(current.id).map((c) => c.id)] : [];
  const list = (prods.data || []).filter((p) => ids.includes(p.category_id));

  const save = async () => {
    setErr('');
    if (!edit.name?.trim()) return setErr('Informe o nome da categoria.');
    try {
      const row = { name: edit.name.trim(), parent_id: edit.parent_id || null, image_url: edit.image_url || null, active: edit.active !== false };
      unwrap(edit.id ? await sb().from('categories').update(row).eq('id', edit.id) : await sb().from('categories').insert(row));
      setEdit(null); cats.reload(); showToast('Categoria salva.');
    } catch (e) { setErr(errMsg(e)); }
  };
  const del = async (c) => {
    if (!window.confirm(`Excluir a categoria "${c.name}"?`)) return;
    try { unwrap(await sb().from('categories').delete().eq('id', c.id)); cats.reload(); showToast('Categoria excluida.'); }
    catch (e) { alert(errMsg(e)); }
  };

  return (
    <>
      <div className="page-head"><h1>Categorias</h1><button className="btn btn-gold" onClick={() => { setEdit({ active: true }); setErr(''); }}>+ Nova categoria</button></div>
      <div className="split">
        <div className="card cat-tree">
          <button className={!selected ? 'active' : ''} onClick={() => setParams({})}><span>Todos os produtos</span><span>{prods.data?.length || 0}</span></button>
          {roots.map((c) => (
            <React.Fragment key={c.id}>
              <button className={selected === c.id ? 'active' : ''} onClick={() => setParams({ categoria: c.id })}>
                <span>{c.name} {c.active === false && <span className="small muted">(inativa)</span>}</span>
                <span className="small">{(prods.data || []).filter((p) => p.category_id === c.id).length}</span>
              </button>
              {childrenOf(c.id).map((s) => (
                <button key={s.id} className={selected === s.id ? 'active' : ''} style={{ paddingLeft: 22 }} onClick={() => setParams({ categoria: s.id })}>
                  <span className="muted">— {s.name}</span>
                  <span className="small">{(prods.data || []).filter((p) => p.category_id === s.id).length}</span>
                </button>))}
            </React.Fragment>))}
          {roots.length === 0 && <p className="muted small" style={{ padding: 10 }}>Nenhuma categoria ainda.</p>}
        </div>
        <div>
          {current ? <>
            <div className="page-head" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{current.name}</h2>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit({ ...current }); setErr(''); }}>Editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(current)}>Excluir</button>
                <Link className="btn btn-ghost btn-sm" to={`/produtos?categoria=${current.id}`}>Produtos no admin</Link>
              </div>
            </div>
            {list.length === 0 ? <div className="empty">Nenhum produto nesta categoria.</div> : (
              <table className="table responsive"><thead><tr><th>Produto</th><th>Marca</th><th>Estoque</th><th>Status</th></tr></thead>
                <tbody>{list.map((p) => {
                  const st = (p.product_variants || []).filter((v) => v.active).reduce((s, v) => s + v.stock, 0);
                  return <tr key={p.id}><td data-label="Produto">{p.name}</td><td data-label="Marca">{p.brand || '-'}</td><td data-label="Estoque">{st}</td><td data-label="Status"><span className={`status ${p.active ? 'ok' : 'bad'}`}>{p.active ? 'Ativo' : 'Inativo'}</span></td></tr>;
                })}</tbody></table>)}
          </> : <div className="empty"><h3>Selecione uma categoria</h3><p className="muted">Clique em uma categoria a esquerda para ver os produtos.</p></div>}
        </div>
      </div>
      {edit && (
        <Modal title="Categoria" onClose={() => setEdit(null)} footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-gold" onClick={save}>Salvar</button></>}>
          <div className="form-grid two">
            <Field label="Nome *"><input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Categoria pai"><select value={edit.parent_id || ''} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value })}><option value="">E categoria principal</option>
              {roots.filter((c) => c.id !== edit.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Imagem (upload)"><input type="file" accept="image/*" onChange={async (e) => {
              setUploading(true);
              try { const url = await uploadImage(e.target.files[0]); setEdit((x) => ({ ...x, image_url: url })); } catch (er) { setErr(errMsg(er)); } finally { setUploading(false); }
            }} /></Field>
            {uploading && <div className="small gold">Enviando...</div>}
            <Field label="Ou URL da imagem"><input value={edit.image_url || ''} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} /></Field>
            {edit.image_url && <img src={edit.image_url} alt="" style={{ width: 120, height: 160, objectFit: 'cover', marginTop: 8 }} />}
          </div>
          <label className="check"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Ativa na loja</label>
          {err && <div className="alert error">{err}</div>}
        </Modal>)}
      {toast}
    </>
  );
}
