import React, { useState } from 'react';
import { sb } from '../lib/supabase.js';
import { brl, errMsg, fmtDateTime, PAYMENT, STATUS, variantLabel } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { Modal, unwrap, useLoad } from './ui.jsx';

const FLOW = ['aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado'];

export default function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [toast, showToast] = useToast();
  const orders = useLoad(async () => unwrap(await sb().from('orders').select('*').order('created_at', { ascending: false }).limit(200)));

  const list = (orders.data || []).filter((o) => (!status || o.status === status)
    && (!q || `${o.number} ${o.customer_name} ${o.customer_email} ${o.shipping_city}`.toLowerCase().includes(q.toLowerCase())));

  const openOrder = async (o) => {
    setOpen(o); setErr(''); setItems([]);
    try { setItems(unwrap(await sb().from('order_items').select('*').eq('order_id', o.id))); } catch (e) { setErr(errMsg(e)); }
  };
  const change = async (o, s) => {
    setErr('');
    try {
      unwrap(await sb().rpc('set_order_status', { p_order_id: o.id, p_status: s }));
      showToast(`Pedido #${o.number}: ${STATUS[s]}.`);
      setOpen({ ...o, status: s }); orders.reload();
    } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <>
      <div className="page-head"><h1>Pedidos</h1><span className="small muted">{list.length} pedidos</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar por numero, cliente, e-mail ou cidade..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{FLOW.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select>
      </div>
      {orders.error && <div className="alert error">{orders.error}</div>}
      {orders.loading ? <div className="spinner" /> : list.length === 0 ? <div className="empty">Nenhum pedido.</div> : (
        <table className="table responsive">
          <thead><tr><th>#</th><th>Cliente</th><th>Data</th><th>Total</th><th>Pgto</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((o) => (
            <tr key={o.id} className="clickable" onClick={() => openOrder(o)}>
              <td data-label="#">#{o.number}</td>
              <td data-label="Cliente">{o.customer_name}<br /><span className="small muted">{o.customer_email}</span></td>
              <td data-label="Data" className="small muted">{fmtDateTime(o.created_at)}</td>
              <td data-label="Total" className="price">{brl(o.total)}</td>
              <td data-label="Pgto" className="small">{PAYMENT[o.payment_method] || o.payment_method}</td>
              <td data-label="Status"><span className={`status ${o.status}`}>{STATUS[o.status]}</span></td>
              <td className="no-label"><div className="row-actions"><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openOrder(o); }}>Detalhes</button></div></td>
            </tr>))}</tbody>
        </table>
      )}

      {open && (
        <Modal title={`Pedido #${open.number}`} onClose={() => setOpen(null)} footer={<button className="btn btn-ghost" onClick={() => setOpen(null)}>Fechar</button>}>
          <div className="form-grid two">
            <div><p className="small muted">Cliente</p><p><strong>{open.customer_name}</strong><br />{open.customer_email}<br />{open.customer_phone}<br />CPF {open.customer_cpf}</p></div>
            <div><p className="small muted">Entrega</p><p>{open.shipping_street}, {open.shipping_number}{open.shipping_complement ? ` - ${open.shipping_complement}` : ''}<br />{open.shipping_district} · {open.shipping_city}/{open.shipping_state}<br />CEP {open.shipping_cep}<br />{open.shipping_method} · {brl(open.shipping_cost)}</p></div>
          </div>
          <p><span className="small muted">Criado em</span> {fmtDateTime(open.created_at)} · <span className="small muted">Pagamento</span> {PAYMENT[open.payment_method]} · <span className={`status ${open.status}`}>{STATUS[open.status]}</span></p>
          <table className="table responsive"><thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead>
            <tbody>{items.map((i) => <tr key={i.id}><td data-label="Item">{i.product_name}<br /><span className="small muted">{i.variant_label}</span></td><td data-label="Qtd.">{i.quantity}</td><td data-label="Unit." className="price">{brl(i.unit_price)}</td><td data-label="Total" className="price">{brl(i.unit_price * i.quantity)}</td></tr>)}
              <tr><td data-label="Subtotal" colSpan={3} className="muted">Subtotal</td><td data-label="Valor" className="price">{brl(open.subtotal)}</td></tr>
              {+open.discount > 0 && <tr><td data-label="Desconto" colSpan={3} className="pix-tag">Desconto Pix</td><td data-label="Valor" className="price pix-tag">−{brl(open.discount)}</td></tr>}
              <tr><td data-label="Frete" colSpan={3} className="muted">Frete</td><td data-label="Valor" className="price">{brl(open.shipping_cost)}</td></tr>
              <tr><td data-label="Total" colSpan={3}><strong>Total</strong></td><td data-label="Valor" className="price gold"><strong>{brl(open.total)}</strong></td></tr>
            </tbody></table>
          {open.notes && <p className="small muted">Observacoes: {open.notes}</p>}
          <div className="field-group">
            <div className="step-title" style={{ marginBottom: 8 }}>Atualizar status</div>
            <div className="chips">{FLOW.filter((s) => s !== open.status).map((s) => (
              <button key={s} className={`chip ${s === 'cancelado' ? 'red' : ''}`} onClick={() => change(open, s)}>{STATUS[s]}</button>))}</div>
            <p className="small muted" style={{ marginTop: 8 }}>Cancelar devolve o estoque das variacoes e remove contas a receber em aberto.</p>
          </div>
          {err && <div className="alert error">{err}</div>}
          {variantLabel && null}
        </Modal>)}
      {toast}
    </>
  );
}
