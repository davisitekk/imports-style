// Webhook de pagamento — Netlify Function (Nuvemshop / Nuvem Pago).
// POST https://SEU-SITE.netlify.app/api/payment-webhook
// Header obrigatorio: x-webhook-secret: <NUVEM_WEBHOOK_SECRET>

const STATUS_MAP = {
  paid: 'pago',
  approved: 'pago',
  authorized: 'pago',
  pending: 'aguardando_pagamento',
  cancelled: 'cancelado',
  canceled: 'cancelado',
  refunded: 'cancelado',
  voided: 'cancelado',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo nao permitido' }) };
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NUVEM_WEBHOOK_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !NUVEM_WEBHOOK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Variaveis de ambiente ausentes' }) };
  }
  const secret = event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'];
  if (secret !== NUVEM_WEBHOOK_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nao autorizado' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalido' }) };
  }

  const number = Number(body.order_number ?? body.external_reference ?? body.number);
  const status = STATUS_MAP[String(body.status || '').toLowerCase()];
  if (!number || !status) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_number ou status invalido' }) };
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?number=eq.${number}&select=id`, { headers });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Pedido nao encontrado' }) };
  }

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/webhook_set_order_status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_order_id: rows[0].id, p_status: status }),
  });
  if (!rpc.ok) return { statusCode: 500, body: JSON.stringify({ error: await rpc.text() }) };

  return { statusCode: 200, body: JSON.stringify({ ok: true, number, status }) };
};
