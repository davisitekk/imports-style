export const brl = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

export const maskCPF = (v) =>
  onlyDigits(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const maskPhone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

export const maskCEP = (v) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export function isValidCPF(value) {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +c[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === +c[10];
}

export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());

export const STATUS = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separacao',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const PAYMENT = { pix: 'Pix', cartao: 'Cartao de credito', boleto: 'Boleto' };

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '-');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

export const variantLabel = (v) => [v?.size, v?.color].filter(Boolean).join(' / ');

export const productImage = (p) =>
  p?.image_url || p?.images?.[0] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800';

export function errMsg(e) {
  const m = e?.message || String(e || 'Erro desconhecido');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Failed to fetch/i.test(m)) return 'Falha de conexao. Verifique sua internet.';
  if (/row-level security|permission|Sem permissao/i.test(m)) return 'Voce nao tem permissao para esta acao.';
  return m;
}

export function shippingOptions(cep, subtotal, freeOver = 499) {
  const d = onlyDigits(cep);
  if (d.length !== 8) return [];
  const first = +d[0];
  const base = first <= 3 ? 19.9 : first <= 7 ? 29.9 : 39.9;
  const days = first <= 3 ? 3 : first <= 7 ? 6 : 9;
  const free = subtotal >= freeOver;
  return [
    { id: 'pac', name: 'PAC', cost: free ? 0 : base, days: `${days}-${days + 4} dias uteis` },
    { id: 'sedex', name: 'SEDEX', cost: +(base * 1.8).toFixed(2), days: `${Math.max(1, days - 2)}-${days} dias uteis` },
  ];
}
