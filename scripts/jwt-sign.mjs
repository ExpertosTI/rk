#!/usr/bin/env node
/**
 * Firma JWT estilo PostgREST / Insforge Renace (HS256).
 * Uso: node scripts/jwt-sign.mjs <role> <secret>
 */
import crypto from 'crypto';

const role = process.argv[2];
const secret = process.argv[3];

if (!role || !secret) {
  console.error('Uso: node scripts/jwt-sign.mjs <role> <secret>');
  process.exit(1);
}

const header = Buffer.from('{"alg": "HS256", "typ": "JWT"}').toString('base64').replace(/=+$/g, '');
const payload = Buffer.from(`{"role": "${role}"}`).toString('base64').replace(/=+$/g, '');
const data = `${header}.${payload}`;
const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=+$/g, '');

process.stdout.write(`${data}.${sig}`);
