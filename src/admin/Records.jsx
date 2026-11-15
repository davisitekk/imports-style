import React from 'react';
import { sb } from '../lib/supabase.js';
import { errMsg, fmtDateTime, onlyDigits } from '../lib/utils.js';
import { useToast } from '../components/Public.jsx';
import { CrudPage, useLoad } from './ui.jsx';

export function Customers() {
  return <CrudPage title="Clientes" table="customers" order="created_at" toast={() => {}} fields={[
    { k: 'name', label: 'Nome', required: true }, { k: 'email', label: 'E-mail' }, { k: 'phone', label: 'Telefone' },
    { k: 'cpf', label: 'CPF' }, { k: 'city', label: 'Cidade' }, { k: 'state', label: 'UF' },
  ]} columns={[['name', 'Nome'], ['email', 'E-mail'], ['phone', 'Telefone'], ['city', 'Cidade'], ['created_at', 'Cadastro', (v) => fmtDateTime(v)]]} />;
}

export function Suppliers() {
  return <CrudPage title="Fornecedores" table="suppliers" order="name" toast={() => {}} fields={[
    { k: 'name', label: 'Nome', required: true }, { k: 'contact', label: 'Contato' }, { k: 'email', label: 'E-mail' },
    { k: 'phone', label: 'Telefone' }, { k: 'document', label: 'CNPJ/CPF' }, { k: 'notes', label: 'Observacoes', type: 'textarea' },
  ]} columns={[['name', 'Nome'], ['contact', 'Contato'], ['phone', 'Telefone'], ['email', 'E-mail'], ['notes', 'Observacoes']]} />;
}

export function Users() {
  const [toast, showToast] = useToast();
  const profiles = useLoad(async () => {
    const res = await sb().from('profiles').select('*').order('created_at');
    if (res.error) throw res.error;
    return res.data;
  });
  const change = async (p, role) => {
    try {
      const { error } = await sb().from('profiles').update({ role }).eq('id', p.id);
      if (error) throw error;
      showToast('Perfil atualizado.'); profiles.reload();
    } catch (e) { alert(errMsg(e)); }
  };
  return (
    <>
      <div className="page-head"><h1>Usuarios da equipe</h1></div>
      <div className="alert">Para criar um novo usuario: no Supabase, va em <strong>Authentication - Users - Add user</strong>. O perfil e criado automaticamente com a funcao <em>vendas</em>; ajuste aqui. O primeiro usuario criado vira <em>admin</em>.</div>
      {profiles.error && <div className="alert error">{profiles.error}</div>}
      {profiles.loading ? <div className="spinner" /> : (
        <table className="table responsive"><thead><tr><th>Nome</th><th>E-mail</th><th>Funcao</th><th>Desde</th></tr></thead>
          <tbody>{(profiles.data || []).map((p) => (
            <tr key={p.id}>
              <td data-label="Nome">{p.name || '-'}</td>
              <td data-label="E-mail">{p.email || '-'}</td>
              <td data-label="Funcao">
                <select value={p.role} onChange={(e) => change(p, e.target.value)} style={{ width: 'auto' }}>
                  {['admin', 'estoque', 'financeiro', 'vendas'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td data-label="Desde" className="small muted">{fmtDateTime(p.created_at)}</td>
            </tr>))}
          </tbody></table>)}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Permissoes</h3>
        <table className="table responsive"><thead><tr><th>Funcao</th><th>Acesso</th></tr></thead><tbody>
          <tr><td data-label="Funcao">admin</td><td data-label="Acesso">Tudo</td></tr>
          <tr><td data-label="Funcao">estoque</td><td data-label="Acesso">Produtos, categorias, estoque, pedidos (leitura)</td></tr>
          <tr><td data-label="Funcao">financeiro</td><td data-label="Acesso">Financeiro, pedidos, clientes</td></tr>
          <tr><td data-label="Funcao">vendas</td><td data-label="Acesso">Pedidos, clientes</td></tr>
        </tbody></table>
      </div>
      {toast}
    </>
  );
}

export function Settings() {
  const [toast, showToast] = useToast();
  const [err, setErr] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const data = useLoad(async () => {
    const res = await sb().from('settings').select('*');
    if (res.error) throw res.error;
    return Object.fromEntries(res.data.map((r) => [r.key, Array.isArray(r.value) ? r.value[0] : r.value]));
  });
  const [form, setForm] = React.useState(null);
  React.useEffect(() => { if (data.data && !form) setForm(data.data); }, [data.data]);
  if (data.loading || !form) return <div className="spinner" />;

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      const digits = onlyDigits(form.whatsapp || '');
      const rows = [
        { key: 'store_name', value: [form.store_name || 'Importados Style'] },
        { key: 'pix_discount', value: [Number(form.pix_discount) || 0] },
        { key: 'free_shipping_over', value: [Number(form.free_shipping_over) || 0] },
        { key: 'whatsapp', value: [digits] },
        { key: 'instagram', value: [String(form.instagram || '').replace('@', '')] },
      ];
      const { error } = await sb().from('settings').upsert(rows);
      if (error) throw error;
      showToast('Configuracoes salvas.'); data.reload();
    } catch (e) { setErr(errMsg(e)); } finally { setSaving(false); }
  };

  const F = (k, label, type = 'text', hint) => (
    <div><label htmlFor={k}>{label}</label><input id={k} type={type} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />{hint && <div className="small muted">{hint}</div>}</div>
  );

  return (
    <>
      <div className="page-head"><h1>Configuracoes</h1><button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
      <div className="card">
        <h3>Loja</h3>
        <div className="form-grid two">
          {F('store_name', 'Nome da loja')}
          {F('whatsapp', 'WhatsApp (so numeros, com DDI)', 'tel', 'Ex.: 5511999999999')}
          {F('instagram', 'Instagram (@)')}
          {F('pix_discount', 'Desconto Pix (%)', 'number')}
          {F('free_shipping_over', 'Frete gratis a partir de (R$)', 'number')}
        </div>
      </div>
      <div className="card">
        <h3>Integracoes</h3>
        <p className="small muted">O webhook de pagamento (Nuvemshop / Nuvem Pago) fica em <code>/api/payment-webhook</code> e usa as variaveis de ambiente do servidor: <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code> e <code>NUVEM_WEBHOOK_SECRET</code>. Configure em Cloudflare - Settings - Environment variables.</p>
      </div>
      <div className="card">
        <h3>Banco de dados</h3>
        <p className="small muted">Tabelas, politicas RLS e funcoes (RPC) estao em <code>supabase/schema.sql</code>. Dados de exemplo em <code>supabase/seed.sql</code>.</p>
      </div>
      {err && <div className="alert error">{err}</div>}
      {toast}
    </>
  );
}
