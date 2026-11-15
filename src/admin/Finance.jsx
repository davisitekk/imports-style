import React, { useState } from 'react';
import { sb } from '../lib/supabase.js';
import { brl, errMsg, fmtDate } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { CrudPage, Field, Modal, unwrap, useLoad } from './ui.jsx';

export function Cash() {
  const data = useLoad(async () => {
    const [entries, accounts] = await Promise.all([
      sb().from('financial_entries').select('*').order('due_date'),
      sb().from('financial_accounts').select('*').order('name'),
    ]);
    return { entries: unwrap(entries), accounts: unwrap(accounts) };
  });
  if (data.loading) return <div className="spinner" />;
  if (data.error) return <div className="alert error">{data.error}</div>;
  const e = data.data.entries;
  const receber = e.filter((x) => x.kind === 'receber');
  const pagar = e.filter((x) => x.kind === 'pagar');
  const sum = (l, f) => l.filter(f).reduce((s, x) => s + +x.amount, 0);
  const saldo = sum(receber, (x) => x.paid) - sum(pagar, (x) => x.paid);

  return (
    <>
      <div className="page-head"><h1>Caixa</h1></div>
      <div className="kpis">
        <div className="kpi"><span>Saldo realizado</span><strong>{brl(saldo)}</strong></div>
        <div className="kpi"><span>A receber (aberto)</span><strong>{brl(sum(receber, (x) => !x.paid))}</strong></div>
        <div className="kpi"><span>A pagar (aberto)</span><strong>{brl(sum(pagar, (x) => !x.paid))}</strong></div>
        <div className="kpi"><span>Contas cadastradas</span><strong>{data.data.accounts.length}</strong></div>
      </div>
      <div className="card">
        <h3>Contas</h3>
        {data.data.accounts.length === 0 ? <p className="muted small">Nenhuma conta. Cadastre em Financeiro - Contas.</p> : (
          <table className="table responsive"><thead><tr><th>Conta</th><th>Tipo</th><th>Saldo inicial</th></tr></thead>
            <tbody>{data.data.accounts.map((a) => <tr key={a.id}><td data-label="Conta">{a.name}</td><td data-label="Tipo">{a.type}</td><td data-label="Saldo inicial" className="price">{brl(a.initial_balance)}</td></tr>)}</tbody></table>)}
      </div>
      <div className="card">
        <h3>Ultimos lancamentos</h3>
        {e.length === 0 ? <p className="muted small">Nenhum lancamento.</p> : (
          <table className="table responsive"><thead><tr><th>Tipo</th><th>Descricao</th><th>Valor</th><th>Vencimento</th><th>Situacao</th></tr></thead>
            <tbody>{e.slice(-20).reverse().map((x) => (
              <tr key={x.id}><td data-label="Tipo">{x.kind === 'receber' ? 'A receber' : 'A pagar'}</td><td data-label="Descricao">{x.description}</td>
                <td data-label="Valor" className="price">{brl(x.amount)}</td><td data-label="Vencimento">{fmtDate(x.due_date)}</td>
                <td data-label="Situacao"><span className={`status ${x.paid ? 'ok' : 'warn'}`}>{x.paid ? 'Pago' : 'Em aberto'}</span></td></tr>))}
            </tbody></table>)}
      </div>
    </>
  );
}

export function Accounts() {
  return <CrudPage title="Contas financeiras" table="financial_accounts" order="name" fields={[
    { k: 'name', label: 'Nome', required: true },
    { k: 'type', label: 'Tipo', options: [['banco', 'Banco'], ['caixa', 'Caixa'], ['carteira', 'Carteira digital']] },
    { k: 'initial_balance', label: 'Saldo inicial (R$)', type: 'number' },
  ]} columns={[['name', 'Nome'], ['type', 'Tipo'], ['initial_balance', 'Saldo inicial', (v) => brl(v)]]} />;
}

export function Entries({ kind }) {
  const [toast, showToast] = useToast();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const data = useLoad(async () => {
    const [entries, accounts, suppliers, orders] = await Promise.all([
      sb().from('financial_entries').select('*').eq('kind', kind).order('due_date', { ascending: false }),
      sb().from('financial_accounts').select('*').order('name'),
      sb().from('suppliers').select('*').order('name'),
      sb().from('orders').select('id,number').order('created_at', { ascending: false }).limit(100),
    ]);
    return { entries: unwrap(entries), accounts: unwrap(accounts), suppliers: unwrap(suppliers), orders: unwrap(orders) };
  });

  const toggle = async (x) => {
    try { unwrap(await sb().from('financial_entries').update({ paid: !x.paid, paid_at: x.paid ? null : new Date().toISOString().slice(0, 10) }).eq('id', x.id)); data.reload(); }
    catch (e) { alert(errMsg(e)); }
  };
  const save = async () => {
    if (!edit.description?.trim()) return setErr('Informe a descricao.');
    try {
      const row = { kind, description: edit.description.trim(), amount: Number(edit.amount) || 0, due_date: edit.due_date || null,
        account_id: edit.account_id || null, supplier_id: edit.supplier_id || null, order_id: edit.order_id || null, paid: !!edit.paid };
      unwrap(edit.id ? await sb().from('financial_entries').update(row).eq('id', edit.id) : await sb().from('financial_entries').insert(row));
      setEdit(null); data.reload(); showToast('Lancamento salvo.');
    } catch (e) { setErr(errMsg(e)); }
  };
  const del = async (x) => {
    if (!window.confirm('Excluir lancamento?')) return;
    try { unwrap(await sb().from('financial_entries').delete().eq('id', x.id)); data.reload(); } catch (e) { alert(errMsg(e)); }
  };

  const title = kind === 'pagar' ? 'Contas a pagar' : 'Contas a receber';
  if (data.loading) return <div className="spinner" />;
  const list = data.data.entries;
  const open = list.filter((x) => !x.paid).reduce((s, x) => s + +x.amount, 0);

  return (
    <>
      <div className="page-head"><h1>{title}</h1><button className="btn btn-gold" onClick={() => { setEdit({ paid: false, due_date: new Date().toISOString().slice(0, 10) }); setErr(''); }}>+ Novo lancamento</button></div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="kpi"><span>Em aberto</span><strong>{brl(open)}</strong></div>
        <div className="kpi"><span>Total lancado</span><strong>{brl(list.reduce((s, x) => s + +x.amount, 0))}</strong></div>
      </div>
      {data.error && <div className="alert error">{data.error}</div>}
      {list.length === 0 ? <div className="empty">Nenhum lancamento.</div> : (
        <table className="table responsive"><thead><tr><th>Descricao</th><th>Valor</th><th>Vencimento</th><th>Situacao</th><th /></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.id}>
              <td data-label="Descricao">{x.description}</td>
              <td data-label="Valor" className="price">{brl(x.amount)}</td>
              <td data-label="Vencimento">{fmtDate(x.due_date)}</td>
              <td data-label="Situacao"><span className={`status ${x.paid ? 'ok' : 'warn'}`}>{x.paid ? 'Pago' : 'Em aberto'}</span></td>
              <td className="no-label"><div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(x)}>{x.paid ? 'Reabrir' : 'Marcar pago'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit({ ...x }); setErr(''); }}>Editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(x)}>Excluir</button>
              </div></td>
            </tr>))}
          </tbody></table>)}
      {edit && (
        <Modal title={edit.id ? 'Editar lancamento' : 'Novo lancamento'} onClose={() => setEdit(null)} footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-gold" onClick={save}>Salvar</button></>}>
          <div className="form-grid two">
            <Field label="Descricao *"><input value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Valor (R$)"><input type="number" step="0.01" value={edit.amount ?? ''} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
            <Field label="Vencimento"><input type="date" value={edit.due_date || ''} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></Field>
            <Field label="Conta"><select value={edit.account_id || ''} onChange={(e) => setEdit({ ...edit, account_id: e.target.value })}><option value="">—</option>{data.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            {kind === 'pagar'
              ? <Field label="Fornecedor"><select value={edit.supplier_id || ''} onChange={(e) => setEdit({ ...edit, supplier_id: e.target.value })}><option value="">—</option>{data.data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              : <Field label="Pedido"><select value={edit.order_id || ''} onChange={(e) => setEdit({ ...edit, order_id: e.target.value })}><option value="">—</option>{data.data.orders.map((o) => <option key={o.id} value={o.id}>#{o.number}</option>)}</select></Field>}
          </div>
          <label className="check"><input type="checkbox" checked={!!edit.paid} onChange={(e) => setEdit({ ...edit, paid: e.target.checked })} />Ja liquidado</label>
          {err && <div className="alert error">{err}</div>}
        </Modal>)}
      {toast}
    </>
  );
}
