import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCart, useStore } from '../context.jsx';
import { supabase } from '../lib/supabase.js';
import { brl, productImage, variantLabel } from '../lib/utils.js';

export const Icon = {
  menu: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M3 12h18M3 18h18" /></svg>,
  close: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  search: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="7" /><path d="M20 20l-5-5" /></svg>,
  bag: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8h14l-1 13H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>,
};

export const Spinner = () => <div className="spinner" role="status" aria-label="Carregando" />;
export const ErrorBox = ({ children }) => children ? <div className="alert error">{children}</div> : null;

export function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef();
  const show = (m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(''), 2800); };
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [node, show];
}

export const Logo = ({ to = '/' }) => (
  <Link to={to} className="logo" aria-label="Importados Style"><b>I</b>MPORTADOS STYLE</Link>
);

export function ProductCard({ p }) {
  const info = useStore();
  const out = p.stock !== undefined && p.stock <= 0;
  return (
    <Link to={`/loja/${p.id}`} className="pcard">
      <div className="pcard-img">
        <img src={productImage(p)} alt={p.name} loading="lazy" />
        {out && <span className="tag">Esgotado</span>}
      </div>
      <div className="pcard-body">
        <div className="pcard-brand">{p.brand || 'Importados'}</div>
        <div className="pcard-name">{p.name}</div>
        <div className="pcard-price">{brl(p.price)}</div>
        <span className="pix-tag">{brl(p.price * (1 - info.pix_discount / 100))} no Pix</span>
      </div>
    </Link>
  );
}

export function CategoryCard({ c, count }) {
  return (
    <Link to={`/loja?categoria=${c.id}`} className="ccard">
      <img src={c.image_url || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800'} alt={c.name} loading="lazy" />
      <div><h3>{c.name}</h3><span>{count != null ? `${count} pecas` : 'Ver pecas'} →</span></div>
    </Link>
  );
}

export function Ticker({ brands }) {
  const list = brands?.length ? brands : ['DESIGN', 'NIKE', 'ADIDAS', 'NEW ERA', 'JORDAN'];
  const all = [...list, ...list, ...list, ...list];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">{all.map((b, i) => <span key={i}>{b}<i>✦</i></span>)}</div>
    </div>
  );
}

export function ProductGridSkeleton({ n = 8 }) {
  return (
    <div className="grid-products cols-4">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '4/6' }} />)}
    </div>
  );
}

const RECENT_KEY = 'is_recent_searches';
function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [cats, setCats] = useState([]);
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } });
  const nav = useNavigate();
  const inputRef = useRef();

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    if (supabase) {
      supabase.from('products').select('id,name,price,image_url,images,brand').eq('active', true).eq('featured', true).limit(4).then(({ data }) => setFeatured(data || []));
      supabase.from('categories').select('id,name').eq('active', true).is('parent_id', null).then(({ data }) => setCats(data || []));
    }
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || !supabase) { setResults([]); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      const safe = term.replace(/[%,()]/g, ' ');
      const { data } = await supabase.from('products').select('id,name,price,image_url,images,brand')
        .eq('active', true).or(`name.ilike.%${safe}%,brand.ilike.%${safe}%`).limit(8);
      setResults(data || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const submit = (term) => {
    const t = (term ?? q).trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
    onClose();
    nav(`/loja?q=${encodeURIComponent(t)}`);
  };
  const go = (path) => { onClose(); nav(path); };

  const Row = ({ p }) => (
    <button className="sugg-row" onClick={() => go(`/loja/${p.id}`)}>
      <img src={productImage(p)} alt="" />
      <span><span className="pcard-brand">{p.brand}</span><br />{p.name}</span>
      <span className="price">{brl(p.price)}</span>
    </button>
  );

  return (
    <div className="search-box" role="dialog" aria-label="Buscar">
      <div className="container">
        <form className="search-input-row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {Icon.search}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pecas, marcas..." enterKeyHint="search" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">{Icon.close}</button>
        </form>
        {q.trim().length >= 2 ? (
          <>
            <div className="sugg-title">Resultados</div>
            {loading && <Spinner />}
            {!loading && results.length === 0 && <p className="muted">Nenhum produto encontrado para "{q}".</p>}
            {!loading && results.map((p) => <Row key={p.id} p={p} />)}
            {!loading && results.length > 0 && <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={() => submit()}>Ver todos os resultados</button>}
          </>
        ) : (
          <>
            {recent.length > 0 && (<>
              <div className="sugg-title">Buscas recentes</div>
              <div className="chips">
                {recent.map((r) => <button key={r} className="pill" onClick={() => submit(r)}>{r}</button>)}
                <button className="link-btn" onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }}>Limpar</button>
              </div>
            </>)}
            {cats.length > 0 && (<>
              <div className="sugg-title">Categorias</div>
              <div className="chips">{cats.map((c) => <button key={c.id} className="pill" onClick={() => go(`/loja?categoria=${c.id}`)}>{c.name}</button>)}</div>
            </>)}
            {featured.length > 0 && (<>
              <div className="sugg-title">Destaques</div>
              {featured.map((p) => <Row key={p.id} p={p} />)}
            </>)}
          </>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, update, remove, subtotal } = useCart();
  const nav = useNavigate();
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={() => setOpen(false)} />
      <aside className="drawer right" aria-label="Carrinho">
        <div className="drawer-head"><h3 style={{ margin: 0 }}>Carrinho</h3><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar">{Icon.close}</button></div>
        <div className="drawer-body">
          {items.length === 0 ? <div className="empty">Seu carrinho esta vazio.</div> : <CartList items={items} update={update} remove={remove} />}
        </div>
        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="summary-row"><span>Subtotal</span><strong className="price">{brl(subtotal)}</strong></div>
            <button className="btn btn-gold btn-block" style={{ marginTop: 10 }} onClick={() => { setOpen(false); nav('/checkout'); }}>Finalizar compra</button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setOpen(false); nav('/carrinho'); }}>Ver carrinho</button>
          </div>
        )}
      </aside>
    </>
  );
}

export function CartList({ items, update, remove }) {
  return items.map((i) => (
    <div className="cart-item" key={i.variant_id}>
      <Link to={`/loja/${i.product_id}`}><img src={i.image} alt={i.name} /></Link>
      <div>
        <div className="pcard-brand">{i.brand}</div>
        <div style={{ fontSize: 14 }}>{i.name}</div>
        <div className="small muted">{variantLabel(i)}</div>
        <div className="cart-item-row">
          <div className="qty">
            <button onClick={() => update(i.variant_id, i.quantity - 1)} disabled={i.quantity <= 1} aria-label="Diminuir">−</button>
            <span>{i.quantity}</span>
            <button onClick={() => update(i.variant_id, i.quantity + 1)} disabled={i.quantity >= i.stock} aria-label="Aumentar">+</button>
          </div>
          <strong className="price">{brl(i.price * i.quantity)}</strong>
        </div>
        {i.quantity >= i.stock && <div className="small gold">Maximo em estoque: {i.stock}</div>}
        <button className="link-btn" onClick={() => remove(i.variant_id)}>Remover</button>
      </div>
    </div>
  ));
}

export function PublicLayout({ notFound }) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const { count, setOpen } = useCart();
  const info = useStore();
  const links = [['/', 'Inicio'], ['/loja', 'Colecao'], ['/loja?ordem=novos', 'Novidades'], ['/carrinho', 'Carrinho']];

  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : ''; }, [menu]);

  return (
    <>
      <div className="announce">PECAS IMPORTADAS · ENVIO PARA TODO O BRASIL · PAGUE COM PIX</div>
      <header className="header">
        <div className="container header-inner">
          <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Abrir menu">{Icon.menu}</button>
          <Logo />
          <nav className="nav-desk">{links.slice(0, 3).map(([to, l]) => <NavLink key={to} to={to} end>{l}</NavLink>)}</nav>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setSearch(true)} aria-label="Buscar">{Icon.search}</button>
            <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Carrinho">{Icon.bag}{count > 0 && <span className="badge-count">{count}</span>}</button>
          </div>
        </div>
      </header>

      {menu && (<>
        <div className="overlay" onClick={() => setMenu(false)} />
        <aside className="drawer left" aria-label="Menu">
          <div className="drawer-head"><Logo /><button className="icon-btn" onClick={() => setMenu(false)} aria-label="Fechar">{Icon.close}</button></div>
          <nav className="drawer-body drawer-nav">
            {links.map(([to, l]) => <Link key={to} to={to} onClick={() => setMenu(false)}>{l}</Link>)}
            <Link to="/auth" onClick={() => setMenu(false)} style={{ fontSize: 16, color: 'var(--t3)' }}>Acesso da equipe</Link>
          </nav>
        </aside>
      </>)}
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      <CartDrawer />

      <main>
        {notFound ? (
          <div className="container empty" style={{ padding: '100px 16px' }}>
            <h1>404</h1><p>Pagina nao encontrada.</p><Link to="/" className="btn btn-gold">Voltar ao inicio</Link>
          </div>
        ) : <Outlet />}
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div><Logo /><p className="muted small" style={{ maxWidth: 320 }}>Luxury streetwear curado com precisao. Pecas importadas com envio para todo o Brasil.</p></div>
            <div><h4>Loja</h4><Link to="/loja">Colecao</Link><Link to="/loja?ordem=novos">Novidades</Link><Link to="/carrinho">Carrinho</Link></div>
            <div><h4>Ajuda</h4><Link to="/checkout">Checkout</Link><a href={info.whatsapp ? `https://wa.me/${info.whatsapp}` : '#'} target="_blank" rel="noreferrer">Atendimento</a><Link to="/auth">Equipe</Link></div>
            <div><h4>Redes</h4>
              <a href={`https://instagram.com/${info.instagram || ''}`} target="_blank" rel="noreferrer">Instagram</a>
              <a href={info.whatsapp ? `https://wa.me/${info.whatsapp}` : '#'} target="_blank" rel="noreferrer">WhatsApp</a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer">TikTok</a>
            </div>
          </div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} Importados Style. Todos os direitos reservados.</span><span>Pix · Cartao · Boleto</span></div>
        </div>
      </footer>
    </>
  );
}
