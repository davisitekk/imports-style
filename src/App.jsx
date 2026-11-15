import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/Public.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import Confirmation from './pages/Confirmation.jsx';
import AuthPage from './pages/AuthPage.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Dashboard from './admin/Dashboard.jsx';
import Products from './admin/Products.jsx';
import Categories from './admin/Categories.jsx';
import Stock from './admin/Stock.jsx';
import Orders from './admin/Orders.jsx';
import { Customers, Suppliers, Users, Settings } from './admin/Records.jsx';
import { Cash, Accounts, Entries } from './admin/Finance.jsx';
import { supabaseConfigured } from './lib/supabase.js';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      {!supabaseConfigured && (
        <div className="config-warning">
          Supabase nao configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).
        </div>
      )}
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/loja" element={<Shop />} />
          <Route path="/loja/:id" element={<Product />} />
          <Route path="/carrinho" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pedido/:number" element={<Confirmation />} />
        </Route>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/estoque" element={<Stock />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/clientes" element={<Customers />} />
          <Route path="/fornecedores" element={<Suppliers />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/financeiro" element={<Navigate to="/financeiro/caixa" replace />} />
          <Route path="/financeiro/caixa" element={<Cash />} />
          <Route path="/financeiro/contas" element={<Accounts />} />
          <Route path="/financeiro/pagar" element={<Entries kind="pagar" />} />
          <Route path="/financeiro/receber" element={<Entries kind="receber" />} />
        </Route>
        <Route path="*" element={<PublicLayout notFound />} />
      </Routes>
    </>
  );
}
