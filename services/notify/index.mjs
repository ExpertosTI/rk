import http from 'node:http';
import nodemailer from 'nodemailer';

const PORT = Number(process.env.PORT || 8788);
const INSFORGE_URL = (process.env.INSFORGE_URL || 'http://insforge_postgrest:3000').replace(/\/$/, '');
const SERVICE_KEY = process.env.INSFORGE_SERVICE_KEY || '';
const NOTIFY_SECRET = process.env.NOTIFY_SECRET || '';
const ADMIN_URL = (process.env.ADMIN_URL || 'https://rk.renace.tech/admin').replace(/\/$/, '');

const SMTP = {
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  user: process.env.SMTP_USER || 'info@renace.tech',
  pass: process.env.SMTP_PASS || '',
};

const NOTIFY_TO = process.env.NOTIFY_TO || 'jcamacho-gomez@hotmail.com';
const NOTIFY_FROM = process.env.NOTIFY_FROM || 'RK Inversiones <info@renace.tech>';

const PRODUCTS = {
  apartamentos: 'Apartamentos',
  casas: 'Casas',
  vehiculos: 'Vehículos',
  solares: 'Solares',
};

const rateMap = new Map();
const MAX_PER_MIN = 8;
const SOLICITUD_MAX_AGE_MS = 15 * 60 * 1000;

let transporter = null;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function clientIp(req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (rateMap.get(ip) || []).filter((t) => t > windowStart);
  if (hits.length >= MAX_PER_MIN) return false;
  hits.push(now);
  rateMap.set(ip, hits);
  return true;
}

function getTransporter() {
  if (!SMTP.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.secure,
      auth: { user: SMTP.user, pass: SMTP.pass },
    });
  }
  return transporter;
}

async function insforgeFetch(path, opts = {}) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insforge_${res.status}:${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchSolicitud(id) {
  const rows = await insforgeFetch(
    `/rk_solicitudes?id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] || null;
}

async function markNotified(id) {
  await insforgeFetch(`/rk_solicitudes?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ notificada_email_at: new Date().toISOString() }),
    prefer: 'return=minimal',
  });
}

function formatProducto(key) {
  return PRODUCTS[key] || key || '—';
}

function buildTeamMail(row) {
  const nombre = row.nombre?.trim() || 'Sin nombre';
  const producto = formatProducto(row.producto);
  const monto = row.monto || '—';
  const subject = `Nueva solicitud RK — ${nombre} — ${producto} ${monto}`;

  const lines = [
    'Nueva solicitud recibida en RK Inversiones',
    '',
    `Referencia: ${row.id}`,
    `Nombre: ${nombre}`,
    `Producto: ${producto}`,
    `Monto: ${monto}`,
    `Plazo: ${row.plazo ? `${row.plazo} meses` : '—'}`,
    `WhatsApp: ${row.whatsapp || '—'}`,
    `Email: ${row.email || '—'}`,
    `Ubicación: ${row.provincia || '—'}`,
    `Cédula: ${row.numero_cedula || '—'}`,
    `Autoriza DATACRÉDITO: ${row.autoriza_datos ? 'Sí' : 'No'}`,
    '',
    `Panel admin: ${ADMIN_URL}`,
    '',
    '— RK Inversiones (info@renace.tech)',
  ];

  return {
    subject,
    text: lines.join('\n'),
    html: lines.map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join(''),
  };
}

function buildApplicantMail(row) {
  const nombre = row.nombre?.trim()?.split(/\s+/)[0] || 'Cliente';
  const subject = 'Recibimos tu solicitud — RK Inversiones';

  const text = [
    `Hola ${nombre},`,
    '',
    'Tu solicitud de financiamiento fue recibida correctamente.',
    'Estamos verificando tu información en el buró de crédito y te contactaremos por WhatsApp con la respuesta.',
    '',
    `Referencia: ${row.id}`,
    `Producto: ${formatProducto(row.producto)}`,
    `Monto solicitado: ${row.monto || '—'}`,
    '',
    'Si tienes preguntas, escríbenos por WhatsApp al 829-669-8958.',
    '',
    'RK Inversiones',
    'info@renace.tech',
  ].join('\n');

  return { subject, text };
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) throw new Error('smtp_not_configured');
  await transport.sendMail({
    from: NOTIFY_FROM,
    to,
    subject,
    text,
    html,
  });
}

function isValidSolicitud(row) {
  if (!row) return false;
  if (!row.completada) return false;
  if (row.notificada_email_at) return false;
  const created = new Date(row.created_at || row.updated_at).getTime();
  if (Number.isNaN(created)) return false;
  if (Date.now() - created > SOLICITUD_MAX_AGE_MS) return false;
  return true;
}

async function handleSolicitud(req, res) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  const body = await readBody(req);
  if (NOTIFY_SECRET && body.secret !== NOTIFY_SECRET) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const solicitudId = String(body.solicitudId || '').trim();
  if (!solicitudId) {
    return json(res, 400, { ok: false, error: 'solicitud_requerida' });
  }

  let row;
  try {
    row = await fetchSolicitud(solicitudId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'insforge_error';
    return json(res, 502, { ok: false, error: msg });
  }

  if (!isValidSolicitud(row)) {
    return json(res, 409, { ok: false, error: 'solicitud_invalida_o_ya_notificada' });
  }

  try {
    const teamMail = buildTeamMail(row);
    await sendMail({ to: NOTIFY_TO, ...teamMail });

    if (row.email?.includes('@')) {
      const applicantMail = buildApplicantMail(row);
      await sendMail({ to: row.email, ...applicantMail });
    }

    await markNotified(solicitudId);
    return json(res, 200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'send_failed';
    return json(res, 502, { ok: false, error: msg });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        smtp: Boolean(SMTP.pass),
        to: NOTIFY_TO.replace(/(.{2}).*(@.*)/, '$1***$2'),
      });
    }
    if (req.url === '/solicitud' && req.method === 'POST') {
      return await handleSolicitud(req, res);
    }
    json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`rk-notify listening on :${PORT} smtp=${SMTP.host}`);
});
