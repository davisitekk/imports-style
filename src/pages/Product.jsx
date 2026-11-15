import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart, useStore } from '../context.jsx';
import { supabaseConfigured } from '../lib/supabase.js';
import { fetchProduct, fetchProducts } from '../lib/catalog.js';
import { ErrorBox, ProductCard, Spinner } from '../components/Public.jsx';
import { brl, errMsg, productImage } from '../lib/utils.js';

export default function Product() {
  const { id } = useParams();
  const { add } = useCart();
  const info = useStore();
  const [p, setP] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [img, setImg] = useState(0);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true); setError(''); setImg(0); setSize(''); setColor(''); setQty(1);
    fetchProduct(id).then(async (prod) => {
      setP(prod);
      if (prod) {
        const sizes = [...new Set(prod.variants.map((v) => v.size).filter(Boolean))];
        const colors = [...new Set(prod.variants.map((v) => v.color).filter(Boolean))];
        if (sizes.length === 1) setSize(sizes[0]);
        if (colors.length === 1) setColor(colors[0]);
        const rel = await fetchProducts({ categoryIds: prod.category_id ? [prod.category_id] : undefined, limit: 9 });
        setRelated(rel.filter((r) => r.id !== prod.id).slice(0, 4));
      }
    }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, [id]);

  const sizes = useMemo(() => [...new Set((p?.variants || []).map((v) => v.size).filter(Boolean))], [p]);
  const colors = useMemo(() => [...new Set((p?.variants || []).map((v) => v.color).filter(Boolean))], [p]);
  const find = (s, c) => p?.variants.find((v) => (v.size || '') === (s || '') && (v.color || '') === (c || ''));
  const sizeAvail = (s) => p.variants.some((v) => v.size === s && v.stock > 0 && (!color || v.color === color));
  const colorAvail = (c) => p.variants.some((v) => v.color === c && v.stock > 0 && (!size || v.size === size));
  const needSize = sizes.length > 0, needColor = colors.length > 0;
  const variant = (!needSize || size) && (!needColor || color) ? find(size, color) : null;
  const price = variant?.price_override ?? p?.price;
  const images = useMemo(() => {
    if (!p) return [];
    const list = [...(p.images?.length ? p.images : [productImage(p)])];
    p.variants.forEach((v) => v.image_url && !list.includes(v.image_url) && list.push(v.image_url));
    return list;
  }, [p]);

  useEffect(() => {
    if (variant?.image_url) { const i = images.indexOf(variant.image_url); if (i >= 0) setImg(i); }
    if (variant && qty > variant.stock) setQty(Math.max(1, variant.stock));
  }, [variant]);

  if (loading) return <Spinner />;
  if (error) return <div className="container"><ErrorBox>{error}</ErrorBox></div>;
  if (!p) return <div className="container empty"><h2>Produto nao encontrado</h2><Link to="/loja" className="btn btn-gold">Ver colecao</Link></div>;

  const handleAdd = () => {
    setMsg('');
    if (needSize && !size) return setMsg('Selecione um tamanho.');
    if (needColor && !color) return setMsg('Selecione uma cor.');
    if (!variant || variant.stock <= 0) return setMsg('Combinacao indisponivel.');
    add({ variant_id: variant.id, product_id: p.id, name: p.name, brand: p.brand, image: variant.image_url || productImage(p),
      size: variant.size, color: variant.color, price: Number(price), quantity: qty, stock: variant.stock });
  };

  const soldOut = p.stock <= 0;
  let label = 'Adicionar ao carrinho';
  if (soldOut) label = 'Esgotado';
  else if (variant && variant.stock <= 0) label = 'Indisponivel';

  return (
    <div className="container">
      <div className="pdp">
        <div>
          <div className="gallery-main"><img src={images[img]} alt={p.name} /></div>
          {images.length > 1 && (
            <div className="thumbs">{images.map((u, i) => <button key={u} className={i === img ? 'active' : ''} onClick={() => setImg(i)} aria-label={`Imagem ${i + 1}`}><img src={u} alt="" /></button>)}</div>
          )}
        </div>
        <div>
          <div className="small muted"><Link to="/loja">Colecao</Link> / {p.name}</div>
          <div className="pcard-brand" style={{ marginTop: 14 }}>{p.brand}</div>
          <h1>{p.name}</h1>
          <div className="price" style={{ fontSize: 30 }}>{brl(price)}</div>
          <div className="pix-tag" style={{ fontSize: 14 }}>{brl(price * (1 - info.pix_discount / 100))} no Pix ({info.pix_discount}% off)</div>
          <div className="small muted">ou 3x de {brl(price / 3)} sem juros</div>

          {needSize && (
            <div className="field-group">
              <div className="step-title" style={{ marginBottom: 8 }}>Tamanho {size && <span className="gold">· {size}</span>}</div>
              <div className="chips">{sizes.map((s) => <button key={s} className={`chip ${size === s ? 'active' : ''}`} disabled={!sizeAvail(s)} onClick={() => setSize(size === s ? '' : s)}>{s}</button>)}</div>
            </div>
          )}
          {needColor && (
            <div className="field-group">
              <div className="step-title" style={{ marginBottom: 8 }}>Cor {color && <span className="gold">· {color}</span>}</div>
              <div className="chips">{colors.map((c) => <button key={c} className={`chip ${color === c ? 'active' : ''}`} disabled={!colorAvail(c)} onClick={() => setColor(color === c ? '' : c)}>{c}</button>)}</div>
            </div>
          )}
          {variant && <p className={`small ${variant.stock > 0 && variant.stock <= 3 ? 'gold' : 'muted'}`}>{variant.stock > 0 ? `${variant.stock} em estoque` : 'Sem estoque'}</p>}
          {msg && <div className="alert error">{msg}</div>}

          <div className="buy-bar">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Diminuir">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(qty + 1)} disabled={variant ? qty >= variant.stock : true} aria-label="Aumentar">+</button>
            </div>
            <button className="btn btn-gold" onClick={handleAdd} disabled={soldOut || (variant && variant.stock <= 0)}>{label}</button>
          </div>

          {p.description && <div className="field-group"><div className="step-title" style={{ marginBottom: 8 }}>Descricao</div><p className="muted" style={{ whiteSpace: 'pre-line' }}>{p.description}</p></div>}
          <div className="alert small">✦ Envio para todo o Brasil · Frete gratis acima de {brl(info.free_shipping_over)} (PAC)</div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head"><h2>Voce tambem pode gostar</h2></div>
          <div className="grid-products cols-4">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
