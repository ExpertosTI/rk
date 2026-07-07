import http from 'node:http';
import nodemailer from 'nodemailer';

const PORT = Number(process.env.PORT || 8788);
const INSFORGE_URL = (process.env.INSFORGE_URL || 'http://insforge_postgrest:3000').replace(/\/$/, '');
const NOTIFY_SECRET = process.env.NOTIFY_SECRET || '';
const ADMIN_URL = (process.env.ADMIN_URL || 'https://rk.renace.tech/admin').replace(/\/$/, '');

const SMTP = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
};

const NOTIFY_TO = process.env.NOTIFY_TO || '';
const NOTIFY_FROM = process.env.NOTIFY_FROM || 'RK Inversiones';
const BRAND_PHONE = process.env.BRAND_PHONE || '';
const BRAND_EMAIL = SMTP.user || NOTIFY_FROM.replace(/^.*<([^>]+)>.*$/, '$1').trim();

const WHATSAPP = {
  to: process.env.NOTIFY_WHATSAPP_TO || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  notifyApplicant: process.env.WHATSAPP_NOTIFY_APPLICANT === 'true',
};

const EVOLUTION = {
  baseUrl: (process.env.EVOLUTION_API_URL || '').replace(/\/$/, ''),
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || '',
};

const PRODUCTS = {
  apartamentos: 'Apartamentos',
  casas: 'Casas',
  vehiculos: 'Vehículos',
  solares: 'Solares',
};

const rateMap = new Map();
const MAX_PER_MIN = 8;
const SOLICITUD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

function smtpConfigured() {
  return Boolean(SMTP.pass);
}

function whatsappCloudConfigured() {
  return Boolean(WHATSAPP.accessToken && WHATSAPP.phoneNumberId);
}

function whatsappEvolutionConfigured() {
  return Boolean(EVOLUTION.baseUrl && EVOLUTION.apiKey && EVOLUTION.instance);
}

function whatsappConfigured() {
  return Boolean(
    WHATSAPP.to && (whatsappEvolutionConfigured() || whatsappCloudConfigured()),
  );
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

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

async function insforgeFetch(path, opts = {}) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
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

async function markNotified(id, channels) {
  const patch = {};
  if (channels.email) patch.notificada_email_at = new Date().toISOString();
  if (channels.whatsapp) patch.notificada_whatsapp_at = new Date().toISOString();
  if (!Object.keys(patch).length) return;
  await insforgeFetch(`/rk_solicitudes?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    prefer: 'return=minimal',
  });
}

async function markDecisionNotified(id, estado) {
  const patch =
    estado === 'aprobada'
      ? { notificada_aprobada_at: new Date().toISOString() }
      : { notificada_rechazada_at: new Date().toISOString() };
  await insforgeFetch(`/rk_solicitudes?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
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
    `— RK Inversiones (${BRAND_EMAIL || 'contacto'})`,
  ];

  return {
    subject,
    text: lines.join('\n'),
    html: lines.map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join(''),
  };
}

function buildTeamWhatsApp(row) {
  const nombre = row.nombre?.trim() || 'Sin nombre';
  const producto = formatProducto(row.producto);
  const monto = row.monto || '—';
  const plazo = row.plazo ? `${row.plazo} meses` : '—';
  const puntuacion = row.puntuacion != null ? `${row.puntuacion}/100` : '—';

  return [
    '🆕 *Nueva solicitud RK Inversiones*',
    '',
    `*Ref:* ${row.id}`,
    `*Nombre:* ${nombre}`,
    `*Producto:* ${producto}`,
    `*Monto:* ${monto}`,
    `*Plazo:* ${plazo}`,
    `*WhatsApp cliente:* ${row.whatsapp || '—'}`,
    `*Puntuación:* ${puntuacion}`,
    '',
    `Panel: ${ADMIN_URL}`,
  ].join('\n');
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
    `Si tienes preguntas, escríbenos por WhatsApp al ${BRAND_PHONE || 'nuestro número'}.`,
    '',
    'RK Inversiones',
    BRAND_EMAIL,
  ].join('\n');

  return { subject, text };
}

function buildApplicantWhatsApp(row) {
  const nombre = row.nombre?.trim()?.split(/\s+/)[0] || 'Cliente';
  return [
    `Hola ${nombre},`,
    '',
    'Recibimos tu solicitud de financiamiento en *RK Inversiones*.',
    `Referencia: ${row.id}`,
    `Producto: ${formatProducto(row.producto)}`,
    `Monto: ${row.monto || '—'}`,
    '',
    'Te contactaremos por este WhatsApp con la respuesta.',
    'Gracias por confiar en nosotros.',
  ].join('\n');
}

function buildDecisionMail(row, estado) {
  const nombre = row.nombre?.trim()?.split(/\s+/)[0] || 'Cliente';
  const producto = formatProducto(row.producto);
  const aprobada = estado === 'aprobada';

  const subject = aprobada
    ? '¡Tu solicitud fue aprobada! — RK Inversiones'
    : 'Actualización de tu solicitud — RK Inversiones';

  const text = aprobada
    ? [
        `Hola ${nombre},`,
        '',
        '¡Buenas noticias! Tu solicitud de financiamiento fue APROBADA.',
        '',
        `Referencia: ${row.id}`,
        `Producto: ${producto}`,
        `Monto: ${row.monto || '—'}`,
        row.plazo ? `Plazo: ${row.plazo} meses` : '',
        '',
        'Un asesor de RK Inversiones te contactará por WhatsApp para coordinar los siguientes pasos.',
        '',
        BRAND_PHONE ? `Teléfono / WhatsApp: ${BRAND_PHONE}` : '',
        '',
        'RK Inversiones',
        BRAND_EMAIL,
      ].filter(Boolean).join('\n')
    : [
        `Hola ${nombre},`,
        '',
        'Gracias por tu interés en RK Inversiones.',
        'Lamentamos informarte que tu solicitud no fue aprobada en esta ocasión.',
        '',
        `Referencia: ${row.id}`,
        `Producto: ${producto}`,
        `Monto solicitado: ${row.monto || '—'}`,
        '',
        BRAND_PHONE
          ? `Si deseas más información o evaluar otras opciones, escríbenos al ${BRAND_PHONE}.`
          : 'Si deseas más información, contáctanos por WhatsApp.',
        '',
        'RK Inversiones',
        BRAND_EMAIL,
      ].join('\n');

  return { subject, text };
}

function buildDecisionWhatsApp(row, estado) {
  const nombre = row.nombre?.trim()?.split(/\s+/)[0] || 'Cliente';
  const producto = formatProducto(row.producto);
  const aprobada = estado === 'aprobada';

  if (aprobada) {
    return [
      `Hola ${nombre},`,
      '',
      '✅ *¡Tu solicitud fue APROBADA!*',
      '',
      `Referencia: ${row.id}`,
      `Producto: ${producto}`,
      `Monto: ${row.monto || '—'}`,
      '',
      'Un asesor de *RK Inversiones* te escribirá pronto para los siguientes pasos.',
      'Gracias por confiar en nosotros.',
    ].join('\n');
  }

  return [
    `Hola ${nombre},`,
    '',
    'Gracias por contactar a *RK Inversiones*.',
    'Lamentamos informarte que tu solicitud *no fue aprobada* en esta ocasión.',
    '',
    `Referencia: ${row.id}`,
    `Producto: ${producto}`,
    '',
    BRAND_PHONE
      ? `Si tienes preguntas, estamos disponibles al ${BRAND_PHONE}.`
      : 'Si tienes preguntas, contáctanos por WhatsApp.',
  ].join('\n');
}

function buildStatusMail(row, estado) {
  if (estado === 'aprobada' || estado === 'rechazada') {
    return buildDecisionMail(row, estado);
  }

  const nombre = row.nombre?.trim()?.split(/\s+/)[0] || 'Cliente';
  const producto = formatProducto(row.producto);

  if (estado === 'revision') {
    return {
      subject: 'Tu solicitud está en revisión — RK Inversiones',
      text: [
        `Hola ${nombre},`,
        '',
        'Te informamos que tu solicitud de financiamiento pasó a estado EN REVISIÓN.',
        'Estamos evaluando tu información y te contactaremos pronto.',
        '',
        `Referencia: ${row.id}`,
        `Producto: ${producto}`,
        `Monto: ${row.monto || '—'}`,
        '',
        BRAND_PHONE
          ? `Si tienes preguntas, escríbenos al ${BRAND_PHONE} o responde a este correo.`
          : 'Si tienes preguntas, responde a este correo.',
        '',
        'RK Inversiones',
        BRAND_EMAIL,
      ].join('\n'),
    };
  }

  if (estado === 'cerrada') {
    return {
      subject: 'Tu solicitud fue cerrada — RK Inversiones',
      text: [
        `Hola ${nombre},`,
        '',
        'Tu solicitud de financiamiento fue marcada como CERRADA en nuestro sistema.',
        '',
        `Referencia: ${row.id}`,
        `Producto: ${producto}`,
        '',
        BRAND_PHONE
          ? `Para retomar el proceso o una nueva solicitud, contáctanos al ${BRAND_PHONE}.`
          : 'Para retomar el proceso, contáctanos por WhatsApp.',
        '',
        'RK Inversiones',
        BRAND_EMAIL,
      ].join('\n'),
    };
  }

  return null;
}

function buildTeamStatusMail(row, estado) {
  const nombre = row.nombre?.trim() || 'Sin nombre';
  const labels = {
    revision: 'EN REVISIÓN',
    aprobada: 'APROBADA',
    rechazada: 'RECHAZADA',
    cerrada: 'CERRADA',
  };
  const label = labels[estado] || estado.toUpperCase();
  return {
    subject: `Estado ${label} — ${nombre} — ${row.id}`,
    text: [
      `Estado actualizado a ${label} — notificación enviada al solicitante.`,
      '',
      `Referencia: ${row.id}`,
      `Nombre: ${nombre}`,
      `Email: ${row.email || '—'}`,
      `WhatsApp: ${row.whatsapp || '—'}`,
      '',
      `Panel: ${ADMIN_URL}`,
    ].join('\n'),
  };
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

async function sendWhatsAppCloud(to, text) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('whatsapp_phone_invalid');

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${WHATSAPP.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`whatsapp_cloud_${res.status}:${err.slice(0, 200)}`);
  }
}

async function sendWhatsAppEvolution(to, text) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('whatsapp_phone_invalid');

  const url = `${EVOLUTION.baseUrl}/message/sendText/${EVOLUTION.instance}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION.apiKey,
    },
    body: JSON.stringify({ number: phone, text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`whatsapp_evolution_${res.status}:${err.slice(0, 200)}`);
  }
}

function canWhatsAppToPhone(to) {
  const phone = normalizePhone(to);
  if (!phone) return false;
  if (whatsappEvolutionConfigured()) return true;
  if (whatsappCloudConfigured()) return true;
  return false;
}

async function sendWhatsAppMessage(to, text) {
  if (!to) throw new Error('whatsapp_to_missing');
  const phone = normalizePhone(to);
  if (!phone) throw new Error('whatsapp_phone_invalid');

  if (whatsappEvolutionConfigured()) {
    await sendWhatsAppEvolution(to, text);
    return;
  }
  if (whatsappCloudConfigured()) {
    await sendWhatsAppCloud(to, text);
    return;
  }
  throw new Error('whatsapp_not_configured');
}

/** Alertas internas al equipo (nueva solicitud). */
async function sendWhatsAppTeam(text) {
  if (!WHATSAPP.to) throw new Error('whatsapp_team_to_missing');
  await sendWhatsAppMessage(WHATSAPP.to, text);
}

function isValidSolicitud(row) {
  if (!row) return false;
  if (!row.completada) return false;

  const emailPending = smtpConfigured() && !row.notificada_email_at;
  const waPending = whatsappConfigured() && !row.notificada_whatsapp_at;
  if (!emailPending && !waPending) return false;

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

  if (!smtpConfigured() && !whatsappConfigured()) {
    return json(res, 503, { ok: false, error: 'notify_not_configured' });
  }

  const body = await readBody(req);
  if (NOTIFY_SECRET && body.secret && body.secret !== NOTIFY_SECRET) {
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

  const needsEmail = smtpConfigured() && !row.notificada_email_at;
  const needsWa = whatsappConfigured() && !row.notificada_whatsapp_at;

  let emailOk = Boolean(row.notificada_email_at);
  let whatsappOk = Boolean(row.notificada_whatsapp_at);
  const errors = [];

  try {
    if (needsEmail) {
      const teamMail = buildTeamMail(row);
      await sendMail({ to: NOTIFY_TO, ...teamMail });

      if (row.email?.includes('@')) {
        const applicantMail = buildApplicantMail(row);
        await sendMail({ to: row.email, ...applicantMail });
      }
      emailOk = true;
    }

    if (needsWa) {
      await sendWhatsAppTeam(buildTeamWhatsApp(row));
      whatsappOk = true;

      if (WHATSAPP.notifyApplicant && row.whatsapp && canWhatsAppToPhone(row.whatsapp)) {
        try {
          await sendWhatsAppMessage(row.whatsapp, buildApplicantWhatsApp(row));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'applicant_wa_failed';
          console.warn('[notify] whatsapp solicitante:', msg);
          errors.push(msg);
        }
      }
    }

    await markNotified(solicitudId, {
      email: needsEmail && emailOk,
      whatsapp: needsWa && whatsappOk,
    });

    return json(res, 200, {
      ok: true,
      email: emailOk,
      whatsapp: whatsappOk,
      warnings: errors.length ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'send_failed';
    return json(res, 502, { ok: false, error: msg, email: emailOk, whatsapp: whatsappOk });
  }
}

function canNotifyEstado(row, estado) {
  if (!row?.completada) return false;
  if (row.estado !== estado) return false;
  if (estado === 'aprobada' && row.notificada_aprobada_at) return false;
  if (estado === 'rechazada' && row.notificada_rechazada_at) return false;
  return ['revision', 'aprobada', 'rechazada', 'cerrada'].includes(estado);
}

async function handleEstado(req, res) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  if (!smtpConfigured() && !whatsappConfigured()) {
    return json(res, 503, { ok: false, error: 'notify_not_configured' });
  }

  const body = await readBody(req);
  if (NOTIFY_SECRET && body.secret && body.secret !== NOTIFY_SECRET) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const solicitudId = String(body.solicitudId || '').trim();
  const estado = String(body.estado || '').trim();

  if (!solicitudId) {
    return json(res, 400, { ok: false, error: 'solicitud_requerida' });
  }
  if (!['revision', 'aprobada', 'rechazada', 'cerrada'].includes(estado)) {
    return json(res, 400, { ok: false, error: 'estado_invalido' });
  }

  let row;
  try {
    row = await fetchSolicitud(solicitudId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'insforge_error';
    return json(res, 502, { ok: false, error: msg });
  }

  if (!canNotifyEstado(row, estado)) {
    return json(res, 409, { ok: false, error: 'estado_ya_notificado_o_invalido' });
  }

  const statusMail = buildStatusMail(row, estado);
  if (!statusMail) {
    return json(res, 400, { ok: false, error: 'estado_sin_plantilla' });
  }

  const decisionWa =
    estado === 'aprobada' || estado === 'rechazada'
      ? buildDecisionWhatsApp(row, estado)
      : null;
  const hasEmail = Boolean(row.email?.includes('@'));
  const hasWhatsApp = Boolean(
    decisionWa && row.whatsapp && canWhatsAppToPhone(row.whatsapp),
  );

  if (!hasEmail && !hasWhatsApp) {
    return json(res, 400, { ok: false, error: 'sin_contacto_solicitante' });
  }

  if (!hasEmail && !smtpConfigured() && !hasWhatsApp) {
    return json(res, 503, { ok: false, error: 'smtp_not_configured' });
  }

  let emailOk = false;
  let whatsappOk = false;
  const warnings = [];

  try {
    if (hasEmail && smtpConfigured()) {
      await sendMail({
        to: row.email,
        subject: statusMail.subject,
        text: statusMail.text,
      });
      emailOk = true;

      const teamCopy = buildTeamStatusMail(row, estado);
      await sendMail({ to: NOTIFY_TO, ...teamCopy });
    }

    if (hasWhatsApp && decisionWa) {
      try {
        await sendWhatsAppMessage(row.whatsapp, decisionWa);
        whatsappOk = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'whatsapp_failed';
        warnings.push(msg);
        console.warn('[notify] status whatsapp:', msg);
      }
    }

    if (!emailOk && !whatsappOk) {
      return json(res, 502, {
        ok: false,
        error: warnings[0] || 'send_failed',
        email: false,
        whatsapp: false,
      });
    }

    if (estado === 'aprobada' || estado === 'rechazada') {
      await markDecisionNotified(solicitudId, estado);
    }

    return json(res, 200, {
      ok: true,
      email: emailOk,
      whatsapp: whatsappOk,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'send_failed';
    return json(res, 502, { ok: false, error: msg, email: emailOk, whatsapp: whatsappOk });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        smtp: smtpConfigured(),
        whatsapp: whatsappConfigured(),
        whatsappEvolution: whatsappEvolutionConfigured(),
        whatsappCloud: whatsappCloudConfigured(),
        to: NOTIFY_TO.replace(/(.{2}).*(@.*)/, '$1***$2'),
        whatsappTo: WHATSAPP.to ? WHATSAPP.to.replace(/\d(?=\d{4})/g, '*') : null,
      });
    }
    if (req.url === '/solicitud' && req.method === 'POST') {
      return await handleSolicitud(req, res);
    }
    if (req.url === '/estado' && req.method === 'POST') {
      return await handleEstado(req, res);
    }
    json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(
    `rk-notify listening on :${PORT} smtp=${smtpConfigured()} whatsapp=${whatsappConfigured()}`,
  );
});
