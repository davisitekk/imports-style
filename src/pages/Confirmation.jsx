import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context.jsx';
import { brl, PAYMENT } from '../lib/utils.js';

export default function Confirmation() {
  const { number } = useParams();
  const info = useStore();
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('is_last_order')); } catch { o = null; }
  if (o && String(o.number) !== String(number)) o = null;
  const wa = info.whatsapp ? `https://wa.me/${info.whatsapp}?text=${encodeURIComponent(`Ola! Acabei de fazer o pedido #${number}.`)}` : null;

  return (
    <div className="container" style={{ padding: '60px 16px', maxWidth: 640, textAlign: 'center' }}>
      <div className="eyebrow">Pedido recebido</div>
      <h1>Obrigado!</h1>
      <p className="muted">Seu pedido foi criado com sucesso.</p>
      <div className="card" style={{ margin: '24px 0' }}>
        <div className="step-title">Numero do pedido</div>
        <div className="price gold" style={{ fontSize: 48 }}>#{number}</div>
        {o && <>
          <p>Total: <strong className="price">{brl(o.total)}</strong> · {PAYMENT[o.payment_method] || o.payment_method}</p>
          <span className="status aguardando_pagamento">Aguardando pagamento</span>
          {o.payment_method === 'pix' && <p className="small muted" style={{ marginTop: 14 }}>As instrucoes de pagamento via Pix serao enviadas para {o.email} e pelo WhatsApp.</p>}
        </>}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {wa && <a href={wa} className="btn btn-gold" target="_blank" rel="noreferrer">Falar no WhatsApp</a>}
        <Link to="/loja" className="btn btn-outline">Continuar comprando</Link>
      </div>
    </div>
  );
}
