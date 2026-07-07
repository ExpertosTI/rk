import { BRAND } from './constants';
import type { CreditFormData } from './schema';
import { parseCurrency } from './formatters';

export const STEP_TITLES = [
  'TU CRÉDITO',
  'TUS DATOS',
  'CONFIRMACIÓN',
] as const;

export const STEP_FIELDS: Record<number, (keyof CreditFormData)[]> = {
  1: ['producto', 'monto', 'plazo', 'garantia'],
  2: [
    'nombre',
    'whatsapp',
    'ingresos',
    'provincia',
    'cedulaData',
    'autorizaDatos',
    'aceptaPrivacidad',
    'aceptaTerminos',
  ],
};

const FIELD_LABELS: Partial<Record<keyof CreditFormData, string>> = {
  producto: 'Tipo de financiamiento',
  monto: 'Monto',
  plazo: 'Plazo',
  garantia: 'Garantía',
  nombre: 'Nombre',
  whatsapp: 'WhatsApp',
  ingresos: 'Ingresos',
  provincia: 'Ubicación',
  cedulaData: 'Cédula subida',
  autorizaDatos: 'Autorización de datos',
  aceptaPrivacidad: 'Política de privacidad',
  aceptaTerminos: 'Términos aceptados',
};

function isFieldFilled(field: keyof CreditFormData, value: unknown): boolean {
  if (field === 'aceptaTerminos' || field === 'aceptaPrivacidad' || field === 'autorizaDatos') {
    return value === true;
  }
  if (field === 'cedulaData') return typeof value === 'string' && value.length >= 80;
  if (field === 'monto') return parseCurrency(String(value ?? '')) >= BRAND.minAmount;
  if (field === 'ingresos') return parseCurrency(String(value ?? '')) > 0;
  if (field === 'producto' || field === 'garantia') return value != null && value !== '';
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

export function stepCompletion(step: number, values: Partial<CreditFormData>) {
  const fields = STEP_FIELDS[step] ?? [];
  const filled = fields.filter((f) => isFieldFilled(f, values[f])).length;
  const pct = fields.length ? Math.round((filled / fields.length) * 100) : 100;

  return {
    pct,
    filled,
    total: fields.length,
    fields: fields.map((key) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      done: isFieldFilled(key, values[key]),
    })),
  };
}

export function overallCompletion(step: number, totalSteps: number, stepPct: number) {
  const base = ((step - 1) / totalSteps) * 100;
  const current = (stepPct / 100) * (100 / totalSteps);
  return Math.min(100, Math.round(base + current));
}
