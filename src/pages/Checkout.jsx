import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, useStore } from '../context.jsx';
import { sb } from '../lib/supabase.js';
import { brl, errMsg, isValidCPF, isValidEmail, maskCEP, maskCPF, maskPhone, onlyDigits, PAYMENT, shippingOptions, variantLabel } from '../lib/utils.js';

const STEPS = ['Dados pessoais', 'Endereco', 'Frete', 'Pagamento', 'Revisao'];
const SAVED = 'is_checkout_data';

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const info = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => {
    const base = { name: '', email: '', phone: '', cpf: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '', shipping: 'pac', payment: 'pix', notes: '' };
    try { return { ...base, ...JSON.parse(localStorage.getItem(SAVED)) }; } catch { return base; }
  });
  const [errors, setErrors] = useState({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  useEffect(() => {
    const keep = { name: f.name, email: f.email, phone: f.phone, cpf: f.cpf, cep: f.cep, street: f.street, number: f.number, complement: f.complement, district: f.district, city: f.city, state: f.state };
    localStorage.setItem(SAVED, JSON.stringify(keep));
  }, [f]);

  useEffect(() => {
    const cep = onlyDigits(f.cep);
    if (cep.length !== 8) { setCepError(''); return; }
    let cancel = false;
    setCepLoading(true); setCepError('');
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json()).then((d) => {
      if (cancel) return;
      if (d.erro) { setCepError('CEP nao encontrado.'); return; }
      setF((p) => ({ ...p, street: d.logradouro || p.street, district: d.bairro || p.district, city: d.localidade || '', state: d.uf || '' }));
    }).catch(() => !cancel && setCepError('Nao foi possivel consultar o CEP. Preencha manualmente.'))
      .finally(() => !cancel && setCepLoading(false));
    return () => { cancel = true; };
  }, [f.cep]);

  const options = useMemo(() => shippingOptions(f.cep, subtotal, info.free_shipping_over), [f.cep, subtotal, info.free_shipping_over]);
  const ship = options.find((o) => o.id === f.shipping) || options[0];
  const discount = f.payment === 'pix' ? Math.round(subtotal * info.pix_discount) / 100 : 0;
  const total = subtotal - discount + (ship?.cost || 0);

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (f.name.trim().split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome.';
      if (!isValidEmail(f.email)) e.email = 'E-mail invalido.';
      if (onlyDigits(f.phone).length < 10) e.phone = 'Telefone invalido (com DDD).';
      if (!isValidCPF(f.cpf)) e.cpf = 'CPF invalido.';
    }
    if (s === 1) {
      if (onlyDigits(f.cep).length !== 8) e.cep = 'CEP deve ter 8 digitos.';
      if (!f.street.trim()) e.street = 'Informe a rua.';
      if (!f.number.trim()) e.number = 'Informe o numero.';
      if (!f.district.trim()) e.district = 'Informe o bairro.';
      if (!f.city.trim()) e.city = 'Informe a cidade.';
      if (!/^[A-Za-z]{2}$/.test(f.state)) e.state = 'UF invalida.';
    }
    if (s === 2 && !ship) e.shipping = 'Selecione o frete.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const next = () => validate(step) && setStep(step + 1);

  const submit = async () => {
    for (let s = 0; s < 3; s++) if (!validate(s)) { setStep(s); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const { data, error } = await sb().rpc('create_store_order', { p: {
        customer: { name: f.name.trim(), email: f.email.trim(), phone: f.phone, cpf: f.cpf },
        shipping: { cep: f.cep, street: f.street, number: f.number, complement: f.complement, district: f.district, city: f.city, state: f.state.toUpperCase(), method: ship.name, cost: ship.cost },
        payment_method: f.payment, notes: f.notes,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      } });
      if (error) throw error;
      sessionStorage.setItem('is_last_order', JSON.stringify({ ...data, email: f.email, items, shipping: ship }));
      clear();
      nav(`/pedido/${data.number}`, { replace: true });
    } catch (e) {
      setSubmitError(errMsg(e));
    } finally { setSubmitting(false); }
  };

  if (!items.length) return (
    <div className="container empty" style={{ padding: '80px 16px' }}><h1>Carrinho vazio</h1><Link to="/loja" className="btn btn-gold">Explorar colecao</Link></div>
  );

  const F = ({ k, label, ...rest }) => (
    <div><label htmlFor={k}>{label}</label><input id={k} value={f[k]} onChange={(e) => set(k, rest.mask ? rest.mask(e.target.value) : e.target.value)} placeholder={rest.placeholder} type={rest.type} inputMode={rest.inputMode} autoComplete={rest.autoComplete} maxLength={rest.maxLength} />{errors[k] && <div className="err">{errors[k]}</div>}</div>
  );

  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <h1>Checkout</h1>
      <div className="steps">{STEPS.map((s, i) => <div key={s} className={i <= step ? 'done' : ''} />)}</div>
      <div className="step-title">Etapa {step + 1} de {STEPS.length} · {STEPS[step]}</div>
      <div className="checkout-layout" style={{ marginTop: 16 }}>
        <div>
          {step === 0 && <div className="form-grid two">
            {F({ k: 'name', label: 'Nome completo', autoComplete: 'name' })}
            {F({ k: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', inputMode: 'email' })}
            {F({ k: 'phone', label: 'Telefone / WhatsApp', inputMode: 'tel', autoComplete: 'tel', mask: maskPhone, placeholder: '(11) 99999-9999' })}
            {F({ k: 'cpf', label: 'CPF', inputMode: 'numeric', mask: maskCPF, placeholder: '000.000.000-00' })}
          </div>}
          {step === 1 && <div className="form-grid two">
            <div>{F({ k: 'cep', label: 'CEP', inputMode: 'numeric', autoComplete: 'postal-code', mask: maskCEP, placeholder: '00000-000' })}
              {cepLoading && <div className="small muted">Buscando endereco...</div>}{cepError && <div className="err">{cepError}</div>}</div>
            {F({ k: 'street', label: 'Rua', autoComplete: 'address-line1' })}
            {F({ k: 'number', label: 'Numero' })}
            {F({ k: 'complement', label: 'Complemento (opcional)' })}
            {F({ k: 'district', label: 'Bairro' })}
            {F({ k: 'city', label: 'Cidade' })}
            {F({ k: 'state', label: 'UF', maxLength: 2, mask: (v) => v.toUpperCase().replace(/[^A-Z]/g, '') })}
          </div>}
          {step === 2 && <div>
            {options.map((o) => (
              <label key={o.id} className={`option ${f.shipping === o.id ? 'active' : ''}`}>
                <input type="radio" name="ship" checked={f.shipping === o.id} onChange={() => set('shipping', o.id)} />
                <span style={{ flex: 1 }}><strong>{o.name}</strong><br /><span className="small muted">{o.days}</span></span>
                <span className="price">{o.cost === 0 ? <span className="pix-tag">Gratis</span> : brl(o.cost)}</span>
              </label>
            ))}
            {errors.shipping && <div className="err">{errors.shipping}</div>}
            <p className="small muted">Valores estimados para o CEP {f.cep}.</p>
          </div>}
          {step === 3 && <div>
            {Object.entries(PAYMENT).map(([k, l]) => (
              <label key={k} className={`option ${f.payment === k ? 'active' : ''}`}>
                <input type="radio" name="pay" checked={f.payment === k} onChange={() => set('payment', k)} />
                <span style={{ flex: 1 }}><strong>{l}</strong>{k === 'pix' && <><br /><span className="pix-tag">{info.pix_discount}% de desconto · aprovacao imediata</span></>}</span>
              </label>
            ))}
            <label htmlFor="notes" style={{ marginTop: 14 }}>Observacoes (opcional)</label>
            <textarea id="notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>}
          {step === 4 && <div className="card">
            <p><strong>{f.name}</strong><br /><span className="muted small">{f.email} · {f.phone} · CPF {f.cpf}</span></p>
            <p className="small">{f.street}, {f.number}{f.complement && ` - ${f.complement}`} · {f.district} · {f.city}/{f.state} · CEP {f.cep}</p>
            <p className="small">Frete: {ship?.name} ({ship?.days}) · Pagamento: {PAYMENT[f.payment]}</p>
            <button className="link-btn" onClick={() => setStep(0)}>Editar dados</button>
          </div>}
          {submitError && <div className="alert error">{submitError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={submitting}>Voltar</button>}
            {step < 4 ? <button className="btn btn-gold" style={{ flex: 1 }} onClick={next}>Continuar</button>
              : <button className="btn btn-gold" style={{ flex: 1 }} onClick={submit} disabled={submitting}>{submitting ? 'Finalizando...' : 'Finalizar pedido'}</button>}
          </div>
        </div>
        <aside className="summary" style={{ alignSelf: 'start' }}>
          <div className="step-title" style={{ marginBottom: 8 }}>Resumo</div>
          {items.map((i) => (
            <div key={i.variant_id} className="summary-row small"><span>{i.quantity}× {i.name}<br /><span className="muted">{variantLabel(i)}</span></span><span className="price">{brl(i.price * i.quantity)}</span></div>
          ))}
          <div className="summary-row" style={{ borderTop: '1px solid var(--b1)', marginTop: 8 }}><span>Subtotal</span><span className="price">{brl(subtotal)}</span></div>
          {discount > 0 && <div className="summary-row pix-tag"><span>Desconto Pix</span><span>−{brl(discount)}</span></div>}
          <div className="summary-row"><span>Frete</span><span className="price">{ship ? (ship.cost ? brl(ship.cost) : 'Gratis') : '—'}</span></div>
          <div className="summary-row total"><span>Total</span><strong className="price gold">{brl(total)}</strong></div>
        </aside>
      </div>
    </div>
  );
}
