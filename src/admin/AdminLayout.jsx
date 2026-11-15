import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context.jsx';
import { Icon, Logo, Spinner } from '../components/Public.jsx';

const NAV = [
  ['Geral', [['/dashboard', 'Dashboard']]],
  ['Catalogo', [['/produtos', 'Produtos'], ['/categorias', 'Categorias'], ['/estoque', 'Estoque']]],
  ['Vendas', [['/pedidos', 'Pedidos'], ['/clientes', 'Clientes']]],
  ['Financeiro', [['/financeiro/caixa', 'Caixa'], ['/financeiro/contas', 'Contas'], ['/financeiro/pagar', 'A pagar'], ['/financeiro/receber', 'A receber']]],
  ['Sistema', [['/fornecedores', 'Fornecedores'], ['/usuarios', 'Usuarios'], ['/configuracoes', 'Configuracoes']]],
];

export default function AdminLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;

  return (
    <div className="admin">
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <Logo to="/dashboard" />
        <nav className="admin-nav">
          {NAV.map(([g, links]) => (
            <div key={g}><div className="admin-nav-label">{g}</div>{links.map(([to, l]) => <NavLink key={to} to={to}>{l}</NavLink>)}</div>
          ))}
          <div className="admin-nav-label">Loja</div><Link to="/" target="_blank">Ver loja ↗</Link>
        </nav>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <button className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Menu">{Icon.menu}</button>
          <span className="small muted" style={{ marginLeft: 'auto' }}>{profile?.name || session.user.email} · <span className="gold">{profile?.role || 'sem perfil'}</span></span>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sair</button>
        </div>
        <div className="admin-content"><Outlet /></div>
      </div>
    </div>
  );
}
