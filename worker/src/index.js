// Ponte entre o app (GitHub Pages) e a API da Pluggy (Meu Pluggy, uso pessoal).
// O Client Secret fica só aqui, como secret do Cloudflare; o app manda um token próprio (APP_TOKEN).
//
// Secrets (wrangler secret put …): PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, APP_TOKEN, ITEM_IDS (ids separados por vírgula)
// Variável (wrangler.toml): ALLOWED_ORIGINS (origens que podem chamar, separadas por vírgula)

const API = 'https://api.pluggy.ai';
let chave = null, chaveAte = 0;   // API key da Pluggy (vale 2 h; renovamos antes)

async function apiKey(env) {
  if (chave && Date.now() < chaveAte) return chave;
  const r = await fetch(API + '/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Erro(502, 'Pluggy recusou o Client ID/Secret (' + r.status + ')');
  chave = (await r.json()).apiKey;
  chaveAte = Date.now() + 100 * 60 * 1000;
  return chave;
}

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function pluggy(env, caminho) {
  const url = caminho.startsWith('http') ? caminho : API + caminho;
  let r = await fetch(url, { headers: { 'X-API-KEY': await apiKey(env) } });
  if (r.status === 401 || r.status === 403) {   // chave expirada: pega outra e tenta de novo uma vez
    chave = null;
    r = await fetch(url, { headers: { 'X-API-KEY': await apiKey(env) } });
  }
  if (!r.ok) throw new Erro(502, `Pluggy ${r.status} em ${caminho.split('?')[0]}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// todas as páginas de uma lista paginada por número (accounts, bills)
async function paginas(env, caminho) {
  const out = [];
  for (let p = 1; p <= 20; p++) {
    const r = await pluggy(env, `${caminho}${caminho.includes('?') ? '&' : '?'}page=${p}`);
    out.push(...(r.results || []));
    if (!r.totalPages || p >= r.totalPages) break;
  }
  return out;
}

// transações (v2, por cursor)
async function transacoes(env, accountId, de, ate) {
  const base = `/v2/transactions?accountId=${accountId}&dateFrom=${de}&dateTo=${ate}`;
  const out = [];
  let caminho = base;
  for (let i = 0; i < 40 && caminho; i++) {
    const r = await pluggy(env, caminho);
    out.push(...(r.results || []));
    const n = r.next;
    caminho = !n ? null
      : n.startsWith('http') || n.startsWith('/') ? n
      : n.includes('=') ? '/v2/transactions' + (n.startsWith('?') ? n : '?' + n)
      : `${base}&after=${encodeURIComponent(n)}`;
  }
  return out;
}

const dia = d => d ? String(d).slice(0, 10) : null;

async function dados(env, de, ate) {
  const itens = String(env.ITEM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!itens.length) throw new Erro(500, 'ITEM_IDS não configurado no Worker');
  const contas = [];
  for (const itemId of itens) {
    for (const a of await paginas(env, `/accounts?itemId=${itemId}`)) {
      const cartao = a.type === 'CREDIT';
      const [ts, bills] = await Promise.all([
        transacoes(env, a.id, de, ate),
        cartao ? paginas(env, `/bills?accountId=${a.id}`).catch(() => []) : [],
      ]);
      contas.push({
        id: a.id, itemId, tipo: cartao ? 'cartao' : 'conta', subtipo: a.subtype,
        nome: a.marketingName || a.name, nomeBanco: a.name, numero: a.number, saldo: a.balance,
        ...(cartao ? { credito: { vence: dia(a.creditData?.balanceDueDate), fecha: dia(a.creditData?.balanceCloseDate),
          limite: a.creditData?.creditLimit ?? null, disponivel: a.creditData?.availableCreditLimit ?? null } } : {}),
        faturas: bills.map(b => ({ id: b.id, vence: dia(b.dueDate), fecha: dia(b.billClosingDate), total: b.totalAmount })),
        transacoes: ts.map(t => ({
          id: t.id, data: dia(t.date), desc: t.description || t.descriptionRaw || '', valor: t.amount, tipo: t.type, status: t.status,
          ...(t.creditCardMetadata ? { compra: dia(t.creditCardMetadata.purchaseDate), n: t.creditCardMetadata.installmentNumber ?? null,
            N: t.creditCardMetadata.totalInstallments ?? null, fatura: t.creditCardMetadata.billId || null } : {}),
        })),
      });
    }
  }
  return { gerado: new Date().toISOString(), de, ate, contas };
}

function cors(env, origem) {
  const ok = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origem);
  return ok ? { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET', 'Vary': 'Origin' } : {};
}

// comparação de token em tempo constante
function mesmoToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req, env) {
    const h = cors(env, req.headers.get('Origin') || '');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.pathname !== '/dados') return json({ erro: 'não encontrado' }, 404);
    if (req.headers.get('Origin') && !h['Access-Control-Allow-Origin']) return json({ erro: 'site não autorizado (ALLOWED_ORIGINS)' }, 403);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!mesmoToken(token, env.APP_TOKEN)) return json({ erro: 'token inválido' }, 401);
    const ate = new Date().toISOString().slice(0, 10);
    const de = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('desde') || '') ? url.searchParams.get('desde')
      : new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10);
    try { return json(await dados(env, de, ate)); }
    catch (e) { return json({ erro: e.message }, e.status || 500); }
  },
};
