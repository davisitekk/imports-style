import React, { useState } from 'react';
import { sb } from '../lib/supabase.js';
import { errMsg, variantLabel } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { Field, Modal, unwrap, useLoad } from './ui.jsx';

const TYPES = [['entrada', 'Entrada (+)'], ['saida', 'Saida (-)'], ['ajuste', 'Ajuste (definir)'], ['devolucao', 'Devolucao (+)']];

export default function Stock() {
  const [q, setQ] = useState('');
  const [low, setLow] = useState(false);
  const [move, setMove] = useState(null);
  const [type, setType] = useState('entrada');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [toast, showToast] = useToast();
  const variants = useLoad(async () => unwrap(await sb().from('product_variants')
    .select('id,size,color,sku,stock,active,product_id,products(name,brand,min_stock,active)').order('stock')));
  const history = useLoad(async () => unwrap(await sb().from('stock_movements')
    .select('id,type,quantity,reason,created_at,variant_id,products(name)').order('created_at', { ascending: false }).limit(30)), []);

  const all = (variants.data || []).filter((v) => v.products);
  const list = all.filter((v) => {
    if (low && v.stock > (v.products?.min_stock ?? 2)) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return `${v.products?.name} ${v.products?.brand} ${v.sku} ${v.size} ${v.color}`.toLowerCase().includes(t);
  });

  const submit = async () => {
    setErr('');
    if (!move) return;
    const n = parseInt(qty, 10);
    if (!(type === 'ajuste' ? n >= 0 : n > 0)) return setErr('Informe uma quantidade valida.');
    try {
      const newStock = unwrap(await sb().rpc('move_stock', { p_variant_id: move.id, p_type: type, p_quantity: n, p_reason: reason || null }));
      showToast(`Estoque atualizado: ${newStock} un.`);
      setMove(null); setQty(1); setReason('');
      variants.reload(); history.reload();
    } catch (e) { setErr(errMsg(e)); }
  };

  const lowCount = all.filter((v) => v.stock <= (v.products?.min_stock ?? 2)).length;

  return (
    <>
      <div className="page-head"><h1>Estoque</h1><span className="small muted">{lowCount} variacoes no limite minimo</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar por produto, SKU, tamanho ou cor..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
        <label className="check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />So estoque baixo</label>
      </div>
      {variants.error && <div className="alert error">{variants.error}</div>}
      {variants.loading ? <div className="spinner" /> : list.length === 0 ? <div className="empty">Nenhuma variacao encontrada.</div> : (
        <table className="table responsive">
          <thead><tr><th>Produto</th><th>Variacao</th><th>SKU</th><th>Estoque</th><th>Minimo</th><th /></tr></thead>
          <tbody>{list.map((v) => (
            <tr key={v.id}>
              <td data-label="Produto">{v.products?.name}<br /><span className="small muted">{v.products?.brand}</span></td>
              <td data-label="Variacao">{variantLabel(v) || 'Unica'}{v.active === false && <span className="small muted"> (inativa)</span>}</td>
              <td data-label="SKU" className="small">{v.sku || '-'}</td>
              <td data-label="Estoque"><strong className={v.stock === 0 ? 'red' : v.stock <= (v.products?.min_stock ?? 2) ? 'gold' : ''}>{v.stock}</strong></td>
              <td data-label="Minimo" className="small muted">{v.products?.min_stock ?? 2}</td>
              <td className="no-label"><div className="row-actions"><button className="btn btn-gold btn-sm" onClick={() => { setMove(v); setType('entrada'); setQty(1); setErr(''); }}>Movimentar</button></div></td>
            </tr>))}</tbody>
        </table>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Ultimas movimentacoes</h3>
        {(history.data || []).length === 0 ? <p className="muted small">Sem movimentacoes.</p> : (
          <table className="table responsive"><thead><tr><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Motivo</th><th>Data</th></tr></thead>
            <tbody>{history.data.map((h) => (
              <tr key={h.id}><td data-label="Produto">{h.products?.name || '-'}</td><td data-label="Tipo">{h.type}</td><td data-label="Qtd.">{h.quantity > 0 ? `+${h.quantity}` : h.quantity}</td><td data-label="Motivo">{h.reason || '-'}</td><td data-label="Data" className="small muted">{new Date(h.created_at).toLocaleString('pt-BR')}</td></tr>))}
            </tbody></table>)}
      </div>

      {move && (
        <Modal title="Movimentar estoque" onClose={() => setMove(null)} footer={<><button className="btn btn-ghost" onClick={() => setMove(null)}>Cancelar</button><button className="btn btn-gold" onClick={submit}>Confirmar</button></>}>
          <p><strong>{move.products?.name}</strong><br /><span className="muted">{variantLabel(move) || 'Unica'} · SKU {move.sku || '-'} · estoque atual {move.stock}</span></p>
          <div className="form-grid two" style={{ marginTop: 12 }}>
            <Field label="Tipo de movimentacao"><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label={type === 'ajuste' ? 'Novo estoque' : 'Quantidade'}><input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: recebimento fornecedor, perda, inventario" /></Field></div>
          {err && <div className="alert error">{err}</div>}
        </Modal>)}
      {toast}
    </>
  );
}
