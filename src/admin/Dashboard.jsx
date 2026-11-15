import React from 'react';
import { Link } from 'react-router-dom';
import { sb } from '../lib/supabase.js';
import { brl, fmtDateTime, STATUS, variantLabel } from '../lib/utils.js';
import { unwrap, useLoad } from './ui.jsx';

export default function Dashboard() {
  const { data, loading, error } = useLoad(async () => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [orders, variants] = await Promise.all([
      sb().from('orders').select('id,number,status,total,customer_name,created_at').gte('created_at', since).order('created_at', { ascending: false }),
      sb().from('product_variants').select('id,size,color,stock,product_id,products(name,min_stock,active)').eq('active', true),
    ]);
    return { orders: unwrap(orders), variants: unwrap(variants) };
  });

  if (loading) return <div className="spinner" />;
  if (error) return <div className="alert error">{error}</div>;
  const valid = data.orders.filter((o) => o.status !== 'cancelado');
  const paid = valid.filter((o) => o.status !== 'aguardando_pagamento');
  const low = data.variants.filter((v) => v.products?.active && v.stock <= (v.products?.min_stock ?? 2)).sort((a, b) => a.stock - b.stock);

  return (
    <>
      <div className="page-head"><h1>Dashboard</h1><span className="small muted">Ultimos 30 dias</span></div>
      <div className="kpis">
        <div className="kpi"><span>Vendas pagas</span><strong>{brl(paid.reduce((s, o) => s + +o.total, 0))}</strong></div>
        <div className="kpi"><span>Pedidos</span><strong>{valid.length}</strong></div>
        <div className="kpi"><span>Aguardando pgto</span><strong>{valid.filter((o) => o.status === 'aguardando_pagamento').length}</strong></div>
        <div className="kpi"><span>Estoque baixo</span><strong>{low.length}</strong></div>
      </div>
      <div className="split" style={{ gridTemplateColumns: undefined }}>
        <div className="card">
          <div className="section-head"><h3>Pedidos recentes</h3><Link to="/pedidos">Ver todos</Link></div>
          {data.orders.length === 0 ? <p className="muted">Nenhum pedido.</p> : (
            <table className="table responsive"><tbody>{data.orders.slice(0, 8).map((o) => (
              <tr key={o.id}><td data-label="Pedido">#{o.number}</td><td data-label="Cliente">{o.customer_name}</td><td data-label="Total" className="price">{brl(o.total)}</td><td data-label="Status"><span className={`status ${o.status}`}>{STATUS[o.status]}</span></td><td data-label="Data" className="small muted">{fmtDateTime(o.created_at)}</td></tr>
            ))}</tbody></table>)}
        </div>
        <div className="card">
          <div className="section-head"><h3>Estoque baixo</h3><Link to="/estoque">Movimentar</Link></div>
          {low.length === 0 ? <p className="muted">Tudo em ordem.</p> : low.slice(0, 12).map((v) => (
            <div key={v.id} className="summary-row small"><span>{v.products?.name} <span className="muted">{variantLabel(v)}</span></span><span className={v.stock === 0 ? 'red' : 'gold'}>{v.stock}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}
