import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseConfigured } from '../lib/supabase.js';
import { descendants, fetchCategories, fetchProducts } from '../lib/catalog.js';
import { ErrorBox, ProductCard, ProductGridSkeleton } from '../components/Public.jsx';
import { errMsg } from '../lib/utils.js';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cat = params.get('categoria') || '';
  const q = params.get('q') || '';
  const sort = params.get('ordem') || 'relevancia';
  const [term, setTerm] = useState(q);

  useEffect(() => setTerm(q), [q]);
  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([c, p]) => { setCats(c); setProducts(p); })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (term === q) return;
      const n = new URLSearchParams(params);
      term ? n.set('q', term) : n.delete('q');
      setParams(n, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [term]);

  const setParam = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n); };

  const list = useMemo(() => {
    let l = products;
    if (cat) { const ids = descendants(cats, cat); l = l.filter((p) => ids.includes(p.category_id)); }
    if (q) {
      const t = q.toLowerCase();
      l = l.filter((p) => [p.name, p.brand, p.description].some((x) => x?.toLowerCase().includes(t)));
    }
    const s = [...l];
    if (sort === 'menor') s.sort((a, b) => a.price - b.price);
    else if (sort === 'maior') s.sort((a, b) => b.price - a.price);
    else if (sort === 'novos') s.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'az') s.sort((a, b) => a.name.localeCompare(b.name));
    else s.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (b.featured - a.featured));
    return s;
  }, [products, cats, cat, q, sort]);

  const roots = cats.filter((c) => !c.parent_id);
  const current = cats.find((c) => c.id === cat);

  return (
    <div className="container">
      <div style={{ paddingTop: 28 }}>
        <div className="eyebrow">Colecao</div>
        <h1>{current ? current.name : q ? `Busca: "${q}"` : 'Todas as pecas'}</h1>
      </div>
      <div className="pills" style={{ marginTop: 10 }}>
        <button className={`pill ${!cat ? 'active' : ''}`} onClick={() => setParam('categoria', '')}>Todas</button>
        {cats.map((c) => <button key={c.id} className={`pill ${cat === c.id ? 'active' : ''}`} onClick={() => setParam('categoria', c.id)}>{c.name}</button>)}
      </div>
      <div className="shop-layout">
        <aside className="sidebar-filters">
          <div className="step-title" style={{ marginBottom: 8 }}>Categorias</div>
          <button className={`filter-link ${!cat ? 'active' : ''}`} onClick={() => setParam('categoria', '')}><span>Todas</span><span>{products.length}</span></button>
          {roots.map((c) => (
            <React.Fragment key={c.id}>
              <button className={`filter-link ${cat === c.id ? 'active' : ''}`} onClick={() => setParam('categoria', c.id)}>
                <span>{c.name}</span><span>{products.filter((p) => descendants(cats, c.id).includes(p.category_id)).length}</span>
              </button>
              {cats.filter((s) => s.parent_id === c.id).map((s) => (
                <button key={s.id} className={`filter-link sub ${cat === s.id ? 'active' : ''}`} onClick={() => setParam('categoria', s.id)}><span>— {s.name}</span></button>
              ))}
            </React.Fragment>
          ))}
        </aside>
        <div>
          <div className="toolbar">
            <input type="search" placeholder="Buscar na colecao..." value={term} onChange={(e) => setTerm(e.target.value)} style={{ flex: '1 1 200px' }} aria-label="Buscar" />
            <select value={sort} onChange={(e) => setParam('ordem', e.target.value === 'relevancia' ? '' : e.target.value)} aria-label="Ordenar">
              <option value="relevancia">Relevancia</option>
              <option value="novos">Mais novos</option>
              <option value="menor">Menor preco</option>
              <option value="maior">Maior preco</option>
              <option value="az">A–Z</option>
            </select>
          </div>
          <ErrorBox>{error}</ErrorBox>
          {loading ? <ProductGridSkeleton /> : list.length === 0
            ? <div className="empty">Nenhum produto encontrado.{(cat || q) && <><br /><br /><button className="btn btn-ghost" onClick={() => { setTerm(''); setParams({}); }}>Limpar filtros</button></>}</div>
            : <>
              <p className="small muted">{list.length} {list.length === 1 ? 'peca' : 'pecas'}</p>
              <div className="grid-products cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </>}
        </div>
      </div>
    </div>
  );
}
