import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Public.jsx';
import { errMsg } from '../lib/utils.js';
import { sb } from '../lib/supabase.js';

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k); };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Fechar">{Icon.close}</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await fn()); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

export const unwrap = ({ data, error }) => { if (error) throw error; return data; };

export function Field({ label, children }) {
  return <div><label>{label}</label>{children}</div>;
}

export function CrudPage({ title, table, fields, columns, order = 'created_at', canEdit = true, toast }) {
  const { data, loading, error, reload } = useLoad(async () => unwrap(await sb().from(table).select('*').order(order, { ascending: false })), [table]);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const save = async () => {
    setErr('');
    for (const f of fields) if (f.required && !String(edit[f.k] ?? '').trim()) return setErr(`Preencha: ${f.label}`);
    setSaving(true);
    try {
      const row = {};
      fields.forEach((f) => {
        let v = edit[f.k];
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
        if (f.type === 'checkbox') v = !!v;
        if (v === '') v = null;
        row[f.k] = v;
      });
      unwrap(edit.id ? await sb().from(table).update(row).eq('id', edit.id) : await sb().from(table).insert(row));
      setEdit(null); reload(); if (toast) toast('Salvo com sucesso.');
    } catch (e) { setErr(errMsg(e)); } finally { setSaving(false); }
  };
  const del = async (r) => {
    if (!window.confirm('Excluir este registro?')) return;
    try { unwrap(await sb().from(table).delete().eq('id', r.id)); reload(); if (toast) toast('Excluido.'); }
    catch (e) { alert(errMsg(e)); }
  };
  const rows = (data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="page-head"><h1>{title}</h1>{canEdit && <button className="btn btn-gold" onClick={() => { setEdit({}); setErr(''); }}>+ Novo</button>}</div>
      <div className="toolbar"><input type="search" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {error && <div className="alert error">{error}</div>}
      {loading ? <div className="spinner" /> : rows.length === 0 ? <div className="empty">Nenhum registro.</div> : (
        <table className="table responsive">
          <thead><tr>{columns.map(([k, l]) => <th key={k}>{l}</th>)}{canEdit && <th />}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              {columns.map(([k, l, fmt]) => <td key={k} data-label={l}>{fmt ? fmt(r[k], r) : (r[k] ?? '-')}</td>)}
              {canEdit && <td className="no-label"><div className="row-actions"><button className="btn btn-ghost btn-sm" onClick={() => { setEdit(r); setErr(''); }}>Editar</button><button className="btn btn-danger btn-sm" onClick={() => del(r)}>Excluir</button></div></td>}
            </tr>))}</tbody>
        </table>
      )}
      {edit && (
        <Modal title={edit.id ? 'Editar' : 'Novo registro'} onClose={() => setEdit(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
          <div className="form-grid two">
            {fields.map((f) => f.type === 'checkbox'
              ? <label key={f.k} className="check"><input type="checkbox" checked={!!edit[f.k]} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.checked })} />{f.label}</label>
              : <Field key={f.k} label={f.label + (f.required ? ' *' : '')}>
                {f.options ? <select value={edit[f.k] ?? ''} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.value })}><option value="">—</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : f.type === 'textarea' ? <textarea value={edit[f.k] ?? ''} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.value })} />
                  : <input type={f.type || 'text'} step={f.type === 'number' ? '0.01' : undefined} value={edit[f.k] ?? ''} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.value })} />}
              </Field>)}
          </div>
          {err && <div className="alert error">{err}</div>}
        </Modal>
      )}
    </>
  );
}
