import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context.jsx';
import { supabaseConfigured } from '../lib/supabase.js';
import { fetchCategories, fetchProducts, descendants } from '../lib/catalog.js';
import { CategoryCard, ErrorBox, ProductCard, ProductGridSkeleton, Ticker } from '../components/Public.jsx';
import { errMsg } from '../lib/utils.js';

const HERO = 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=2000&q=80';

export default function Home() {
  const info = useStore();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([c, p]) => { setCats(c); setProducts(p); })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  const roots = cats.filter((c) => !c.parent_id);
  const countIn = (id) => { const ids = descendants(cats, id); return products.filter((p) => ids.includes(p.category_id)).length; };
  const featured = (products.filter((p) => p.featured).length ? products.filter((p) => p.featured) : products).slice(0, 8);
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].map((b) => b.toUpperCase());

  return (
    <>
      <section className="hero">
        <img className="hero-bg" src={HERO} alt="" fetchpriority="high" />
        <div className="container hero-content">
          <div className="eyebrow">Nova colecao · {new Date().getFullYear()}</div>
          <h1>DEFINE<br />YOUR <span>ERA.</span></h1>
          <p>Luxury streetwear curado com precisao</p>
          <div className="hero-actions">
            <Link to="/loja" className="btn btn-gold">Explorar colecao</Link>
            <a href="#categorias" className="btn btn-outline">Ver categorias</a>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="stats">
          <div className="stat"><strong>{info.products_count || products.length}+</strong><span>Pecas</span></div>
          <div className="stat"><strong>{info.categories_count || cats.length}</strong><span>Categorias</span></div>
          <div className="stat"><strong>{info.brands_count || brands.length}</strong><span>Marcas</span></div>
        </div>
      </div>

      <ErrorBox>{error && <div className="container">{error}</div>}</ErrorBox>

      <section className="section container" id="categorias">
        <div className="section-head"><div><div className="eyebrow">Navegue</div><h2>Categorias</h2></div><Link to="/loja">Ver tudo →</Link></div>
        {loading ? <div className="grid-cats">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ aspectRatio: '3/4' }} />)}</div>
          : roots.length ? <div className="grid-cats">{roots.map((c) => <CategoryCard key={c.id} c={c} count={countIn(c.id)} />)}</div>
          : <div className="empty">Nenhuma categoria cadastrada.</div>}
      </section>

      <Ticker brands={brands} />

      <section className="section container">
        <div className="section-head"><div><div className="eyebrow">Curadoria</div><h2>Destaques</h2></div><Link to="/loja">Ver colecao →</Link></div>
        {loading ? <ProductGridSkeleton /> : featured.length
          ? <div className="grid-products cols-4">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <div className="empty">Nenhum produto disponivel ainda.</div>}
      </section>

      {!loading && roots.map((c) => {
        const ids = descendants(cats, c.id);
        const list = products.filter((p) => ids.includes(p.category_id)).slice(0, 4);
        if (!list.length) return null;
        return (
          <section className="section container" key={c.id} style={{ paddingTop: 0 }}>
            <div className="section-head"><h2>{c.name}</h2><Link to={`/loja?categoria=${c.id}`}>Ver todos →</Link></div>
            <div className="grid-products cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        );
      })}
    </>
  );
}
