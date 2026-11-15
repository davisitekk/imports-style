// Cloudflare Pages Function — webhook de pagamento (Nuvemshop / Nuvem Pago).
// POST https://SEU-SITE.pages.dev/api/payment-webhook
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

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NUVEM_WEBHOOK_SECRET } = env || {};
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !NUVEM_WEBHOOK_SECRET) {
    return json(500, { error: 'Variaveis de ambiente ausentes' });
  }
  const secret = request.headers.get('x-webhook-secret');
  if (secret !== NUVEM_WEBHOOK_SECRET) return json(401, { error: 'Nao autorizado' });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'JSON invalido' }); }

  const number = Number(body.order_number ?? body.external_reference ?? body.number);
  const status = STATUS_MAP[String(body.status || '').toLowerCase()];
  if (!number || !status) return json(400, { error: 'order_number ou status invalido' });

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?number=eq.${number}&select=id`, { headers });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return json(404, { error: 'Pedido nao encontrado' });

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/webhook_set_order_status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_order_id: rows[0].id, p_status: status }),
  });
  if (!rpc.ok) return json(500, { error: await rpc.text() });

  return json(200, { ok: true, number, status });
}

export async function onRequestGet() {
  return json(405, { error: 'Use POST' });
}
