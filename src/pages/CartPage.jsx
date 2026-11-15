import React from 'react';
import { Link } from 'react-router-dom';
import { useCart, useStore } from '../context.jsx';
import { CartList } from '../components/Public.jsx';
import { brl } from '../lib/utils.js';

export default function CartPage() {
  const { items, update, remove, subtotal, clear } = useCart();
  const info = useStore();
  if (!items.length) return (
    <div className="container empty" style={{ padding: '80px 16px' }}>
      <h1>Carrinho vazio</h1><p>Explore a colecao e encontre sua proxima peca.</p>
      <Link to="/loja" className="btn btn-gold">Explorar colecao</Link>
    </div>
  );
  const missing = info.free_shipping_over - subtotal;
  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <h1>Carrinho</h1>
      <div className="checkout-layout">
        <div>
          <CartList items={items} update={update} remove={remove} />
          <button className="link-btn" onClick={clear}>Esvaziar carrinho</button>
        </div>
        <aside className="summary" style={{ alignSelf: 'start' }}>
          <div className="summary-row"><span>Subtotal</span><span className="price">{brl(subtotal)}</span></div>
          <div className="summary-row"><span className="pix-tag">No Pix ({info.pix_discount}% off)</span><span className="price pix-tag">{brl(subtotal * (1 - info.pix_discount / 100))}</span></div>
          <p className="small muted">{missing > 0 ? `Faltam ${brl(missing)} para frete gratis (PAC).` : 'Voce ganhou frete gratis (PAC)!'}</p>
          <div className="summary-row total"><span>Total</span><strong className="price">{brl(subtotal)}</strong></div>
          <Link to="/checkout" className="btn btn-gold btn-block" style={{ marginTop: 12 }}>Ir para o checkout</Link>
          <Link to="/loja" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>Continuar comprando</Link>
        </aside>
      </div>
    </div>
  );
}
