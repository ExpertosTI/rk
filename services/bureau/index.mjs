import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const MODE = process.env.TRANSUNION_MODE || 'mock';
const ADMIN_PIN = process.env.BUREAU_ADMIN_PIN || '';
const INSFORGE_URL = (process.env.INSFORGE_URL || 'http://insforge_postgrest:3000').replace(/\/$/, '');
const SERVICE_KEY = process.env.INSFORGE_SERVICE_KEY || process.env.INSFORGE_ANON_KEY || '';

const TU = {
  clientId: process.env.TRANSUNION_CLIENT_ID || '',
  clientSecret: process.env.TRANSUNION_CLIENT_SECRET || '',
  tokenUrl: process.env.TRANSUNION_TOKEN_URL || '',
  apiUrl: (process.env.TRANSUNION_API_URL || '').replace(/\/$/, ''),
  subscriberCode: process.env.TRANSUNION_SUBSCRIBER_CODE || '',
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeCedula(raw) {
  return String(raw || '').replace(/\D/g, '');
}

async function insforgeUpsert(table, row) {
  const res = await fetch(`${INSFORGE_URL}/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insforge_${res.status}:${text.slice(0, 200)}`);
  }
}

async function oauthToken() {
  if (!TU.tokenUrl || !TU.clientId || !TU.clientSecret) {
    throw new Error('transunion_not_configured');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: TU.clientId,
    client_secret: TU.clientSecret,
  });
  const res = await fetch(TU.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`transunion_token_${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('transunion_no_token');
  return data.access_token;
}

async function consultLive(cedula, nombre) {
  const token = await oauthToken();
  if (!TU.apiUrl) throw new Error('transunion_api_url_missing');

  const res = await fetch(`${TU.apiUrl}/consulta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscriberCode: TU.subscriberCode,
      nationalId: cedula,
      name: nombre,
      country: 'DO',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`transunion_api_${res.status}:${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    estado: 'consultado',
    proveedor: 'transunion-datacredito',
    score: data.score ?? data.creditScore ?? null,
    resumen: data.summary ?? data.resumen ?? 'Consulta procesada por TransUnion',
    recomendacion: data.recommendation ?? data.recomendacion ?? 'evaluar_manual',
    payload: data,
  };
}

function consultMock(cedula, nombre) {
  const tail = Number(cedula.slice(-3)) || 500;
  const score = 580 + (tail % 220);
  return {
    estado: 'consultado',
    proveedor: 'transunion-mock',
    score,
    resumen: `Consulta simulada para ${nombre}. Sin moras activas en modo prueba.`,
    recomendacion: score >= 650 ? 'pre_aprobado' : 'revision_manual',
    payload: { mode: 'mock', cedula, note: 'Active TRANSUNION_MODE=live after ICS subscription' },
  };
}

async function handleConsultar(req, res) {
  const body = await readBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }
  if (body.adminPin !== ADMIN_PIN) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const cedula = normalizeCedula(body.numeroCedula);
  const solicitudId = String(body.solicitudId || '');
  const nombre = String(body.nombre || '');

  if (!/^\d{11}$/.test(cedula)) {
    return json(res, 400, { ok: false, error: 'cedula_invalida' });
  }
  if (!solicitudId) {
    return json(res, 400, { ok: false, error: 'solicitud_requerida' });
  }

  const id = `BRU-${Date.now().toString(36).toUpperCase()}`;
  let result;
  let errorMsg = null;

  try {
    result = MODE === 'live' ? await consultLive(cedula, nombre) : consultMock(cedula, nombre);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'consulta_fallida';
    result = {
      estado: 'error',
      proveedor: MODE === 'live' ? 'transunion-datacredito' : 'transunion-mock',
      score: null,
      resumen: 'No se pudo completar la consulta al buró',
      recomendacion: 'revision_manual',
      payload: { error: errorMsg },
    };
  }

  const row = {
    id,
    solicitud_id: solicitudId,
    numero_cedula: cedula,
    proveedor: result.proveedor,
    estado: result.estado,
    score: result.score,
    resumen: result.resumen,
    recomendacion: result.recomendacion,
    payload: result.payload,
    error_msg: errorMsg,
    created_at: new Date().toISOString(),
  };

  try {
    await insforgeUpsert('rk_bureau_consultas', row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'insforge_error';
    return json(res, 502, { ok: false, error: msg });
  }

  return json(res, 200, { ok: true, consulta: row, mode: MODE });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz' && req.method === 'GET') {
      return json(res, 200, { ok: true, mode: MODE });
    }
    if (req.url === '/consultar' && req.method === 'POST') {
      return await handleConsultar(req, res);
    }
    json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`rk-bureau listening on :${PORT} mode=${MODE}`);
});
