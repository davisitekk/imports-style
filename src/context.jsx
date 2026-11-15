import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './lib/supabase.js';

/* ---------------- Store info ---------------- */
const StoreCtx = createContext(null);
const DEFAULT_INFO = { name: 'Importados Style', pix_discount: 5, free_shipping_over: 499, products_count: 0, categories_count: 0, brands_count: 0 };

export function StoreProvider({ children }) {
  const [info, setInfo] = useState(DEFAULT_INFO);
  useEffect(() => {
    if (!supabase) return;
    supabase.rpc('get_store_public_info').then(({ data }) => data && setInfo({ ...DEFAULT_INFO, ...data }));
  }, []);
  return <StoreCtx.Provider value={info}>{children}</StoreCtx.Provider>;
}
export const useStore = () => useContext(StoreCtx);

/* ---------------- Auth ---------------- */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s) => {
    if (!s || !supabase) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo(() => ({
    session, profile, loading,
    role: profile?.role,
    can: (...roles) => profile?.role === 'admin' || roles.includes(profile?.role),
    signOut: () => supabase?.auth.signOut(),
  }), [session, profile, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------------- Cart ---------------- */
const CartCtx = createContext(null);
const CART_KEY = 'is_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(items)); }, [items]);

  const add = (item) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.variant_id === item.variant_id);
      if (ex) {
        return prev.map((i) => i.variant_id === item.variant_id
          ? { ...i, stock: item.stock, quantity: Math.min(item.stock, i.quantity + item.quantity) } : i);
      }
      return [...prev, { ...item, quantity: Math.min(item.stock, item.quantity) }];
    });
    setOpen(true);
  };
  const update = (variant_id, quantity) =>
    setItems((prev) => prev.map((i) => i.variant_id === variant_id
      ? { ...i, quantity: Math.max(1, Math.min(i.stock, quantity)) } : i));
  const remove = (variant_id) => setItems((prev) => prev.filter((i) => i.variant_id !== variant_id));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <CartCtx.Provider value={{ items, add, update, remove, clear, count, subtotal, open, setOpen }}>
      {children}
    </CartCtx.Provider>
  );
}
export const useCart = () => useContext(CartCtx);
